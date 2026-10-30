/**
 * Site analytics for the owner: how many people visit beyondredeye.site and
 * how many tap DOWNLOAD — anonymous daily COUNTS only.
 *
 * Privacy: nothing about a person is stored or sent. No IP, no cookie, no id,
 * no user agent. The browser keeps a date marker in its own localStorage to
 * report "first visit today" once per day; the server only adds 1 to a number.
 *
 * Storage (the existing KISSA_SUBMISSIONS KV namespace):
 *   stats:d:<YYYY-MM-DD>:<COLO>  per-day, per-Cloudflare-location shard
 *   stats:m:<YYYY-MM-DD>         merged day (older days are compacted)
 * Each value is { v: visitors, n: new visitors, d: download clicks, c?: capped }.
 *
 * Why shards: KV is eventually consistent ACROSS locations (up to ~60 s) but
 * read-your-write within one location, so a counter per location does not
 * lose increments to cross-location races. Days older than COMPACT_AFTER_DAYS
 * are merged into one key so reads stay small.
 *
 * Write budget: free KV allows a limited number of writes per day and the
 * story-submission system shares this namespace. Each shard stops counting
 * at SHARD_DAILY_CAP and marks the day `capped`, so the counter can never
 * starve submissions; the dashboard then shows "at least" numbers.
 */
import type { Env } from './submissions';
import { kvFor } from './submissions';

export const STATS_PREFIX = 'stats:';
export const SHARD_PREFIX = 'stats:d:';
export const MERGED_PREFIX = 'stats:m:';
export const SHARD_DAILY_CAP = 250;
export const STATS_TTL_SECONDS = 400 * 24 * 60 * 60;
export const MAX_DAYS = 400;
export const COMPACT_AFTER_DAYS = 2;
const COMPACT_PER_REQUEST = 20;
const IST_OFFSET_MS = 330 * 60 * 1000;

export type HitKind = 'visit' | 'download';
export interface DayCount { v: number; n: number; d: number; c?: boolean }
export interface DayRow { date: string; visitors: number; newVisitors: number; downloads: number; capped: boolean }
export interface StatsSummary {
  ok: true;
  timezone: 'Asia/Kolkata';
  since: string | null;
  today: DayRow;
  last7: Totals;
  last30: Totals;
  allTime: Totals;
  days: DayRow[];
}
export interface Totals { visitors: number; newVisitors: number; downloads: number; capped: boolean }

/** Calendar day in India (the owner's timezone), e.g. "2026-10-30". */
export function istDay(now = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export function addDays(day: string, delta: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
export function safeColo(colo: unknown): string {
  return typeof colo === 'string' && /^[A-Z]{3}$/.test(colo) ? colo : 'XXX';
}

const BOT_UA_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python|monitor/i;
export function looksLikeBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA_RE.test(userAgent);
}

/** Validate a beacon body: { e: 'visit', n?: boolean } | { e: 'download' }. */
export function parseHit(body: unknown): { kind: HitKind; isNew: boolean } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.e === 'visit') return { kind: 'visit', isNew: b.n === true };
  if (b.e === 'download') return { kind: 'download', isNew: false };
  return null;
}

function readCount(raw: string | null): DayCount {
  if (!raw) return { v: 0, n: 0, d: 0 };
  try {
    const o = JSON.parse(raw) as Partial<DayCount>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return { v: num(o.v), n: num(o.n), d: num(o.d), ...(o.c ? { c: true } : {}) };
  } catch {
    return { v: 0, n: 0, d: 0 };
  }
}

/** Add one hit to today's shard for this Cloudflare location. Never throws. */
export async function recordHit(
  env: Env,
  hit: { kind: HitKind; isNew: boolean },
  colo: unknown,
  now = Date.now(),
): Promise<'counted' | 'capped' | 'error'> {
  const kv = kvFor(env);
  const key = `${SHARD_PREFIX}${istDay(now)}:${safeColo(colo)}`;
  try {
    const cur = readCount(await kv.get(key));
    if (cur.v + cur.d >= SHARD_DAILY_CAP) {
      if (!cur.c) await kv.put(key, JSON.stringify({ ...cur, c: true }), { expirationTtl: STATS_TTL_SECONDS });
      return 'capped';
    }
    if (hit.kind === 'visit') {
      cur.v += 1;
      if (hit.isNew) cur.n += 1;
    } else {
      cur.d += 1;
    }
    await kv.put(key, JSON.stringify(cur), { expirationTtl: STATS_TTL_SECONDS });
    return 'counted';
  } catch {
    return 'error';
  }
}

async function listAll(env: Env, prefix: string): Promise<string[]> {
  const kv = kvFor(env);
  const names: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = (await kv.list({ prefix, cursor })) as KVNamespaceListResult<unknown, string>;
    for (const k of page.keys) names.push(k.name);
    if (page.list_complete) break;
    cursor = (page as { cursor?: string }).cursor;
    if (!cursor) break;
  }
  return names;
}

function add(a: DayCount, b: DayCount): DayCount {
  return { v: a.v + b.v, n: a.n + b.n, d: a.d + b.d, ...(a.c || b.c ? { c: true } : {}) };
}
function row(date: string, c: DayCount | undefined): DayRow {
  return { date, visitors: c?.v ?? 0, newVisitors: c?.n ?? 0, downloads: c?.d ?? 0, capped: !!c?.c };
}
function totals(rows: DayRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      visitors: t.visitors + r.visitors,
      newVisitors: t.newVisitors + r.newVisitors,
      downloads: t.downloads + r.downloads,
      capped: t.capped || r.capped,
    }),
    { visitors: 0, newVisitors: 0, downloads: 0, capped: false },
  );
}

/**
 * Daily counts for the dashboard. Also compacts settled days (older than
 * COMPACT_AFTER_DAYS) from per-location shards into one merged key.
 */
export async function getStats(env: Env, days = 30, now = Date.now()): Promise<StatsSummary> {
  const kv = kvFor(env);
  const today = istDay(now);
  const oldest = addDays(today, -(MAX_DAYS - 1));
  const names = await listAll(env, STATS_PREFIX);

  const byDay = new Map<string, DayCount>();
  const shardsByDay = new Map<string, string[]>();
  const mergedDays = new Set<string>();
  for (const name of names) {
    let date: string | null = null;
    if (name.startsWith(SHARD_PREFIX)) {
      date = name.slice(SHARD_PREFIX.length, SHARD_PREFIX.length + 10);
      if (!shardsByDay.has(date)) shardsByDay.set(date, []);
      shardsByDay.get(date)!.push(name);
    } else if (name.startsWith(MERGED_PREFIX)) {
      date = name.slice(MERGED_PREFIX.length);
      mergedDays.add(date);
    }
  }
  // A merged key is authoritative for its day (settled days get no new hits);
  // leftover shards of a merged day are ignored and cleaned up below.
  const inRange = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= oldest && d <= today;
  const wanted: { date: string; key: string }[] = [];
  for (const d of mergedDays) if (inRange(d)) wanted.push({ date: d, key: `${MERGED_PREFIX}${d}` });
  for (const [d, shards] of shardsByDay) {
    if (!inRange(d) || mergedDays.has(d)) continue;
    for (const key of shards) wanted.push({ date: d, key });
  }
  const values = await Promise.all(wanted.map((w) => kv.get(w.key)));
  wanted.forEach((w, i) => {
    byDay.set(w.date, add(byDay.get(w.date) ?? { v: 0, n: 0, d: 0 }, readCount(values[i])));
  });

  // Compact settled days: shards → one merged key (or drop leftovers).
  const settled = addDays(today, -COMPACT_AFTER_DAYS);
  let compacted = 0;
  for (const [date, shards] of shardsByDay) {
    if (compacted >= COMPACT_PER_REQUEST) break;
    if (date >= settled || date < oldest) continue;
    try {
      if (!mergedDays.has(date)) {
        await kv.put(`${MERGED_PREFIX}${date}`, JSON.stringify(byDay.get(date) ?? { v: 0, n: 0, d: 0 }), {
          expirationTtl: STATS_TTL_SECONDS,
        });
        mergedDays.add(date);
      }
      await Promise.all(shards.map((s) => kv.delete(s)));
      compacted += 1;
    } catch {
      break; // nothing is lost: shards or the merged key are read next time
    }
  }

  const n = Math.max(1, Math.min(MAX_DAYS, Number.isFinite(days) ? Math.floor(days) : 30));
  const rows: DayRow[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(today, -i);
    rows.push(row(date, byDay.get(date)));
  }
  const allRows = [...byDay.keys()].sort().map((d) => row(d, byDay.get(d)));
  const lastN = (k: number) => {
    const from = addDays(today, -(k - 1));
    return totals(allRows.filter((r) => r.date >= from));
  };
  return {
    ok: true,
    timezone: 'Asia/Kolkata',
    since: allRows.length ? allRows[0].date : null,
    today: row(today, byDay.get(today)),
    last7: lastN(7),
    last30: lastN(30),
    allTime: totals(allRows),
    days: rows,
  };
}
