/**
 * The first chat messages of a new journey: the story's opening moment.
 *
 * Kissa has no scripted / offline storytelling — everything after these
 * lines is written live by the reader's own AI provider. This only turns the
 * opening scene's narration into the messages saved when a story starts
 * (with {{playerName}} resolved to the reader's name, or the default name
 * when none is set; character names are never replaced).
 */
import type { ChatMessage, StoryBundle } from '../types';
import { interpolatePlayerName } from './playerName';

export type OpeningMessage = Pick<ChatMessage, 'role' | 'speaker' | 'text' | 'sceneId'>;

export function openingMessages(bundle: StoryBundle, playerName?: string | null): OpeningMessage[] {
  const scene =
    bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId) ?? bundle.scenes.scenes[0];
  if (!scene) return [];
  const options = { protectedNames: bundle.characters.characters.map((c) => c.name) };
  return (scene.narration ?? []).map((raw, i) => ({
    role: i === 0 ? 'narration' : 'assistant',
    speaker: null,
    text: interpolatePlayerName(raw, playerName, options),
    sceneId: scene.id,
  }));
}
