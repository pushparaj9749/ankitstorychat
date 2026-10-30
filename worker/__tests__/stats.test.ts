/**
 * Site analytics — anonymous daily visitor / download-click counters.
 */
import worker from '../src/index';
import { resetRateLimiterForTests, type Env } from '../src/router';
import { resetMemKvForTests, memKv } from '../src/submissions';
import {
  addDays,
  getStats,
  istDay,
  looksLikeBot,
  parseHit,
  recordHit,
  safeColo,
  SHARD_DAILY_CAP,
  MERGED_PREFIX,
  SHARD_PREFIX,
} from '../src/stats';

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const env = (): Env => ({ ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } as unknown as Env['ASSETS'] });

function hit(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(
    new Request('https://beyondredeye.site/api/stats/hit', {
      method: 'POST',
      headers: { Origin: 'https://beyondredeye.site', 'User-Agent': UA, 'Content-Type': 'text/plain', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env(),
    {} as never,
  ) as Promise<Response>;
}
async function stats(days = 30): Promise<Record<string, any>> {
  const r = (await worker.fetch(new Request(`https://beyondredeye.site/api/stats?days=${days}`), env(), {} as never)) as Response;
  expect(r.status).toBe(200);
  return (await r.json()) as Record<string, any>;
}

beforeEach(() => {
  resetRateLimiterForTests();
  resetMemKvForTests();
});

describe('helpers', () => {
  test('IST calendar day (UTC+5:30)', () => {
    expect(istDay(Date.parse('2026-10-30T18:29:00Z'))).toBe('2026-10-30');
    expect(istDay(Date.parse('2026-10-30T18:31:00Z'))).toBe('2026-10-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('beacon body validation', () => {
    expect(parseHit({ e: 'visit', n: true })).toEqual({ kind: 'visit', isNew: true });
    expect(parseHit({ e: 'visit' })).toEqual({ kind: 'visit', isNew: false });
    expect(parseHit({ e: 'download', n: true })).toEqual({ kind: 'download', isNew: false });
    expect(parseHit({ e: 'other' })).toBeNull();
    expect(parseHit([1])).toBeNull();
    expect(parseHit(null)).toBeNull();
  });
  test('bots and missing user agents are not counted', () => {
    expect(looksLikeBot(UA)).toBe(false);
    expect(looksLikeBot(null)).toBe(true);
    expect(looksLikeBot('Googlebot/2.1')).toBe(true);
    expect(looksLikeBot('Mozilla/5.0 HeadlessChrome/120')).toBe(true);
    expect(looksLikeBot('WhatsApp/2.23')).toBe(true);
  });
  test('colo is sanitised', () => {
    expect(safeColo('BOM')).toBe('BOM');
    expect(safeColo('../x')).toBe('XXX');
    expect(safeColo(undefined)).toBe('XXX');
  });
});

describe('POST /api/stats/hit', () => {
  test('counts visits, new visitors and download clicks', async () => {
    expect((await hit({ e: 'visit', n: true })).status).toBe(204);
    expect((await hit({ e: 'visit' })).status).toBe(204);
    expect((await hit({ e: 'download' })).status).toBe(204);
    const s = await stats(7);
    expect(s.today).toMatchObject({ visitors: 2, newVisitors: 1, downloads: 1, capped: false });
    expect(s.last7).toMatchObject({ visitors: 2, newVisitors: 1, downloads: 1 });
    expect(s.allTime).toMatchObject({ visitors: 2, newVisitors: 1, downloads: 1 });
    expect(s.days).toHaveLength(7);
    expect(s.since).toBe(istDay());
    expect(s.timezone).toBe('Asia/Kolkata');
  });

  test('allowed origin gets CORS headers (www → apex beacon)', async () => {
    const r = await hit({ e: 'visit' }, { Origin: 'https://www.beyondredeye.site' });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://www.beyondredeye.site');
  });

  test('requires an Origin and rejects foreign sites', async () => {
    const noOrigin = await worker.fetch(
      new Request('https://beyondredeye.site/api/stats/hit', { method: 'POST', headers: { 'User-Agent': UA }, body: '{"e":"visit"}' }),
      env(),
      {} as never,
    );
    expect(noOrigin.status).toBe(403);
    expect((await hit({ e: 'visit' }, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await stats()).allTime.visitors).toBe(0);
  });

  test('bad bodies are rejected; bots get 204 but are not counted', async () => {
    expect((await hit('not json')).status).toBe(400);
    expect((await hit({ e: 'x' })).status).toBe(400);
    expect((await hit('x'.repeat(500))).status).toBe(400);
    expect((await hit({ e: 'visit' }, { 'User-Agent': 'Googlebot/2.1' })).status).toBe(204);
    expect((await stats()).allTime.visitors).toBe(0);
  });

  test('GET on the beacon route is not allowed', async () => {
    const r = (await worker.fetch(new Request('https://beyondredeye.site/api/stats/hit'), env(), {} as never)) as Response;
    expect(r.status).toBe(405);
  });

  test('stores counts only — no IP, id or user agent', async () => {
    await hit({ e: 'visit', n: true }, { 'CF-Connecting-IP': '203.0.113.9' });
    const list = await memKv.list({ prefix: 'stats:' });
    expect(list.keys).toHaveLength(1);
    expect(list.keys[0].name).toMatch(/^stats:d:\d{4}-\d{2}-\d{2}:[A-Z]{3}$/);
    const raw = (await memKv.get(list.keys[0].name)) ?? '';
    expect(JSON.parse(raw)).toEqual({ v: 1, n: 1, d: 0 });
    expect(raw).not.toMatch(/203\.0\.113|Mozilla/);
  });
});

describe('counter storage', () => {
  const NOW = Date.parse('2026-10-30T06:00:00Z');

  test('per-location shards add up for the same day', async () => {
    await recordHit(env(), { kind: 'visit', isNew: true }, 'BOM', NOW);
    await recordHit(env(), { kind: 'visit', isNew: false }, 'DEL', NOW);
    await recordHit(env(), { kind: 'download', isNew: false }, 'DEL', NOW);
    const s = await getStats(env(), 7, NOW);
    expect(s.today).toEqual({ date: '2026-10-30', visitors: 2, newVisitors: 1, downloads: 1, capped: false });
  });

  test('daily cap per shard protects the shared KV write budget', async () => {
    await memKv.put(`${SHARD_PREFIX}2026-10-30:BOM`, JSON.stringify({ v: SHARD_DAILY_CAP, n: 3, d: 0 }));
    expect(await recordHit(env(), { kind: 'visit', isNew: false }, 'BOM', NOW)).toBe('capped');
    expect(await recordHit(env(), { kind: 'download', isNew: false }, 'BOM', NOW)).toBe('capped');
    const s = await getStats(env(), 1, NOW);
    expect(s.today.visitors).toBe(SHARD_DAILY_CAP);
    expect(s.today.capped).toBe(true);
    expect(s.allTime.capped).toBe(true);
  });

  test('settled days are compacted without double counting', async () => {
    const old = NOW - 5 * 86_400_000; // 2026-10-25
    await recordHit(env(), { kind: 'visit', isNew: true }, 'BOM', old);
    await recordHit(env(), { kind: 'visit', isNew: false }, 'MAA', old);
    await recordHit(env(), { kind: 'visit', isNew: false }, 'BOM', NOW);
    const first = await getStats(env(), 30, NOW);
    expect(first.allTime.visitors).toBe(3);
    expect(await memKv.get(`${MERGED_PREFIX}2026-10-25`)).toBe(JSON.stringify({ v: 2, n: 1, d: 0 }));
    expect(await memKv.get(`${SHARD_PREFIX}2026-10-25:BOM`)).toBeNull();
    // Today's shard is NOT compacted (it is still receiving hits).
    expect(await memKv.get(`${SHARD_PREFIX}2026-10-30:BOM`)).not.toBeNull();

    // A leftover shard next to a merged key (failed delete) is ignored.
    await memKv.put(`${SHARD_PREFIX}2026-10-25:DEL`, JSON.stringify({ v: 2, n: 0, d: 0 }));
    const again = await getStats(env(), 30, NOW);
    expect(again.allTime).toMatchObject({ visitors: 3, newVisitors: 1 });
    expect(again.since).toBe('2026-10-25');
    expect(again.last7.visitors).toBe(3);
    expect(again.days.find((d) => d.date === '2026-10-25')?.visitors).toBe(2);
    expect(await memKv.get(`${SHARD_PREFIX}2026-10-25:DEL`)).toBeNull();
  });

  test('7 / 30 / all-time windows', async () => {
    await recordHit(env(), { kind: 'download', isNew: false }, 'BOM', NOW - 10 * 86_400_000);
    await recordHit(env(), { kind: 'download', isNew: false }, 'BOM', NOW - 40 * 86_400_000);
    await recordHit(env(), { kind: 'download', isNew: false }, 'BOM', NOW);
    const s = await getStats(env(), 14, NOW);
    expect(s.days).toHaveLength(14);
    expect(s.days[0].date).toBe('2026-10-30');
    expect(s.last7.downloads).toBe(1);
    expect(s.last30.downloads).toBe(2);
    expect(s.allTime.downloads).toBe(3);
  });

  test('empty store returns zeros', async () => {
    const s = await getStats(env(), 0, NOW);
    expect(s.since).toBeNull();
    expect(s.days).toHaveLength(1);
    expect(s.allTime).toEqual({ visitors: 0, newVisitors: 0, downloads: 0, capped: false });
  });
});
