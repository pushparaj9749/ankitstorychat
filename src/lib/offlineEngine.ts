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
import { isFullyFadedLine, splitSpeakerLine, stripStoryMarkup } from './markup';
import { interpolatePlayerName } from './playerName';

export interface OfflineLine {
  role: 'assistant' | 'narration';
  speaker: string | null;
  text: string;
}

/**
 * Turn raw scene lines into chat lines using the Kissa story format:
 *   "*Action text.*"          -> narration line (rendered faded in the UI)
 *   "Myra: \"dialogue\""      -> dialogue line spoken by Myra
 *   plain text                -> dialogue line from the narrator
 *
 * @param playerName the reader's name — {{playerName}} placeholders (and
 *        legacy hardcoded player names) in scene text resolve to it.
 *        Character names are never replaced.
 */
export function toOfflineLines(
  bundle: StoryBundle,
  rawLines: string[],
  playerName?: string | null,
): OfflineLine[] {
  const names = bundle.characters.characters.map((c) => c.name);
  const options = { protectedNames: names };
  const out: OfflineLine[] = [];
  for (const raw of rawLines ?? []) {
    let line = (raw ?? '').trim();
    if (!line) continue;
    if (playerName) line = interpolatePlayerName(line, playerName, options);
    if (isFullyFadedLine(line)) {
      out.push({ role: 'narration', speaker: null, text: stripStoryMarkup(line) });
      continue;
    }
    const { speaker, text } = splitSpeakerLine(line, names);
    out.push({ role: 'assistant', speaker, text: text || line });
  }
  return out;
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
 *
 * Every line follows the same story format, so the opening block reads exactly
 * like the rest of the conversation: faded *action* lines and Name: "dialogue".
 */
export function offlineOpening(
  bundle: StoryBundle,
  playerName?: string | null,
): { lines: OfflineLine[]; sceneId: string } {
  const scene = getScene(bundle, bundle.story.openingSceneId);
  return {
    sceneId: scene.id,
    lines: toOfflineLines(bundle, scene.narration, playerName),
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
  playerName?: string | null,
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
        lines: toOfflineLines(bundle, [fallbacks[idx]], playerName),
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

  const lines: OfflineLine[] = toOfflineLines(bundle, nextScene.narration, playerName);

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
  playerName?: string | null,
): { step: OfflineStep; state: StoryState } | null {
  const scene = getScene(bundle, playthrough.currentSceneId);
  const choice = availableChoices(scene, playthrough.state).find((c) => c.id === choiceId);
  if (!choice) return null;
  // Reuse offlineStep by feeding the exact choice text (guaranteed match).
  return offlineStep(bundle, playthrough, choice.text, playerName);
}
