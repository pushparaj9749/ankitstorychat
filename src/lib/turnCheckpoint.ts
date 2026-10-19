/**
 * KISSA v2.7 — Regenerate that really rewinds.
 *
 * Before every story-writing turn the journey's memory (facts, digest,
 * chapters, world state, relationships, character knowledge, archive events,
 * playthrough state) is snapshotted. "Regenerate" on that turn's reply puts
 * all of it back, drops the old reply, and runs the same turn again — so a
 * discarded take can never leave a fact, an object hand-over or a bond change
 * behind in memory.
 *
 * Only the latest turn is kept (Regenerate only ever applies to the last reply).
 */
import { kvDelete, kvGet, kvSet, restoreJourney, snapshotJourney, type JourneySnapshot } from './db';

export interface CheckpointRequest {
  kind: 'message' | 'scene' | 'continue';
  prompt: string;
  primaryUserText?: string;
  instruction?: string;
}

export interface TurnCheckpoint {
  v: 1;
  request: CheckpointRequest;
  snapshot: JourneySnapshot;
  /** Transcript rows written by this turn's reply (filled once the reply is saved). */
  replyIds: string[];
}

const KEY = (playthroughId: string) => `turnckpt:${playthroughId}`;

export async function saveTurnCheckpoint(playthroughId: string, request: CheckpointRequest): Promise<void> {
  const snapshot = await snapshotJourney(playthroughId);
  const ck: TurnCheckpoint = { v: 1, request, snapshot, replyIds: [] };
  await kvSet(KEY(playthroughId), JSON.stringify(ck));
}

export async function attachReplyIds(playthroughId: string, ids: string[]): Promise<void> {
  const ck = await getTurnCheckpoint(playthroughId);
  if (!ck) return;
  ck.replyIds = ids;
  await kvSet(KEY(playthroughId), JSON.stringify(ck));
}

export async function getTurnCheckpoint(playthroughId: string): Promise<TurnCheckpoint | null> {
  const raw = await kvGet(KEY(playthroughId));
  if (!raw) return null;
  try {
    const ck = JSON.parse(raw) as TurnCheckpoint;
    return ck && ck.v === 1 && ck.snapshot && Array.isArray(ck.replyIds) ? ck : null;
  } catch {
    return null;
  }
}

/** True when `assistantId` is the reply the stored checkpoint can rewind. */
export function checkpointCovers(ck: TurnCheckpoint | null, assistantId: string | undefined): ck is TurnCheckpoint {
  return !!ck && !!assistantId && ck.replyIds.length > 0 && ck.replyIds.includes(assistantId);
}

/** Rewind the journey to just before the checkpointed turn and drop its reply. */
export async function rollbackTurn(playthroughId: string, ck: TurnCheckpoint): Promise<void> {
  await restoreJourney(playthroughId, ck.snapshot, ck.replyIds);
  await kvDelete(KEY(playthroughId));
}
