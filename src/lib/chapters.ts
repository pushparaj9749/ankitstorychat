/**
 * KISSA v2.7.0 — STAGE 1 chapters ("kitaab jaisi summary").
 *
 * The rolling digest (memory.ts) is the whole-story summary. Chapters keep the
 * detail a single digest must squeeze out: whenever a scene ends — or a long
 * scene passes CHAPTER_EVERY_TURNS without ending — the turns since the last
 * chapter are summarised into one short chapter entry. The prompt shows the
 * newest few chapters next to the digest.
 *
 * v2.11.0 SAGA ("the book so far"): chapters are never thrown away any more.
 * Once more than PROMPT_CHAPTERS are closed, the older ones are folded into a
 * saga — one bounded whole-journey story told in order — and moved to an
 * archive that recall can still search ("yaad hai jab…"). So a 1000-turn
 * journey keeps its beginning, its middle and its latest chapters.
 *
 * Storage is one local kv row per journey. Raw messages are never deleted, so
 * a chapter can always be rebuilt.
 */
import { kvDelete, kvGet, kvSet } from './db';
import { sanitizeStoredText } from './leakGuard';
import { keywordSet } from './storyMemoryCore';
import type { ChatMessage } from '../types';

export interface Chapter {
  title: string;
  text: string;
  /** messageCount of the journey when the chapter closed. */
  atTurn: number;
  sceneId: string | null;
  createdAt: string;
}

/** v2.11.0 — the whole journey before the recent chapters, told in order. */
export interface Saga {
  text: string;
  /** atTurn of the newest chapter folded into the saga. */
  coversThroughAtTurn: number;
  /** How many chapters the saga covers. */
  chapterCount: number;
  updatedAt: string;
}

interface ChapterStore {
  /** Recent chapters (shown in full in the prompt). */
  chapters: Chapter[];
  /** messageCount at which the last chapter closed (start of the current one). */
  lastClosedAt: number;
  saga?: Saga | null;
  /** Folded chapters, oldest first — kept for deep recall, never prompted whole. */
  archive?: Chapter[];
}

export const CHAPTER_EVERY_TURNS = 24;
/** Safety cap for the recent list (folding normally keeps it at PROMPT_CHAPTERS). */
export const MAX_CHAPTERS = 16;
export const CHAPTER_MAX_CHARS = 520;
/** Chapters shown in full next to the saga. */
export const PROMPT_CHAPTERS = 4;
/**
 * Fold as soon as a chapter would fall out of the prompt's recent window, so
 * every closed chapter is always either shown in full or inside the saga.
 */
export const SAGA_FOLD_AT = PROMPT_CHAPTERS + 1;
export const SAGA_MAX_CHARS = 1400;
export const MAX_ARCHIVED_CHAPTERS = 200;

const KEY = (playthroughId: string) => `memchap:${playthroughId}`;

async function load(playthroughId: string): Promise<ChapterStore> {
  try {
    const raw = await kvGet(KEY(playthroughId));
    if (!raw) return { chapters: [], lastClosedAt: 0 };
    const parsed = JSON.parse(raw) as ChapterStore;
    if (!Array.isArray(parsed.chapters)) return { chapters: [], lastClosedAt: 0 };
    const saga = parsed.saga && typeof parsed.saga.text === 'string' && parsed.saga.text.trim() ? parsed.saga : null;
    return {
      chapters: parsed.chapters,
      lastClosedAt: Number(parsed.lastClosedAt) || 0,
      saga,
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    };
  } catch {
    return { chapters: [], lastClosedAt: 0 };
  }
}

export async function getChapters(playthroughId: string): Promise<Chapter[]> {
  return (await load(playthroughId)).chapters;
}

export interface ChapterBook {
  /** Recent chapters, oldest first. */
  chapters: Chapter[];
  saga: Saga | null;
  /** Total chapters ever closed in this journey. */
  total: number;
}

/** Saga + recent chapters for the prompt. */
export async function getChapterBook(playthroughId: string): Promise<ChapterBook> {
  const store = await load(playthroughId);
  return { chapters: store.chapters, saga: store.saga ?? null, total: (store.archive?.length ?? 0) + store.chapters.length };
}

/**
 * Deep recall: the archived (folded) chapters that best match a query, oldest
 * first. Concept-aware keyword overlap, so "pehli date" finds a chapter that
 * says "first date". Returns [] when nothing matches meaningfully.
 */
export function searchChapters(chapters: Chapter[], query: string, max = 2): Chapter[] {
  const q = new Set(keywordSet(query));
  if (!q.size || !chapters.length) return [];
  const scored = chapters
    .map((c, idx) => {
      const kw = keywordSet(`${c.title} ${c.text}`);
      let hits = 0;
      for (const k of kw) if (q.has(k)) hits++;
      return { c, idx, hits };
    })
    .filter((x) => x.hits >= 2)
    .sort((a, b) => b.hits - a.hits || a.idx - b.idx)
    .slice(0, max)
    .sort((a, b) => a.idx - b.idx);
  return scored.map((x) => x.c);
}

export async function searchChapterArchive(playthroughId: string, query: string, max = 2): Promise<Chapter[]> {
  const store = await load(playthroughId);
  return searchChapters(store.archive ?? [], query, max);
}

/** Deterministic saga when no summariser is available: keeps beginning + latest. */
export function fallbackSagaText(previous: string, folded: Chapter[]): string {
  const add = folded.map((c) => `${c.title}: ${c.text.split(/(?<=[.!?\u0964])\s+/)[0] ?? c.text}`.trim()).join(' / ');
  const joined = [previous.trim(), add].filter(Boolean).join(' / ').replace(/\s+/g, ' ');
  if (joined.length <= SAGA_MAX_CHARS) return joined;
  const head = joined.slice(0, Math.floor(SAGA_MAX_CHARS * 0.4));
  const tail = joined.slice(joined.length - Math.floor(SAGA_MAX_CHARS * 0.6) + 5);
  return `${head} … ${tail}`.slice(0, SAGA_MAX_CHARS);
}

async function foldIntoSaga(
  previous: Saga | null | undefined,
  folded: Chapter[],
  input: Pick<CloseChapterInput, 'summarize' | 'castNames' | 'readerName'>,
): Promise<Saga> {
  const prevText = previous?.text ?? '';
  const cast = input.castNames ?? [];
  let text = '';
  if (input.summarize) {
    try {
      const raw = await input.summarize(
        `You keep "the book so far" of an interactive Hinglish story — a long-term memory of the whole journey, told in order. ` +
          `Rewrite it so it ALSO covers the new chapters below. Max ${SAGA_MAX_CHARS} characters, plain sentences, chronological. ` +
          `Never drop: how ${input.readerName || 'the reader'} met each person, relationship turning points (first confession, first kiss, fights, breakups, marriage), ` +
          `promises made/kept/broken, secrets revealed and who knows them, important objects and who holds them, and anything still unresolved. ` +
          `Compress small talk. Roman-script Hinglish or English. No headings, no lists, no quotes.\n\n` +
          `BOOK SO FAR:\n${prevText || '(empty — this is the beginning)'}\n\nNEW CHAPTERS (oldest first):\n` +
          folded.map((c, i) => `${i + 1}. ${c.title}: ${c.text}`).join('\n') +
          `\n\nUpdated book so far:`,
      );
      text = sanitizeStoredText((raw || '').replace(/^\s*(updated\s+)?book so far\s*:\s*/i, ''), cast).replace(/\s+/g, ' ').trim();
    } catch {
      text = '';
    }
  }
  // A summary shorter than what it replaces by a lot is a failed fold.
  if (text.length < 40 || (prevText.length > 400 && text.length < prevText.length * 0.4)) text = fallbackSagaText(prevText, folded);
  return {
    text: text.slice(0, SAGA_MAX_CHARS),
    coversThroughAtTurn: folded[folded.length - 1]?.atTurn ?? previous?.coversThroughAtTurn ?? 0,
    chapterCount: (previous?.chapterCount ?? 0) + folded.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function clearChapters(playthroughId: string): Promise<void> {
  await kvDelete(KEY(playthroughId));
}

/** True when a long scene has gone on long enough to close a chapter anyway. */
export async function chapterDue(playthroughId: string, messageCount: number): Promise<boolean> {
  const store = await load(playthroughId);
  return messageCount - store.lastClosedAt >= CHAPTER_EVERY_TURNS;
}

/** Deterministic fallback: the first narrated beats of the chapter, trimmed. */
export function fallbackChapterText(messages: ChatMessage[], castNames: string[] = []): string {
  const beats: string[] = [];
  for (const m of messages) {
    if (m.role === 'narration') continue;
    const clean = sanitizeStoredText(m.text, castNames).replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    beats.push(m.role === 'user' ? `Reader: ${clean.slice(0, 90)}` : `${m.speaker ? `${m.speaker}: ` : ''}${clean.slice(0, 110)}`);
  }
  // First and last beats carry the shape of a chapter best.
  const picked = beats.length > 6 ? [...beats.slice(0, 3), ...beats.slice(-3)] : beats;
  return picked.join(' / ').slice(0, CHAPTER_MAX_CHARS);
}

export interface CloseChapterInput {
  playthroughId: string;
  title: string;
  sceneId: string | null;
  messageCount: number;
  /** The chapter's messages, oldest first. */
  messages: ChatMessage[];
  castNames?: string[];
  readerName?: string;
  summarize?: (prompt: string) => Promise<string>;
}

/**
 * Close the current chapter: summarise its turns (AI when available, otherwise
 * deterministic) and append it. Never throws.
 */
export async function closeChapter(input: CloseChapterInput): Promise<Chapter | null> {
  try {
    const store = await load(input.playthroughId);
    const turns = input.messages.filter((m) => m.role !== 'narration' && m.text.trim());
    if (turns.length < 2) {
      await kvSet(KEY(input.playthroughId), JSON.stringify({ ...store, lastClosedAt: input.messageCount }));
      return null;
    }
    const cast = input.castNames ?? [];
    let text = '';
    if (input.summarize) {
      const transcript = turns
        .slice(-60)
        .map((m) => {
          const clean = sanitizeStoredText(m.text, cast).replace(/\s+/g, ' ').trim().slice(0, 400);
          return m.role === 'user' ? `${input.readerName || 'Reader'}: ${clean}` : `${m.speaker ? `${m.speaker}: ` : 'Narrator: '}${clean}`;
        })
        .join('\n');
      try {
        const raw = await input.summarize(
          `Summarise this chapter of an interactive Hinglish story in 3-5 short plain sentences (max ${CHAPTER_MAX_CHARS} characters). ` +
            `Chronological. Name who did what, what was promised, revealed or exchanged, and how relationships changed. ` +
            `Roman-script Hinglish or English. No headings, no lists, no quotes.\n\nCHAPTER: ${input.title}\n\n${transcript}\n\nSummary:`,
        );
        text = sanitizeStoredText((raw || '').replace(/^\s*summary\s*:\s*/i, ''), cast).replace(/\s+/g, ' ').trim();
      } catch {
        text = '';
      }
    }
    if (text.length < 20) text = fallbackChapterText(turns, cast);
    const chapter: Chapter = {
      title: input.title.slice(0, 80),
      text: text.slice(0, CHAPTER_MAX_CHARS),
      atTurn: input.messageCount,
      sceneId: input.sceneId,
      createdAt: new Date().toISOString(),
    };
    let chapters = [...store.chapters, chapter];
    let saga = store.saga ?? null;
    let archive = store.archive ?? [];
    if (chapters.length >= SAGA_FOLD_AT) {
      // Fold the oldest chapters into the saga BEFORE they leave the prompt.
      const folded = chapters.slice(0, chapters.length - PROMPT_CHAPTERS);
      saga = await foldIntoSaga(saga, folded, input);
      archive = [...archive, ...folded].slice(-MAX_ARCHIVED_CHAPTERS);
      chapters = chapters.slice(-PROMPT_CHAPTERS);
    }
    chapters = chapters.slice(-MAX_CHAPTERS);
    await kvSet(KEY(input.playthroughId), JSON.stringify({ chapters, lastClosedAt: input.messageCount, saga, archive }));
    return chapter;
  } catch {
    return null;
  }
}
