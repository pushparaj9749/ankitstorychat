/**
 * Long-term memory for one journey.
 *
 * Three layers, cheapest first:
 *  1. Short-term  — the last `shortTermWindow` messages (see engine.buildContext).
 *  2. Episodic    — one auto-logged line per turn (`episode`), so literally every
 *                   exchange stays retrievable even if the AI volunteered nothing.
 *  3. Curated     — `story` / `character` / `world` facts the narrator emitted in
 *                   its ```kissa-state block, plus `preference` facts learned from
 *                   the reader's own wording (kept globally, across all stories).
 *
 * Retrieval = importance + keyword overlap with the recent turns + recency + past
 * usefulness (hits), bounded by a CHARACTER budget. Old facts are folded into a
 * rolling `summary` digest so the compressed past is always in the prompt, and the
 * raw rows stay on disk (archived) — nothing is ever thrown away.
 */
import type { MemoryEntry, MemoryKind, Playthrough } from '../types';
import {
  archiveMemories,
  countMemories,
  insertMemory,
  listGlobalMemories,
  listJourneyMemories,
  pinMemory,
  restoreMemory,
  kvDelete,
  kvGet,
  kvSet,
  listMemoryCandidates,
  listOldestMemories,
  reinforceMemories,
} from './db';
import {
  buildDigestFallback,
  episodeLine,
  GLOBAL_SCOPE,
  looksTooPrivate,
  MEMORY_MAX_CHARS,
  sanitize,
  selectRelevant,
  SUMMARY_MAX_CHARS,
  hashText,
  extractPreferenceNotes,
  MAX_MEMORY_NOTES,
  type SelectOptions,
} from './memoryCore';
import { nowIso, uid } from './utils';

export type { MemoryEntry };
export {
  GLOBAL_SCOPE,
  hashText,
  looksTooPrivate,
  selectRelevant,
  tokenize,
  tokenSet,
  scoreMemory,
  episodeLine,
  buildDigestFallback,
  renderMemoryLine,
  extractPreferenceNotes,
} from './memoryCore';
export type { SelectOptions } from './memoryCore';

/* ---------------- writing ---------------- */

export type RememberStatus = 'inserted' | 'reinforced' | 'skipped';

/**
 * Store one memory line.
 * - trimmed and hard-capped, so a runaway reply cannot bloat the row
 * - refused when it looks like real-world personal data (the `neverRemember`
 *   promise from the story packs, enforced in code and not only in the prompt)
 * - duplicates reinforce the existing row instead of adding another copy
 */
export async function putMemory(
  playthroughId: string,
  kind: MemoryKind,
  text: string,
  importance = 1,
): Promise<RememberStatus> {
  const clean = sanitize(text, MEMORY_MAX_CHARS);
  if (clean.length < 4) return 'skipped';
  if (kind !== 'summary' && looksTooPrivate(clean)) return 'skipped';
  const hash = hashText(clean);
  return insertMemory(
    {
      id: uid('mem'),
      playthroughId,
      kind,
      text: clean,
      importance,
      createdAt: nowIso(),
      hash,
      hits: 0,
      archived: false,
    },
    hash,
  );
}

export async function remember(
  playthroughId: string,
  kind: MemoryKind,
  text: string,
  importance = 1,
): Promise<RememberStatus> {
  return putMemory(playthroughId, kind, text, importance);
}

/** Store up to MAX_MEMORY_NOTES facts; returns how many actually landed. */
export async function rememberMany(
  playthroughId: string,
  notes: string[],
  kind: MemoryKind = 'story',
  importance = 1,
): Promise<number> {
  let stored = 0;
  for (const n of notes.slice(0, MAX_MEMORY_NOTES)) {
    if (!n || !n.trim()) continue;
    if ((await putMemory(playthroughId, kind, n, importance)) !== 'skipped') stored++;
  }
  return stored;
}

/** One line per turn, always — this is what makes "everything" retrievable. */
export async function logEpisode(playthroughId: string, userText: string, replyText: string): Promise<void> {
  await putMemory(playthroughId, 'episode', episodeLine(userText, replyText), 1);
}

/** Preference facts are global: they carry into every other story the reader plays. */
export async function rememberPreferences(userText: string): Promise<number> {
  const notes = extractPreferenceNotes(userText);
  return rememberMany(GLOBAL_SCOPE, notes, 'preference', 3);
}

export async function seedMemoriesIfEmpty(
  playthrough: Playthrough,
  seed: string[],
): Promise<void> {
  const existing = await countMemories([playthrough.id]);
  if (existing > 0) return;
  await rememberMany(playthrough.id, seed, 'story', 2);
}

/* ---------------- reading ---------------- */

export interface Recall {
  memories: MemoryEntry[];
  summary: string;
  candidates: number;
}

const SUMMARY_KEY = (playthroughId: string) => `memsum:${playthroughId}`;

export async function getSummary(playthroughId: string): Promise<string> {
  return (await kvGet(SUMMARY_KEY(playthroughId))) ?? '';
}

/** Forget the compressed digest (the archived raw rows come back into play). */
export async function clearSummary(playthroughId: string): Promise<void> {
  await kvDelete(SUMMARY_KEY(playthroughId));
}

export interface JourneyMemoryView {
  live: MemoryEntry[];
  folded: MemoryEntry[];
  readerPrefs: MemoryEntry[];
  summary: string;
}

/** What the memory viewer shows: live facts, folded facts, reader prefs, digest. */
export async function journeyMemoryView(playthroughId: string): Promise<JourneyMemoryView> {
  const [rows, readerPrefs, summary] = await Promise.all([
    listJourneyMemories(playthroughId),
    listGlobalMemories(),
    getSummary(playthroughId),
  ]);
  return {
    live: rows.filter((r) => !r.archived),
    folded: rows.filter((r) => r.archived),
    readerPrefs,
    summary,
  };
}

export { pinMemory, restoreMemory };

export async function setSummary(playthroughId: string, text: string): Promise<void> {
  const clean = sanitize(text, SUMMARY_MAX_CHARS);
  if (!clean) return;
  await kvSet(SUMMARY_KEY(playthroughId), clean);
}

/** Everything the narrator should see this turn: pinned digest + best-matching facts. */
export async function recallForTurn(
  playthroughId: string,
  queryText: string,
  opts: SelectOptions = {},
): Promise<Recall> {
  const [pool, summary] = await Promise.all([
    listMemoryCandidates([playthroughId, GLOBAL_SCOPE]),
    getSummary(playthroughId),
  ]);
  const picked = selectRelevant(pool, queryText, opts);
  if (picked.length) void reinforceMemories(picked.map((m) => m.id), nowIso()).catch(() => undefined);
  return { memories: picked, summary, candidates: pool.length };
}

/* ---------------- consolidation ---------------- */

export const FOLD_AT_EPISODES = 40;
export const KEEP_LIVE_EPISODES = 16;
export const FOLD_BATCH = 30;
/** Above this many live curated facts, the oldest ones join the digest too. */
export const MAX_LIVE_FACTS = 240;
const FACT_KINDS = ['story', 'character', 'world'];

export interface ConsolidateOutcome {
  folded: number;
  summaryChars: number;
  usedAI: boolean;
}

/**
 * Fold the oldest episodic lines into the rolling digest.
 * Raw rows are only `archived` (never deleted), so a future version can re-expand.
 * `summarize` is injected so this file stays free of provider/key plumbing —
 * without it we still fold deterministically (zero extra AI cost).
 */
export async function consolidateMemories(
  playthroughId: string,
  summarize?: (prompt: string) => Promise<string>,
  opts: { minLiveEpisodes?: number; keepLiveEpisodes?: number } = {},
): Promise<ConsolidateOutcome> {
  const minLive = opts.minLiveEpisodes ?? FOLD_AT_EPISODES;
  const keep = opts.keepLiveEpisodes ?? KEEP_LIVE_EPISODES;
  const ids = [playthroughId, GLOBAL_SCOPE];
  const live = await countMemories(ids, ['episode']);
  if (live < minLive) return { folded: 0, summaryChars: 0, usedAI: false };

  const budget = Math.max(1, Math.min(FOLD_BATCH, live - keep));
  const fold = await listOldestMemories(ids, ['episode'], budget);

  // Second tier: in a 1000-turn saga the curated facts alone can overflow the
  // retrieval pool, so the oldest ones are folded in as well (never deleted).
  const liveFacts = await countMemories([playthroughId], FACT_KINDS);
  if (liveFacts > MAX_LIVE_FACTS) {
    const extra = await listOldestMemories([playthroughId], FACT_KINDS, FOLD_BATCH);
    fold.push(...extra);
  }
  if (!fold.length) return { folded: 0, summaryChars: 0, usedAI: false };

  const prev = await getSummary(playthroughId);
  const facts = fold.map((f) => `- ${f.text}`).join('\n');
  let digest = '';
  let usedAI = false;
  if (summarize) {
    try {
      const raw = await summarize(
        `You compress an interactive story's history into one terse digest.\n` +
          `Merge the EXISTING DIGEST with the NEW LOG LINES. Max ${SUMMARY_MAX_CHARS} characters.\n` +
          `Keep: who is who, promises made, betrayals, items, injuries, secrets revealed, ` +
          `relationship shifts, unresolved threads, reader choices.\n` +
          `Never invent, never drop a named character, never quote dialogue at length.\n` +
          `Plain bullet lines, no markdown headers.\n\n` +
          `EXISTING DIGEST:\n${prev || '(none)'}\n\nNEW LOG LINES:\n${facts}\n\n` +
          `Return the merged digest only.`,
      );
      if (raw && raw.trim().length > 20) {
        digest = sanitize(raw, SUMMARY_MAX_CHARS);
        usedAI = true;
      }
    } catch {
      digest = '';
    }
  }
  if (!digest) digest = mergeDigestFallback(prev, fold);
  if (!digest) return { folded: 0, summaryChars: 0, usedAI: false };

  await setSummary(playthroughId, digest);
  await archiveMemories(fold.map((f) => f.id));
  return { folded: fold.length, summaryChars: digest.length, usedAI };
}

/** No-AI path: append folded lines to the existing digest, oldest lines evicted first. */
function mergeDigestFallback(prev: string, fold: MemoryEntry[]): string {
  const tail = buildDigestFallback(fold, SUMMARY_MAX_CHARS);
  if (!prev) return tail.slice(0, SUMMARY_MAX_CHARS);
  let head = prev;
  while (head.length + tail.length + 1 > SUMMARY_MAX_CHARS) {
    const nl = head.indexOf('\n');
    if (nl < 0) {
      head = head.slice(0, Math.max(0, SUMMARY_MAX_CHARS - tail.length - 1));
      break;
    }
    head = head.slice(nl + 1); // drop the oldest digest line to make room
  }
  return `${head}\n${tail}`.trim().slice(0, SUMMARY_MAX_CHARS);
}
