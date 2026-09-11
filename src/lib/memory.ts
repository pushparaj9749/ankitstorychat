/**
 * Local memory architecture.
 * - Short-term: recent messages (sliding window, see engine.buildContext).
 * - Story / character / world / preference memories: MemoryEntry rows.
 * - Selection: importance + keyword overlap with the current conversation.
 */
import type { MemoryEntry, MemoryKind, Playthrough } from '../types';
import { insertMemory, listMemories } from './db';
import { tokens, uid, nowIso } from './utils';

export async function remember(
  playthroughId: string,
  kind: MemoryKind,
  text: string,
  importance = 1,
): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: uid('mem'),
    playthroughId,
    kind,
    text: text.slice(0, 500),
    importance,
    createdAt: nowIso(),
  };
  await insertMemory(entry);
  return entry;
}

export async function rememberMany(
  playthroughId: string,
  notes: string[],
  kind: MemoryKind = 'story',
  importance = 1,
): Promise<void> {
  for (const n of notes.slice(0, 5)) {
    if (n && n.trim()) await remember(playthroughId, kind, n.trim(), importance);
  }
}

/**
 * Pick the most relevant memories for the current turn.
 * Score = importance weight + keyword overlap with recent user text.
 */
export function selectMemories(
  all: MemoryEntry[],
  recentUserText: string,
  limit = 12,
): MemoryEntry[] {
  const query = new Set(tokens(recentUserText));
  const scored = all.map((m) => {
    let score = m.importance * 2;
    if (query.size) {
      const mt = tokens(m.text);
      let overlap = 0;
      for (const t of mt) if (query.has(t)) overlap++;
      score += overlap * 3;
    }
    // Recency nudge via createdAt order is handled by stable sort below.
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.m);
}

/** Heuristic extraction from a user turn (no AI needed, runs offline). */
export function extractPreferenceNotes(userText: string): string[] {
  const notes: string[] = [];
  const t = userText.toLowerCase();
  const like = t.match(/(?:mujhe|mere ko|i (?:really )?like|i love|my favou?rite is)\s+([^.,!?]{3,60})/);
  if (like) notes.push(`User likes ${like[1].trim()}.`);
  const name = t.match(/(?:call me|mujhe)\s+([a-zA-Z]{2,20})\s+(?:kaho|bulao|call)/);
  if (name) notes.push(`User asked to be called "${name[1]}".`);
  const dislike = t.match(/(?:mujhe|i (?:really )?don't like|i hate)\s+([^.,!?]{3,60})\s+(?:pasand nahi|nahi pasand)/);
  if (dislike) notes.push(`User dislikes ${dislike[1].trim()}.`);
  return notes;
}

export async function seedMemoriesIfEmpty(
  playthrough: Playthrough,
  seed: string[],
): Promise<void> {
  const existing = await listMemories(playthrough.id, 1);
  if (existing.length > 0) return;
  await rememberMany(playthrough.id, seed, 'story', 2);
}
