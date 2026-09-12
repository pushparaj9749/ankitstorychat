/** Playthrough lifecycle helpers. */
import type { Playthrough, StoryBundle } from '../types';
import { freshStateFor } from './engine';
import { insertPlaythrough, updatePlaythrough } from './db';
import { nowIso, uid } from './utils';

export async function createPlaythrough(
  bundle: StoryBundle,
  label: string,
  mode: 'ai',
  providerId: string | null,
): Promise<Playthrough> {
  const now = nowIso();
  const opening = bundle.story.openingSceneId;
  const state = freshStateFor(bundle);
  state.visits = { [opening]: 1 };
  const p: Playthrough = {
    id: uid('pt'),
    storyId: bundle.meta.id,
    label,
    status: 'active',
    currentSceneId: opening,
    state,
    progress: 0,
    messageCount: 0,
    endingId: null,
    mode,
    providerId,
    createdAt: now,
    updatedAt: now,
  };
  await insertPlaythrough(p);
  return p;
}

export async function touchPlaythrough(p: Playthrough): Promise<Playthrough> {
  const next = { ...p, updatedAt: nowIso() };
  await updatePlaythrough(next);
  return next;
}

export async function completePlaythrough(p: Playthrough, endingId: string | null): Promise<Playthrough> {
  const next: Playthrough = {
    ...p,
    status: 'completed',
    progress: 1,
    endingId,
    updatedAt: nowIso(),
  };
  await updatePlaythrough(next);
  return next;
}

export function playthroughLabel(count: number): string {
  return count === 0 ? 'First journey' : `Journey ${count + 1}`;
}
