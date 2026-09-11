/**
 * Offline Story Mode — a REAL scripted storyteller (not fake AI).
 * Used automatically when the user has no AI provider configured, and
 * any time the user switches a playthrough to offline mode.
 *
 * It walks the story's own scenes.json: narration, choices, effects,
 * keyword-matched free text with fallback lines, and true endings.
 */
import type { Playthrough, StoryBundle, StoryState } from '../types';
import { applyEffects, availableChoices, getScene, matchChoice } from './engine';

export interface OfflineLine {
  role: 'assistant' | 'narration';
  speaker: string | null;
  text: string;
}

export interface OfflineStep {
  lines: OfflineLine[];
  newSceneId: string;
  sceneChanged: boolean;
  ended: boolean;
  endingId: string | null;
  matchedChoiceId: string | null;
}

/**
 * Produce the opening lines for a fresh playthrough (scene narration).
 * Mutates nothing — the caller persists messages + visits.
 */
export function offlineOpening(bundle: StoryBundle): { lines: OfflineLine[]; sceneId: string } {
  const scene = getScene(bundle, bundle.story.openingSceneId);
  return {
    sceneId: scene.id,
    lines: scene.narration.map((text, i) => ({
      role: i === 0 ? ('narration' as const) : ('assistant' as const),
      speaker: null,
      text,
    })),
  };
}

/**
 * Advance the story by one user turn in offline mode.
 * Pure w.r.t. the passed playthrough (returns new state; caller saves).
 */
export function offlineStep(
  bundle: StoryBundle,
  playthrough: Playthrough,
  userText: string,
): { step: OfflineStep; state: StoryState } {
  const scene = getScene(bundle, playthrough.currentSceneId);
  const choices = availableChoices(scene, playthrough.state);

  // Ending scenes: nothing more to do.
  if (scene.isEnding) {
    return {
      step: {
        lines: [
          {
            role: 'narration',
            speaker: null,
            text: '✨ Kahani yahin poori hoti hai. Replay karke doosri endings bhi try karo!',
          },
        ],
        newSceneId: scene.id,
        sceneChanged: false,
        ended: true,
        endingId: scene.endingId ?? null,
        matchedChoiceId: null,
      },
      state: playthrough.state,
    };
  }

  const matched = matchChoice(userText, choices);
  if (!matched) {
    // Genuine fallback: rotate fallback lines, re-offer choices as chips.
    const fallbacks = scene.fallbackLines.length
      ? scene.fallbackLines
      : ['Hmm... kuch aur try karo.'];
    const idx = playthrough.messageCount % fallbacks.length;
    return {
      step: {
        lines: [{ role: 'assistant', speaker: null, text: fallbacks[idx] }],
        newSceneId: scene.id,
        sceneChanged: false,
        ended: false,
        endingId: null,
        matchedChoiceId: null,
      },
      state: playthrough.state,
    };
  }

  let state = applyEffects(playthrough.state, matched.effects);
  const targetSceneId = matched.effects?.scene ?? matched.next ?? scene.id;
  const nextScene = getScene(bundle, targetSceneId);

  state = {
    ...state,
    visits: { ...state.visits, [nextScene.id]: (state.visits[nextScene.id] ?? 0) + 1 },
  };

  const lines: OfflineLine[] = nextScene.narration.map((text) => ({
    role: 'assistant' as const,
    speaker: null,
    text,
  }));

  const endId = matched.effects?.endStory ?? (nextScene.isEnding ? nextScene.endingId ?? null : null);

  return {
    step: {
      lines,
      newSceneId: nextScene.id,
      sceneChanged: nextScene.id !== scene.id,
      ended: !!endId,
      endingId: endId,
      matchedChoiceId: matched.id,
    },
    state,
  };
}

/**
 * Apply a tapped choice chip directly (no keyword matching needed).
 */
export function offlineChoose(
  bundle: StoryBundle,
  playthrough: Playthrough,
  choiceId: string,
): { step: OfflineStep; state: StoryState } | null {
  const scene = getScene(bundle, playthrough.currentSceneId);
  const choice = availableChoices(scene, playthrough.state).find((c) => c.id === choiceId);
  if (!choice) return null;
  // Reuse offlineStep by feeding the exact choice text (guaranteed match).
  return offlineStep(bundle, playthrough, choice.text);
}
