/**
 * Story engine — pure logic (unit-testable, no RN imports).
 * - Builds the AI narrator prompt from story bible + state + memory.
 * - Parses assistant output (display text + kissa-state effects block).
 * - Applies effects to story state deterministically.
 * - Matches free text to choices (smart replies).
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
import { isFullyFadedLine, matchSpeakerPrefix } from './markup';
import { MAX_MEMORY_NOTES, renderMemoryLine } from './memoryCore';
import { interpolatePlayerName } from './playerName';
import { clamp, norm, tokens } from './utils';
import type { WorldState } from './worldState';

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

/**
 * KISSA v2.4.2 — Robust internal state parser.
 *
 * Pipeline:
 *  AI RESPONSE
 *    ↓ Detect internal kissa-state block (fenced OR unfenced)
 *    ↓ Extract state
 *    ↓ Validate state
 *    ↓ Persist state using existing Memory/State system (handled outside)
 *    ↓ Remove internal state block
 *    ↓ Render ONLY story content
 *
 * Must handle:
 *  - fenced blocks: ```kissa-state { ... } ```
 *  - unfenced: kissa-state { ... }  / kissa-state\n{ ... }
 *  - whitespace variations, before/after dialogue, multiple blocks
 *  - malformed JSON must NOT leak (suppress)
 *  - normal dialogue containing the words must NOT be removed unless followed by JSON
 */

const FENCED_STATE_RE = /```\s*kissa-state\s*([\s\S]*?)```/gi;

export interface ParsedAssistant {
  displayText: string;
  effects?: ChoiceEffects;
  memoryNotes: string[];
  speaker: string | null;
  worldStateRaw?: unknown;
  rawStateJson?: Record<string, unknown>;
}

function parseStateBlock(jsonText: string): { effects: ChoiceEffects; raw: Record<string, unknown> } | undefined {
  const trimmed = (jsonText || '').trim();
  if (!trimmed) return undefined;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
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
      effects.memory = obj.memory.filter((x): x is string => typeof x === 'string').slice(0, MAX_MEMORY_NOTES);
    }
    return { effects, raw: obj };
  } catch {
    return undefined;
  }
}

/**
 * Extract balanced JSON object starting at `start` (which must be '{').
 * Handles strings and escapes, ignores braces inside strings.
 * Returns null if no balanced closing brace found.
 */
function extractBalancedJson(str: string, start: number): { jsonStr: string; endIdx: number } | null {
  if (str[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"' ) {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { jsonStr: str.slice(start, i + 1), endIdx: i + 1 };
      }
      if (depth < 0) return null;
    }
  }
  return null;
}

/**
 * Merge parsed effects into accumulator.
 */
function mergeEffectsInto(
  target: ChoiceEffects,
  src: ChoiceEffects,
  memoryNotes: string[],
  onRaw: (raw: Record<string, unknown>) => void,
  raw: Record<string, unknown>,
) {
  if (src.relationships) {
    target.relationships = { ...(target.relationships ?? {}) };
    for (const [k, v] of Object.entries(src.relationships)) {
      target.relationships[k] = (target.relationships[k] ?? 0) + v;
    }
  }
  if (src.flags) target.flags = { ...(target.flags ?? {}), ...src.flags };
  if (src.choicesRecord) target.choicesRecord = { ...(target.choicesRecord ?? {}), ...src.choicesRecord };
  if (src.inventoryAdd) target.inventoryAdd = [...(target.inventoryAdd ?? []), ...src.inventoryAdd];
  if (src.inventoryRemove) target.inventoryRemove = [...(target.inventoryRemove ?? []), ...src.inventoryRemove];
  if (src.location) target.location = src.location;
  if (src.scene) target.scene = src.scene;
  if (src.endStory) target.endStory = src.endStory;
  if (src.memory) memoryNotes.push(...src.memory.slice(0, MAX_MEMORY_NOTES));
  onRaw(raw);
}

export function parseAssistantResponse(raw: string): ParsedAssistant {
  let displayText = raw || '';
  const memoryNotes: string[] = [];
  let worldStateRaw: unknown = undefined;
  let rawStateJson: Record<string, unknown> | undefined = undefined;
  const merged: ChoiceEffects = {};
  let foundAnyState = false;

  const setRaw = (r: Record<string, unknown>) => {
    worldStateRaw = r;
    rawStateJson = r;
  };

  // 1) Fenced blocks: ```kissa-state ... ```
  // Remove ALL fenced blocks, even malformed ones, to prevent leakage.
  displayText = displayText.replace(FENCED_STATE_RE, (_full, inner: string) => {
    const trimmedInner = (inner || '').trim();
    // Try to parse; even if fails we suppress the block
    const parsed = parseStateBlock(trimmedInner);
    if (parsed) {
      foundAnyState = true;
      mergeEffectsInto(merged, parsed.effects, memoryNotes, setRaw, parsed.raw);
    } else {
      // Malformed fenced block: attempt generic JSON parse for worldState, but still suppress
      foundAnyState = true;
      try {
        const generic = JSON.parse(trimmedInner) as Record<string, unknown>;
        if (generic && typeof generic === 'object') {
          setRaw(generic);
        }
      } catch {
        // Still suppress, no effects
      }
    }
    return '';
  });

  // 2) Unfenced blocks: kissa-state { ... }
  // Scan repeatedly because removal changes indices.
  // We require "kissa-state" followed within ~300 chars by a "{".
  // If found, extract balanced JSON and remove from displayText.
  let scanPos = 0;
  const lowerMarker = 'kissa-state';
  // Safety counter to avoid infinite loops
  let iterations = 0;
  const maxIterations = 20;

  while (iterations < maxIterations) {
    iterations++;
    const lowerText = displayText.toLowerCase();
    const idx = lowerText.indexOf(lowerMarker, scanPos);
    if (idx === -1) break;

    // Find opening brace after marker
    const braceStart = displayText.indexOf('{', idx);
    if (braceStart === -1 || braceStart - idx > 400) {
      // No JSON nearby — not a state block, move forward
      scanPos = idx + lowerMarker.length;
      continue;
    }

    // Validate that between marker and brace there is only allowed chars: whitespace, colon, dash, newline, maybe "```" remnants
    const between = displayText.slice(idx + lowerMarker.length, braceStart);
    const betweenStripped = between.replace(/[\s:]/g, '');
    // If between contains a lot of alphanumeric content (>30 chars) it's likely normal text mentioning kissa-state
    if (betweenStripped.length > 30) {
      scanPos = idx + lowerMarker.length;
      continue;
    }
    // If between contains letters that are not just whitespace/colon and looks like sentence, skip
    // Heuristic: if between contains a period or more than 3 words, skip
    if (/[a-z]{2,}\.[a-z]/i.test(between) || between.trim().split(/\s+/).filter(Boolean).length > 8) {
      scanPos = idx + lowerMarker.length;
      continue;
    }

    const extracted = extractBalancedJson(displayText, braceStart);
    if (!extracted) {
      // Malformed / unbalanced: try to find next closing brace as fallback and suppress up to there
      const nextClose = displayText.indexOf('}', braceStart);
      if (nextClose !== -1) {
        const jsonPart = displayText.slice(braceStart, nextClose + 1);
        const parsed = parseStateBlock(jsonPart);
        if (parsed) {
          foundAnyState = true;
          mergeEffectsInto(merged, parsed.effects, memoryNotes, setRaw, parsed.raw);
        } else {
          // Attempt generic parse for world state
          try {
            const generic = JSON.parse(jsonPart) as Record<string, unknown>;
            if (generic && typeof generic === 'object') setRaw(generic);
            foundAnyState = true;
          } catch {
            // Still consider it a leak and suppress
            foundAnyState = true;
          }
        }
        // Remove from marker to closing brace
        displayText = displayText.slice(0, idx) + displayText.slice(nextClose + 1);
        scanPos = idx;
        continue;
      } else {
        // No closing brace at all: truncate from marker onward (suppress leak)
        // But to avoid deleting legitimate story after, we only truncate if remaining text is short (<2000) and looks like JSON
        const remaining = displayText.slice(idx);
        // If remaining contains "relationships" or "location" etc., treat as state leak and remove from idx
        if (/(relationships|presentCharacters|storyTime|importantObjects|location)/i.test(remaining)) {
          displayText = displayText.slice(0, idx);
          foundAnyState = true;
          break;
        } else {
          scanPos = idx + lowerMarker.length;
          continue;
        }
      }
    } else {
      // Balanced JSON found
      const { jsonStr, endIdx } = extracted;
      const parsed = parseStateBlock(jsonStr);
      if (parsed) {
        foundAnyState = true;
        mergeEffectsInto(merged, parsed.effects, memoryNotes, setRaw, parsed.raw);
      } else {
        // Malformed JSON but balanced: try generic parse for worldState, still suppress
        try {
          const generic = JSON.parse(jsonStr) as Record<string, unknown>;
          if (generic && typeof generic === 'object') {
            setRaw(generic);
            // Even if parseStateBlock failed due to empty effects, we still have raw
            foundAnyState = true;
          }
        } catch {
          foundAnyState = true;
        }
      }
      // Remove entire block from marker to endIdx
      displayText = displayText.slice(0, idx) + displayText.slice(endIdx);
      scanPos = idx;
      continue;
    }
  }

  // 3) Cleanup display text
  displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();

  // Also remove any stray leftover markers like "kissa-state" at end with empty JSON? Already handled.

  let speaker: string | null = null;
  const lines = displayText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (isFullyFadedLine(trimmed)) continue;
    const hit = matchSpeakerPrefix(trimmed);
    if (hit) {
      speaker = hit.name;
      lines[i] = hit.rest;
      displayText = lines.join('\n').replace(/^\n+/, '').trim();
    }
    break;
  }

  const effects = foundAnyState && Object.keys(merged).length > 0 ? merged : foundAnyState ? merged : undefined;
  // If foundAnyState but no effects, we still want to indicate that state was present and removed (memoryNotes may be empty)
  // For compatibility, return effects as merged if any state was found, else undefined
  const finalEffects = foundAnyState ? (Object.keys(merged).length > 0 ? merged : {}) : undefined;

  return {
    displayText,
    effects: finalEffects && Object.keys(finalEffects).length > 0 ? finalEffects : foundAnyState ? (Object.keys(merged).length ? merged : undefined) : undefined,
    memoryNotes,
    speaker,
    worldStateRaw,
    rawStateJson,
  };
}

/* ---------------- free-text -> choice matching ---------------- */

export function matchChoice(freeText: string, choices: SceneChoice[]): SceneChoice | null {
  const input = norm(freeText);
  if (!input || choices.length === 0) return null;
  const inputTokens = new Set(tokens(freeText));

  let best: SceneChoice | null = null;
  let bestScore = 0;
  for (const c of choices) {
    let score = 0;
    const hay = `${c.text} ${(c.keywords ?? []).join(' ')}`.toLowerCase();
    if (c.text && input.includes(norm(c.text).slice(0, 24))) score += 4;
    for (const kw of c.keywords ?? []) {
      const k = norm(kw);
      if (!k) continue;
      if (input.includes(k)) score += k.length >= 5 ? 3 : 2;
      else if (inputTokens.has(k)) score += 2;
    }
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

/** Default sliding window; stories can override via memory.json.shortTermWindow. */
export const DEFAULT_SHORT_TERM_WINDOW = 16;
export const MAX_SHORT_TERM_WINDOW = 48;

/** Extra older messages to load from the DB so a big window is actually filled. */
export const HISTORY_HEADROOM = 8;

/** Short-term window for a bundle, clamped to a sane range. */
export function shortTermWindowOf(bundle: StoryBundle): number {
  const wanted = bundle.memory?.shortTermWindow || DEFAULT_SHORT_TERM_WINDOW;
  return clamp(wanted, 4, MAX_SHORT_TERM_WINDOW);
}

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
  /** Ranked long-term facts chosen for this turn (see memoryCore.selectRelevant). */
  memories: MemoryEntry[];
  history: ChatMessage[];
  /** Rolling compressed digest of everything folded out of the window. */
  summary?: string;
  worldState?: WorldState | null;
  immediateContext?: string;
}

export function buildSystemPrompt(input: PromptInput, ageGroup: AgeGroup): string {
  const { bundle, profile, playthrough, memories } = input;
  const scene = getScene(bundle, playthrough.currentSceneId);
  // World state is injected here if present; otherwise fall back to legacy stateDigest
  const worldBlock = input.worldState ? (() => {
    try {
      const { renderWorldStateForPrompt } = require('./worldState');
      return renderWorldStateForPrompt(input.worldState as WorldState);
    } catch {
      return '';
    }
  })() : '';
  // The reader's name must come from the profile, never from hardcoded story
  // text: {{playerName}} placeholders (and legacy hardcoded names) resolve to
  // profile.nickname, while CHARACTER names stay untouched.
  const playerNameContext = {
    protectedNames: bundle.characters.characters.map((c) => c.name),
  };

  const charCards = bundle.characters.characters
    .map(
      (c) =>
        `- ${c.name} (${c.role}): ${c.personality} Speaks like: ${c.speakingStyle} Example: "${c.sampleLine}" Goals: ${c.goals.join('; ')}. Knows: ${c.knowledge.join('; ')}.`,
    )
    .join('\n');

  const memLines =
    memories.length > 0
      ? memories.map(renderMemoryLine).join('\n')
      : bundle.memory.seedMemories.map((m) => `- ${m}`).join('\n');

  const summaryBlock = input.summary?.trim()
    ? `STORY SO FAR (compressed memory — already known, never restate it):\n${input.summary.trim()}\n\n`
    : '';

  const saveHints =
    bundle.memory.extractionHints?.length
      ? bundle.memory.extractionHints.join('; ')
      : 'anything that shifts a relationship, reveals a secret, changes the reader\'s standing, or is promised';
  const neverHints =
    bundle.memory.neverRemember?.length ? bundle.memory.neverRemember.join('; ') : 'real-world personal data';

  const teenBlock =
    ageGroup === '12-17'
      ? `\nSAFETY (reader is 12-17):\n${teenSafetyGuidance()}\n${bundle.story.safetyNotes.map((s) => `- ${s}`).join('\n')}`
      : `\nCONTENT NOTES:\n${bundle.story.safetyNotes.map((s) => `- ${s}`).join('\n')}`;

  const prompt = `You are the narrator and ALL characters of an interactive Hinglish story-chat game called Kissa.

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

${worldBlock ? worldBlock + '\n\nLEGACY STATE (for compat):\n' + stateDigest(playthrough.state) : `STORY STATE SO FAR:
${stateDigest(playthrough.state)}`}

${summaryBlock}WHAT YOU REMEMBER ABOUT THIS READER'S JOURNEY (most relevant first — this is ALREADY known, so never repeat it back, just act on it):
${memLines}

MEMORY DISCIPLINE — what belongs in the hidden "memory" array:
- Worth saving: ${saveHints}
- Never save: ${neverHints}
- Also save whatever the reader tells you about themselves (their name, likes, fears, promises, how they want to be treated) — those facts outlive this story.
- Save a fact only if it will still matter 20 turns from now. Write each one as a short standalone sentence (max 120 chars) naming the people involved, e.g. "Aarav ne Myra ko chai ka glass lautane ka wada kiya."
- If a previously remembered fact turns out to be wrong or changes, save the corrected version as a new memory.
${teenBlock}

HOW TO RESPOND:
1. Continue the story immersively: short narration + character dialogue. Keep replies MEDIUM-SHORT (roughly 40-90 words only, max 2 short paragraphs), crisp, punchy, ending with a hook or question that invites the reader's next move. Avoid long monologues.
2. FORMAT (the app renders this, follow it exactly):
   - Action / narration / scene-setting goes on its own line wrapped in SINGLE asterisks: *Beena ke honton par halki si muskaan ubharti hai.* — these render FADED in the chat.
   - Dialogue goes on its own line as: Name: "spoken words" — e.g. Myra: "Umm... lagta hai ye coffee meri nahi hai." Use only real character names from the list above.
   - Alternate 1-3 faded action lines with dialogue. Never use markdown bold, headers or bullet lists.
3. Respect the current scene and its available directions; do NOT teleport the plot or invent contradicting events. If the reader does something wild, react believably and steer back toward the scene.
4. NEVER speak as the reader. NEVER decide the reader's actions for them.
5. When addressing the reader, use "${profile.nickname}" occasionally.
6. After your visible reply, append a hidden state block when something changed OR when a durable new fact happened. Format exactly:
\`\`\`kissa-state
{
  "relationships": {"characterId": +5},
  "flags": {"gateOpened": true},
  "inventoryAdd": ["item-id"],
  "location": "Place name",
  "scene": "next-scene-id",
  "endStory": "ending-id",
  "presentCharacters": ["maya","kabir"],
  "activity": "having chai in library",
  "playerAction": "sitting opposite Maya",
  "storyTime": {"clockTime": "8:42 PM", "timeOfDay": "evening"},
  "importantObjects": [{"name": "old photograph", "holder": "Maya", "significance": "first clue"}],
  "threads": [{"title": "Unknown photograph", "status": "unresolved", "involvedCharacters": ["Maya"], "relatedLocation": "Library"}],
  "threadsResolved": ["Old promise"],
  "memory": ["short fact to remember"]
}
\`\`\`
Omit keys that didn't change. "scene" must be one of the story's scene ids. "endStory" only at a true ending. Keep memory facts short (under 120 chars), up to ${MAX_MEMORY_NOTES} per reply. Also use presentCharacters/activity/storyTime/importantObjects/threads when relevant. Nothing you write in "memory" or this block is shown to the reader. For high continuity, always emit location/activity/presentCharacters when they change.
7. If the reader greets you out-of-story ("hi", "hello"), stay in character briefly and pull them back into the scene.`;

  return interpolatePlayerName(prompt, profile.nickname, playerNameContext);
}

export interface BuiltContext {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export function buildContext(input: PromptInput, ageGroup: AgeGroup): BuiltContext {
  const windowSize = shortTermWindowOf(input.bundle);
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
      messages.push({ role: 'assistant', content: `[Scene] ${m.text}` });
    }
  }
  return { system: buildSystemPrompt(input, ageGroup), messages };
}

export function progressEstimate(bundle: StoryBundle, playthrough: Playthrough): number {
  const total = Math.max(1, bundle.scenes.scenes.length);
  const visited = Object.keys(playthrough.state.visits ?? {}).length;
  const byScenes = clamp(visited / total, 0, 1);
  const byMsgs = clamp(playthrough.messageCount / 60, 0, 1);
  return clamp(byScenes * 0.75 + byMsgs * 0.25, 0, 1);
}
