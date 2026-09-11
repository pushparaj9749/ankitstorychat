/**
 * Story engine — pure logic (unit-testable, no RN imports).
 * - Builds the AI narrator prompt from story bible + state + memory.
 * - Parses assistant output (display text + kissa-state effects block).
 * - Applies effects to story state deterministically.
 * - Matches free text to choices (smart replies / offline mode).
 */
import type {
  AgeGroup,
  ChatMessage,
  ChoiceEffects,
  LocalProfile,
  MemoryEntry,
  Playthrough,
  SceneChoice,
  StoryBundle,
  StoryScene,
  StoryState,
} from '../types';
import { createInitialState } from '../types';
import { teenSafetyGuidance } from './ageGate';
import { clamp, norm, tokens } from './utils';

/* ---------------- scene helpers ---------------- */

export function getScene(bundle: StoryBundle, sceneId: string): StoryScene {
  const scene = bundle.scenes.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    // Never crash on a bad scene id — fall back to the opening scene.
    const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId);
    return opening ?? bundle.scenes.scenes[0];
  }
  return scene;
}

/** requiresFlag syntax: "flag" (truthy) or "!flag" (falsy). Undefined = always. */
export function flagHolds(requiresFlag: string | undefined, flags: StoryState['flags']): boolean {
  if (!requiresFlag) return true;
  if (requiresFlag.startsWith('!')) return !flags[requiresFlag.slice(1)];
  return !!flags[requiresFlag];
}

export function availableChoices(scene: StoryScene, state: StoryState): SceneChoice[] {
  return (scene.choices ?? []).filter((c) => flagHolds(c.requiresFlag, state.flags));
}

/* ---------------- effects ---------------- */

export function applyEffects(state: StoryState, effects?: ChoiceEffects): StoryState {
  if (!effects) return state;
  const next: StoryState = {
    relationships: { ...state.relationships },
    inventory: [...state.inventory],
    location: state.location,
    flags: { ...state.flags },
    choices: { ...state.choices },
    visits: { ...state.visits },
  };
  if (effects.relationships) {
    for (const [k, delta] of Object.entries(effects.relationships)) {
      next.relationships[k] = clamp((next.relationships[k] ?? 50) + delta, 0, 100);
    }
  }
  if (effects.flags) Object.assign(next.flags, effects.flags);
  if (effects.choicesRecord) Object.assign(next.choices, effects.choicesRecord);
  for (const item of effects.inventoryAdd ?? []) {
    if (!next.inventory.includes(item)) next.inventory.push(item);
  }
  if (effects.inventoryRemove?.length) {
    next.inventory = next.inventory.filter((i) => !effects.inventoryRemove!.includes(i));
  }
  if (effects.location) next.location = effects.location;
  return next;
}

export function freshStateFor(bundle: StoryBundle): StoryState {
  const s = createInitialState();
  const first = bundle.world.locations[0];
  if (first) s.location = first.name;
  return s;
}

/* ---------------- response parsing ---------------- */

/** The AI reports state changes in a fenced block the user never sees. */
const STATE_BLOCK_RE = /```kissa-state\s*([\s\S]*?)```/gi;

export interface ParsedAssistant {
  displayText: string;
  effects?: ChoiceEffects;
  memoryNotes: string[];
  speaker: string | null;
}

function parseStateBlock(jsonText: string): ChoiceEffects | undefined {
  try {
    const obj = JSON.parse(jsonText.trim()) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return undefined;
    const effects: ChoiceEffects = {};
    if (obj.relationships && typeof obj.relationships === 'object') {
      effects.relationships = {};
      for (const [k, v] of Object.entries(obj.relationships as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) effects.relationships[k] = v;
      }
    }
    if (obj.flags && typeof obj.flags === 'object') {
      effects.flags = {};
      for (const [k, v] of Object.entries(obj.flags as Record<string, unknown>)) {
        if (v === null) continue;
        if (['string', 'number', 'boolean'].includes(typeof v)) {
          (effects.flags as Record<string, string | number | boolean>)[k] = v as
            | string
            | number
            | boolean;
        }
      }
    }
    if (obj.choicesRecord && typeof obj.choicesRecord === 'object') {
      effects.choicesRecord = {};
      for (const [k, v] of Object.entries(obj.choicesRecord as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'boolean') effects.choicesRecord[k] = v;
      }
    }
    if (Array.isArray(obj.inventoryAdd)) {
      effects.inventoryAdd = obj.inventoryAdd.filter((x): x is string => typeof x === 'string');
    }
    if (Array.isArray(obj.inventoryRemove)) {
      effects.inventoryRemove = obj.inventoryRemove.filter((x): x is string => typeof x === 'string');
    }
    if (typeof obj.location === 'string') effects.location = obj.location;
    if (typeof obj.scene === 'string') effects.scene = obj.scene;
    if (typeof obj.endStory === 'string') effects.endStory = obj.endStory;
    if (Array.isArray(obj.memory)) {
      effects.memory = obj.memory.filter((x): x is string => typeof x === 'string').slice(0, 5);
    }
    return effects;
  } catch {
    return undefined;
  }
}

/** Split raw assistant output into display text + hidden effects + speaker. */
export function parseAssistantResponse(raw: string): ParsedAssistant {
  let displayText = raw || '';
  let effects: ChoiceEffects | undefined;
  const memoryNotes: string[] = [];

  // Extract (possibly multiple) state blocks; merge them.
  const merged: ChoiceEffects = {};
  let found = false;
  displayText = displayText.replace(STATE_BLOCK_RE, (_m, jsonText: string) => {
    const parsed = parseStateBlock(jsonText);
    if (parsed) {
      found = true;
      if (parsed.relationships) {
        merged.relationships = { ...(merged.relationships ?? {}) };
        for (const [k, v] of Object.entries(parsed.relationships)) {
          merged.relationships[k] = (merged.relationships[k] ?? 0) + v;
        }
      }
      if (parsed.flags) merged.flags = { ...(merged.flags ?? {}), ...parsed.flags };
      if (parsed.choicesRecord) {
        merged.choicesRecord = { ...(merged.choicesRecord ?? {}), ...parsed.choicesRecord };
      }
      if (parsed.inventoryAdd) merged.inventoryAdd = [...(merged.inventoryAdd ?? []), ...parsed.inventoryAdd];
      if (parsed.inventoryRemove) {
        merged.inventoryRemove = [...(merged.inventoryRemove ?? []), ...parsed.inventoryRemove];
      }
      if (parsed.location) merged.location = parsed.location;
      if (parsed.scene) merged.scene = parsed.scene;
      if (parsed.endStory) merged.endStory = parsed.endStory;
      if (parsed.memory) memoryNotes.push(...parsed.memory.slice(0, 5));
    }
    return '';
  });
  if (found) effects = merged;

  displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();

  // Speaker detection: leading "Name:" line.
  let speaker: string | null = null;
  const m = displayText.match(/^([A-Z][A-Za-z.'\- ]{1,24}):\s*/);
  if (m) {
    speaker = m[1].trim();
    displayText = displayText.slice(m[0].length).trim();
  }

  return { displayText, effects, memoryNotes, speaker };
}

/* ---------------- free-text -> choice matching ---------------- */

/**
 * Score free text against scene choices by keyword overlap.
 * Returns the best match when confident, else null.
 */
export function matchChoice(freeText: string, choices: SceneChoice[]): SceneChoice | null {
  const input = norm(freeText);
  if (!input || choices.length === 0) return null;
  const inputTokens = new Set(tokens(freeText));

  let best: SceneChoice | null = null;
  let bestScore = 0;
  for (const c of choices) {
    let score = 0;
    const hay = `${c.text} ${(c.keywords ?? []).join(' ')}`.toLowerCase();
    // Direct phrase containment is a strong signal.
    if (c.text && input.includes(norm(c.text).slice(0, 24))) score += 4;
    for (const kw of c.keywords ?? []) {
      const k = norm(kw);
      if (!k) continue;
      if (input.includes(k)) score += k.length >= 5 ? 3 : 2;
      else if (inputTokens.has(k)) score += 2;
    }
    // Token overlap with the choice text itself.
    for (const t of tokens(hay)) {
      if (inputTokens.has(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 3 ? best : null;
}

/* ---------------- prompt building ---------------- */

function stateDigest(state: StoryState): string {
  const parts: string[] = [];
  const rel = Object.entries(state.relationships);
  if (rel.length) {
    parts.push(`Relationships (0-100): ${rel.map(([k, v]) => `${k}=${Math.round(v)}`).join(', ')}`);
  }
  if (state.inventory.length) parts.push(`Inventory: ${state.inventory.join(', ')}`);
  if (state.location) parts.push(`Location: ${state.location}`);
  const flags = Object.entries(state.flags).filter(([, v]) => v !== false);
  if (flags.length) parts.push(`Flags: ${flags.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  const ch = Object.entries(state.choices);
  if (ch.length) parts.push(`Past choices: ${ch.map(([k, v]) => `${k}→${v}`).join('; ')}`);
  return parts.length ? parts.join('\n') : '(fresh story — nothing happened yet)';
}

function sceneDigest(scene: StoryScene): string {
  const lines = [
    `Current scene: ${scene.title} (id: ${scene.id})`,
    `Scene setup: ${scene.narration.join(' ')}`,
  ];
  if (scene.choices?.length) {
    lines.push(
      `Available directions the story can go: ${scene.choices.map((c) => `"${c.text}"`).join(' | ')}`,
    );
  }
  if (scene.isEnding) lines.push('This is an ENDING scene — wrap the story up warmly.');
  return lines.join('\n');
}

export interface PromptInput {
  bundle: StoryBundle;
  profile: LocalProfile;
  playthrough: Playthrough;
  memories: MemoryEntry[];
  /** Recent history, oldest-first. */
  history: ChatMessage[];
}

export function buildSystemPrompt(input: PromptInput, ageGroup: AgeGroup): string {
  const { bundle, profile, playthrough, memories } = input;
  const scene = getScene(bundle, playthrough.currentSceneId);

  const charCards = bundle.characters.characters
    .map(
      (c) =>
        `- ${c.name} (${c.role}): ${c.personality} Speaks like: ${c.speakingStyle} Example: "${c.sampleLine}" Goals: ${c.goals.join('; ')}. Knows: ${c.knowledge.join('; ')}.`,
    )
    .join('\n');

  const memLines =
    memories.length > 0
      ? memories.map((m) => `- [${m.kind}] ${m.text}`).join('\n')
      : bundle.memory.seedMemories.map((m) => `- ${m}`).join('\n');

  const teenBlock =
    ageGroup === '12-17'
      ? `\nSAFETY (reader is 12-17):\n${teenSafetyGuidance()}\n${bundle.story.safetyNotes.map((s) => `- ${s}`).join('\n')}`
      : `\nCONTENT NOTES:\n${bundle.story.safetyNotes.map((s) => `- ${s}`).join('\n')}`;

  return `You are the narrator and ALL characters of an interactive Hinglish story-chat game called Kissa.

STORY: ${bundle.story.title}
PREMISE: ${bundle.world.premise}
TONE: ${bundle.story.tone}
READER PLAYS AS: ${bundle.story.userRole}. The reader's name is "${profile.nickname}" — address them by name sometimes, naturally.
SETTING: ${bundle.story.setting}

LANGUAGE: Hinglish — natural conversational Hindi + English in ROMAN script (like Indian friends chat). NEVER use Devanagari script. Dialogue and narration both in Hinglish. Example: "Arre, tum yahan itni raat ko kya kar rahe ho? Bro, situation serious hai."

CHARACTERS (stay in character, distinct voices):
${charCards}

WORLD RULES (NEVER break these):
${bundle.world.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
LORE: ${bundle.world.lore.join(' | ')}

${sceneDigest(scene)}

STORY STATE SO FAR:
${stateDigest(playthrough.state)}

WHAT YOU REMEMBER ABOUT THIS READER'S JOURNEY:
${memLines}
${teenBlock}

HOW TO RESPOND:
1. Continue the story immersively: short narration + character dialogue. Keep replies tight (roughly 60-160 words), ending with a hook or a situation that invites the reader's next move.
2. Respect the current scene and its available directions; do NOT teleport the plot or invent contradicting events. If the reader does something wild, react believably and steer back toward the scene.
3. NEVER speak as the reader. NEVER decide the reader's actions for them.
4. When addressing the reader, use "${profile.nickname}" occasionally.
5. After your visible reply, append a hidden state block ONLY when something changed (relationship shift, item gained/lost, location change, important flag, scene move, story end). Format exactly:
\`\`\`kissa-state
{"relationships": {"characterId": +5}, "flags": {"gateOpened": true}, "inventoryAdd": ["item-id"], "location": "Place name", "scene": "next-scene-id", "endStory": "ending-id", "memory": ["short fact to remember"]}
\`\`\`
Omit keys that didn't change. "scene" must be one of the story's scene ids (or omit to stay). "endStory" only at a true ending. Keep memory facts short (under 140 chars).
6. If the reader greets you out-of-story ("hi", "hello"), stay in character briefly and pull them back into the scene.`;
}

export interface BuiltContext {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

/**
 * Context selection: seed + relevant memories go in the system prompt;
 * the last N messages (story's shortTermWindow) go as chat history.
 * Full lifetime history is NEVER sent.
 */
export function buildContext(input: PromptInput, ageGroup: AgeGroup): BuiltContext {
  const windowSize = Math.max(4, Math.min(40, input.bundle.memory.shortTermWindow || 14));
  const history = input.history.slice(-windowSize);
  const messages: BuiltContext['messages'] = [];
  for (const m of history) {
    if (m.role === 'user') messages.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: m.speaker ? `${m.speaker}: ${m.text}` : m.text,
      });
    } else if (m.role === 'narration') {
      // Feed narration as compact assistant context.
      messages.push({ role: 'assistant', content: `[Scene] ${m.text}` });
    }
  }
  return { system: buildSystemPrompt(input, ageGroup), messages };
}

/* ---------------- progress ---------------- */

export function progressEstimate(bundle: StoryBundle, playthrough: Playthrough): number {
  const total = Math.max(1, bundle.scenes.scenes.length);
  const visited = Object.keys(playthrough.state.visits ?? {}).length;
  const byScenes = clamp(visited / total, 0, 1);
  // Blend with message activity so long chats also move the bar.
  const byMsgs = clamp(playthrough.messageCount / 60, 0, 1);
  return clamp(byScenes * 0.75 + byMsgs * 0.25, 0, 1);
}
