/**
 * KISSA v2.7.0 — STAGE 1 chapters ("kitaab jaisi summary").
 *
 * The rolling digest (memory.ts) is the whole-story summary. Chapters keep the
 * detail a single digest must squeeze out: whenever a scene ends — or a long
 * scene passes CHAPTER_EVERY_TURNS without ending — the turns since the last
 * chapter are summarised into one short chapter entry. The prompt shows the
 * newest few chapters next to the digest.
 *
 * Storage is one local kv row per journey. Raw messages are never deleted, so
 * a chapter can always be rebuilt.
 */
import { kvDelete, kvGet, kvSet } from './db';
import { sanitizeStoredText } from './leakGuard';
import type { ChatMessage } from '../types';

export interface Chapter {
  title: string;
  text: string;
  /** messageCount of the journey when the chapter closed. */
  atTurn: number;
  sceneId: string | null;
  createdAt: string;
}

interface ChapterStore {
  chapters: Chapter[];
  /** messageCount at which the last chapter closed (start of the current one). */
  lastClosedAt: number;
}

export const CHAPTER_EVERY_TURNS = 24;
export const MAX_CHAPTERS = 16;
export const CHAPTER_MAX_CHARS = 520;

const KEY = (playthroughId: string) => `memchap:${playthroughId}`;

async function load(playthroughId: string): Promise<ChapterStore> {
  try {
    const raw = await kvGet(KEY(playthroughId));
    if (!raw) return { chapters: [], lastClosedAt: 0 };
    const parsed = JSON.parse(raw) as ChapterStore;
    if (!Array.isArray(parsed.chapters)) return { chapters: [], lastClosedAt: 0 };
    return { chapters: parsed.chapters, lastClosedAt: Number(parsed.lastClosedAt) || 0 };
  } catch {
    return { chapters: [], lastClosedAt: 0 };
  }
}

export async function getChapters(playthroughId: string): Promise<Chapter[]> {
  return (await load(playthroughId)).chapters;
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
    const chapters = [...store.chapters, chapter].slice(-MAX_CHAPTERS);
    await kvSet(KEY(input.playthroughId), JSON.stringify({ chapters, lastClosedAt: input.messageCount }));
    return chapter;
  } catch {
    return null;
  }
}
