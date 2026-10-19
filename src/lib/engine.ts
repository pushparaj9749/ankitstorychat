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
import { guardVisibleText, sanitizeStoredText, type GuardResult } from './leakGuard';
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
 * KISSA v2.4.3 — Robust internal state parser.
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
  /** v2.7.0: non-JSON leak shapes the parser already removed (see leakGuard). */
  leakReasons?: string[];
}

/**
 * L2 FIX: Attempt to repair common JSON malformations before giving up.
 * Pipeline: strict parse → strip trailing commas → normalize smart quotes → salvage.
 */
function repairJson(text: string): Record<string, unknown> | undefined {
  // 1. Try strict parse
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>;
  } catch { /* continue */ }

  // 2. Strip trailing commas before } or ]
  try {
    const fixed = text.replace(/,(\s*[}\]])/g, '$1');
    const obj = JSON.parse(fixed);
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>;
  } catch { /* continue */ }

  // 3. Normalize smart quotes to straight quotes
  try {
    const fixed = text
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/,(\s*[}\]])/g, '$1'); // also strip trailing commas
    const obj = JSON.parse(fixed);
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>;
  } catch { /* continue */ }

  // 4. L10: Accept single-quoted JSON by normalizing to double quotes
  try {
    // Simple single-quote to double-quote (not perfect but covers common cases)
    const fixed = text
      .replace(/'/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');
    const obj = JSON.parse(fixed);
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>;
  } catch { /* continue */ }

  return undefined;
}

/** L2 SALVAGE: regex-extract the "memory" array and simple scalar keys from broken JSON. */
function salvageFromBrokenJson(text: string): { effects: ChoiceEffects; raw: Record<string, unknown> } | undefined {
  const raw: Record<string, unknown> = {};
  let hasSomething = false;

  // Extract "memory": [...] or "memory": "string" (L10)
  const memMatch = text.match(/"memory"\s*:\s*(\[[\s\S]*?\])/);
  if (memMatch) {
    try {
      const arr = JSON.parse(memMatch[1]);
      if (Array.isArray(arr)) {
        raw.memory = arr.filter((x: unknown) => typeof x === 'string');
        hasSomething = true;
      }
    } catch { /* try salvage individual strings */ 
      const strings = memMatch[1].match(/"([^"]+)"/g);
      if (strings) {
        raw.memory = strings.map(s => s.replace(/"/g, ''));
        hasSomething = true;
      }
    }
  } else {
    // L10: memory might be a plain string
    const memStrMatch = text.match(/"memory"\s*:\s*"([^"]+)"/);
    if (memStrMatch) {
      // Split on sentence boundaries
      raw.memory = memStrMatch[1].split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      hasSomething = true;
    }
  }

  // Extract simple scalar keys
  const scalarKeys = ['location', 'scene', 'activity', 'presentCharacters'];
  for (const key of scalarKeys) {
    const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
    const match = text.match(re);
    if (match) {
      raw[key] = match[1];
      hasSomething = true;
    }
  }
  // presentCharacters as array
  const pcMatch = text.match(/"presentCharacters"\s*:\s*\[([\s\S]*?)\]/);
  if (pcMatch) {
    const strings = pcMatch[1].match(/"([^"]+)"/g);
    if (strings) {
      raw.presentCharacters = strings.map(s => s.replace(/"/g, ''));
      hasSomething = true;
    }
  }

  if (!hasSomething) return undefined;

  const effects: ChoiceEffects = {};
  if (Array.isArray(raw.memory) && raw.memory.length) {
    effects.memory = raw.memory.filter((x: unknown): x is string => typeof x === 'string').slice(0, MAX_MEMORY_NOTES);
  }
  if (typeof raw.location === 'string') effects.location = raw.location;
  if (typeof raw.scene === 'string') effects.scene = raw.scene;

  return { effects, raw };
}

function parseStateBlock(jsonText: string): { effects: ChoiceEffects; raw: Record<string, unknown> } | undefined {
  const trimmed = (jsonText || '').trim();
  if (!trimmed) return undefined;

  // L2: Try repair ladder first (strict → trailing commas → smart quotes → single quotes)
  const repaired = repairJson(trimmed);
  if (repaired) {
    // Successfully parsed — extract effects from the repaired object
    return extractEffects(repaired);
  }

  // L2 SALVAGE: regex-extract memory array and scalar keys from broken JSON
  return salvageFromBrokenJson(trimmed);
}

/** Extract effects from a successfully parsed JSON object. */
function extractEffects(obj: Record<string, unknown>): { effects: ChoiceEffects; raw: Record<string, unknown> } | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  try {
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

/* ------------------------------------------------------------------ */
/* v2.5.1 — last-line-of-defence: internal state must NEVER be shown   */
/* ------------------------------------------------------------------ */

const STATE_MARKER_RE = /kissa[\s_-]*state/i;
const STATE_KEYS = [
  'relationships', 'relationshipstatus', 'relationshipstates', 'presentcharacters', 'worldstate',
  'storytime', 'importantobjects', 'characterstates', 'unresolvedthreads', 'memoryindex',
  'characterknowledge', 'threads', 'memory', 'location', 'scene', 'activity', 'flags',
  'inventoryadd', 'inventoryremove', 'endstory', 'playeraction', 'promises', 'decisions', 'secrets',
];
const STATE_KEY_SET = new Set(STATE_KEYS);
const STATEY_KEYS_RE = /"(?:relationships|relationshipStatus|relationshipStates|presentCharacters|worldState|storyTime|importantObjects|characterStates|unresolvedThreads|memoryIndex|characterKnowledge|threads|memory)"\s*:/gi;

/** How many known internal-state keys a JSON body carries. */
function stateyKeyCount(body: string): number {
  const re = new RegExp(STATEY_KEYS_RE.source, 'gi');
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) seen.add(m[0].toLowerCase());
  return seen.size;
}

/**
 * Top-level keys of a JSON object written as text (strings are skipped, so
 * nested keys never count). Lets us recognise internal state objects without a
 * real JSON parser, and without touching ordinary story JSON.
 */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;
  const n = body.length;
  while (i < n) {
    const ch = body[i];
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < n) {
        if (body[j] === '\\') {
          value += body[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (body[j] === '"') break;
        value += body[j];
        j++;
      }
      if (depth === 1 && /^\s*:/.test(body.slice(j + 1))) keys.push(value.toLowerCase());
      i = j + 1;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    i++;
  }
  return keys;
}

/**
 * True when a JSON object is clearly INTERNAL state: ≥2 known state keys, or a
 * set of keys that are all state keys (catches `{"memory":[…]}` too).
 * Deliberately conservative — ordinary story text is never deleted.
 */
function looksLikeStateObject(body: string): boolean {
  const keys = topLevelKeys(body);
  if (!keys.length) return false;
  const stateKeys = keys.filter((k) => STATE_KEY_SET.has(k));
  if (stateKeys.length >= 2) return true;
  return stateKeys.length >= 1 && stateKeys.length === keys.length;
}

/**
 * The safety net for story text. The structured parser above removes well-formed
 * blocks; this pass catches everything the model can still do wrong, because
 * internal state must NEVER be rendered as story text (and is never hidden with
 * CSS, which would still put it in the view tree):
 *
 *  - fenced blocks with any state-ish info string (```kissa-state, ```kissa_state,
 *    ```kissaState, ```json carrying state keys …)
 *  - unfenced `kissa-state` / `kissaState` / `kissa_state` + JSON payloads
 *  - unterminated blocks (marker + `{` with no closing brace)
 *  - bare state-shaped JSON that lost its marker entirely
 *
 * Prose that merely mentions the word (or contains normal JSON) is untouched.
 */
export function stripStateLeakage(text: string): string {
  if (!text) return '';
  let out = text;

  // 1) Fenced block whose body looks like state (marker or state-shaped JSON).
  out = out.replace(/```[^\n`]*\n?([\s\S]*?)```/g, (full, body: string) => {
    const head = full.slice(0, full.indexOf('\n') >= 0 ? full.indexOf('\n') : full.length);
    if (STATE_MARKER_RE.test(head) || looksLikeStateObject(body)) return '';
    return full;
  });

  // 2) Marker + JSON, balanced or not (case/separator-insensitive).
  let guard = 0;
  while (guard++ < 20) {
    const match = STATE_MARKER_RE.exec(out);
    if (!match) break;
    const idx = match.index;
    const braceStart = out.indexOf('{', idx + match[0].length);
    if (braceStart === -1 || braceStart - idx > 400) {
      // The marker is mentioned without any JSON payload: that is prose, not a
      // state block — leave it alone.
      break;
    }
    const between = out.slice(idx + match[0].length, braceStart);
    if (between.replace(/[\s:`~]/g, '').length > 24) {
      // Prose that only mentions the marker.
      out = out.slice(0, idx) + ' ' + out.slice(idx + match[0].length);
      continue;
    }
    // Include a leading fence opener on the same line ("```kissa-state").
    const lineStart = out.lastIndexOf('\n', idx) + 1;
    const prefix = out.slice(lineStart, idx);
    const removeFrom = /^\s*`{1,3}\s*$/.test(prefix) ? lineStart : idx;
    const end = findBalancedJsonEnd(out, braceStart);
    if (end === -1) {
      out = out.slice(0, removeFrom); // unterminated payload: truncate the leak
      break;
    }
    out = out.slice(0, removeFrom) + out.slice(end);
  }

  // 3) Bare state-shaped JSON without any marker (last resort).
  if (!STATE_MARKER_RE.test(text)) {
    let i = 0;
    let scanned = 0;
    while (i < out.length && scanned < 60) {
      scanned++;
      const brace = out.indexOf('{', i);
      if (brace === -1) break;
      const end = findBalancedJsonEnd(out, brace);
      if (end === -1) break;
      const body = out.slice(brace, end);
      if (body.length <= 4000 && looksLikeStateObject(body)) {
        out = out.slice(0, brace) + out.slice(end);
        i = brace;
      } else {
        i = end;
      }
    }
  }

  // 4) v2.7.0: every NON-JSON shape (label lines, headings + lists, YAML-ish
  // state, [STATE]/(OOC) tags, HIDDEN TRUTH, HTML comments) — see leakGuard.
  out = guardVisibleText(out).text;

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Index just past the matching `}` for a JSON object starting at `start`. */
function findBalancedJsonEnd(str: string, start: number): number {
  if (str[start] !== '{') return -1;
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
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Response-processing entry point used by the chat screen:
 * AI response → detect → parse → validate → (persist by caller) → strip → render.
 * Guarantees a non-empty, state-free display string.
 */
export function finalizeAssistantText(parsed: ParsedAssistant, fallback = '...'): string {
  const cleaned = stripStateLeakage(parsed.displayText ?? '');
  return cleaned.trim().length ? cleaned : fallback;
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

  // 3) Cleanup display text. Non-JSON leaks are removed BEFORE speaker
  // detection, otherwise "Important objects: …" would become a "speaker".
  const guarded = guardVisibleText(displayText);
  displayText = guarded.text;
  const leakReasons = guarded.reasons;
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
    leakReasons,
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

/**
 * STAGE 2 — recent conversation, verbatim. v2.7.0: the last ~20 chats (one chat
 * = the reader's message + the narrator's reply = 2 rows) always travel with the
 * prompt. Story packs can ask for MORE (up to MAX), never less.
 */
export const RECENT_CHAT_TURNS = 20;
export const DEFAULT_SHORT_TERM_WINDOW = RECENT_CHAT_TURNS * 2;
export const MAX_SHORT_TERM_WINDOW = 48;

/** Extra older messages to load from the DB so a big window is actually filled. */
export const HISTORY_HEADROOM = 8;

/** Short-term window for a bundle, clamped to a sane range. */
export function shortTermWindowOf(bundle: StoryBundle): number {
  const wanted = Math.max(bundle.memory?.shortTermWindow || 0, DEFAULT_SHORT_TERM_WINDOW);
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

/**
 * Product law (owner): a story has NO predefined scenes, arcs, chapters, plot
 * points or endings — and no length. The author only provides the premise,
 * characters, world and the OPENING moment; everything after that grows from
 * the reader's moves. The opening is shown to the narrator only as where the
 * story began, never as a script to follow.
 */
export const OPENING_ONLY_TURNS = 8;

export const FREE_STORY_LAW = `STORY FLOW LAW (never break it):
- There is NO script. No predefined scenes, arcs, chapters, plot points, milestones or endings exist, and the story has no length — it never "finishes".
- Everything after the opening grows ONLY from the reader's moves, the characters' personalities and goals, the world and what has already happened.
- Never steer toward a planned event, never rush or wrap the story up, never announce a chapter, arc, ending or "next part". Let it evolve naturally, one beat at a time, for as long as the reader wants.`;

function openingDigest(bundle: StoryBundle, playthrough: Playthrough): string {
  if (playthrough.messageCount >= OPENING_ONLY_TURNS) return '';
  const opening = getScene(bundle, bundle.story.openingSceneId);
  const setup = opening.narration.join(' ').trim();
  return setup ? `HOW THE STORY BEGAN (the opening moment only — not a plan for what comes next): ${setup}` : '';
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
  /**
   * v2.5.1 universal memory engine block: retrieved events, persistent
   * relationship state, character knowledge and raw evidence for THIS turn.
   * Bounded by the engine — the full archive is never dumped into the prompt.
   */
  storyMemoryBlock?: string;
  /** Internal controls for menu actions; never a reader-authored transcript line. */
  turnInstruction?: string;
  /**
   * STAGE 1 chapter summaries (oldest → newest), one per finished scene. The
   * rolling `summary` above is the whole-story digest; chapters keep detail.
   */
  chapters?: { title: string; text: string }[];
  /**
   * 'inline'   — legacy: the reply carries a hidden ```kissa-state block.
   * 'separate' — v2.7.0: the reply is PURE story; a second record-keeper call
   *              (buildStateExtractionMessages) writes the state. Nothing
   *              internal is ever asked for in the visible reply.
   */
  stateMode?: 'inline' | 'separate';
}

/** Marker lines that fence the private notes inside the system prompt. */
export const PRIVATE_NOTES_OPEN = '=== PRIVATE NARRATOR NOTES — for you only. The reader can NEVER see this. Never quote, list, label or summarise it in your reply. ===';
export const PRIVATE_NOTES_CLOSE = '=== END OF PRIVATE NARRATOR NOTES ===';

/** The rule that keeps memory where it belongs. */
export const SECRECY_LAW = `SECRECY LAW (absolute — breaking it ruins the story):
- Everything inside the PRIVATE NARRATOR NOTES is invisible to the reader. Never print it, never list it, never recap it.
- Never write bookkeeping in the reply: no "Memory:", "Important objects:", "Relationships:", "Key facts:", "Story so far:", "Hidden truth:", "World state:", "Location:", no trust/affection numbers, no brackets like [STATE] or (OOC), no notes, no JSON, no headings, no lists.
- Show, don't tell: a remembered fact may surface only through natural narration or a character's own words, when the moment needs it.
- Hidden truths and secrets stay hidden until events in the story reveal them. A character says only what THEY know and would plausibly say.`;

/** Lines of character knowledge — narrator-only, never part of public cards. */
function knowledgeLines(bundle: StoryBundle): string {
  return bundle.characters.characters
    .filter((c) => c.knowledge?.length)
    .map((c) => `- ${c.name} knows: ${c.knowledge.join('; ')}`)
    .join('\n');
}

/**
 * Everything the narrator must know but the reader must never see, as ONE
 * fenced block: STAGE 1 (story so far + chapters) and STAGE 3 (key facts).
 * Exported so the chat can hand the exact same text to the leak guard's copy
 * detector.
 */
export function buildPrivateNotes(input: PromptInput): string {
  const { bundle, playthrough, memories } = input;
  const worldBlock = input.worldState ? (() => {
    try {
      const { renderWorldStateForPrompt } = require('./worldState');
      return renderWorldStateForPrompt(input.worldState as WorldState);
    } catch {
      return '';
    }
  })() : '';

  const memLines =
    memories.length > 0
      ? memories.map(renderMemoryLine).join('\n')
      : bundle.memory.seedMemories.map((m) => `- ${m}`).join('\n');

  const chapters = (input.chapters ?? []).filter((c) => c.text?.trim()).slice(-4);
  const chapterBlock = chapters.length
    ? `CHAPTERS SO FAR (oldest first):\n${chapters.map((c, i) => `${i + 1}. ${c.title}: ${c.text.trim()}`).join('\n')}\n\n`
    : '';
  const summaryBlock = input.summary?.trim()
    ? `STORY SO FAR (compressed memory — already known, never restate it):\n${input.summary.trim()}\n\n`
    : '';
  const stage1 = chapterBlock || summaryBlock
    ? `STAGE 1 — THE WHOLE STORY UNTIL NOW\n${summaryBlock}${chapterBlock}`
    : `STAGE 1 — THE WHOLE STORY UNTIL NOW\n(the journey has just begun)\n\n`;

  const immediateBlock = input.immediateContext?.trim()
    ? `LATEST TURN CUES (verbatim history is also provided below; do not repeat these lines):\n${input.immediateContext.trim()}\n\n`
    : '';
  const storyMemoryBlock = input.storyMemoryBlock?.trim()
    ? `LONG-TERM STORY ARCHIVE (local, source-tagged, retrieved for this turn — treat as established canon; a later turn never erases it):\n${input.storyMemoryBlock.trim()}\n\n`
    : '';
  const knows = knowledgeLines(bundle);
  const lore = bundle.world.lore?.length ? bundle.world.lore.join(' | ') : '';

  const stateBlock = worldBlock
    ? `${worldBlock}\n\nLEGACY STATE (for compat):\n${stateDigest(playthrough.state)}`
    : `STORY STATE SO FAR:\n${stateDigest(playthrough.state)}`;

  return `${PRIVATE_NOTES_OPEN}

${stage1}STAGE 3 — KEY FACTS (established canon; act on them silently, never announce them)
${stateBlock}

${knows ? `CHARACTER KNOWLEDGE (who knows what — a character may act only on their own line):\n${knows}\n\n` : ''}${lore ? `LORE (background canon; any hidden truth here is revealed only through story events, never stated):\n${lore}\n\n` : ''}${storyMemoryBlock}WHAT YOU REMEMBER ABOUT THIS READER'S JOURNEY (most relevant first — this is ALREADY known, so never repeat it back, just act on it):
${memLines}

${immediateBlock}${PRIVATE_NOTES_CLOSE}`;
}

export function buildSystemPrompt(input: PromptInput, ageGroup: AgeGroup): string {
  const { bundle, profile, playthrough } = input;
  const separate = input.stateMode === 'separate';
  const opening = openingDigest(bundle, playthrough);
  // The reader's name must come from the profile, never from hardcoded story
  // text: {{playerName}} placeholders (and legacy hardcoded names) resolve to
  // profile.nickname, while CHARACTER names stay untouched.
  const playerNameContext = {
    protectedNames: bundle.characters.characters.map((c) => c.name),
  };

  // Public character cards. What a character KNOWS lives in the private notes.
  const charCards = bundle.characters.characters
    .map(
      (c) =>
        `- ${c.name} (${c.role}): ${c.personality} Speaks like: ${c.speakingStyle} Example: "${c.sampleLine}" Goals: ${c.goals.join('; ')}.`,
    )
    .join('\n');

  const privateNotes = buildPrivateNotes(input);
  const windowTurns = Math.round(shortTermWindowOf(bundle) / 2);

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

${FREE_STORY_LAW}
${opening ? `\n${opening}\n` : ''}
${SECRECY_LAW}

${privateNotes}

STAGE 2 — THE RECENT CONVERSATION: the last ${windowTurns} chats follow as messages, verbatim. Continue from the final one.
${separate ? '' : `
MEMORY DISCIPLINE — what belongs in the hidden "memory" array:
- Worth saving: ${saveHints}
- Never save: ${neverHints}
- Also save whatever the reader tells you about themselves (their name, likes, fears, promises, how they want to be treated) — those facts outlive this story.
- Save a fact only if it will still matter 20 turns from now. Write each one as a short standalone sentence (max 120 chars) naming the people involved, e.g. "Aarav ne Myra ko chai ka glass lautane ka wada kiya."
- If a previously remembered fact turns out to be wrong or changes, save the corrected version as a new memory.
`}
CONTINUITY LAW (never break it):
- Scene, location or time changes NEVER erase memory. What happened before still happened.
- The LONG-TERM STORY ARCHIVE and CURRENT RELATIONSHIP STATE above are established canon. Never contradict them, never reset a relationship (a married couple stays married unless the story explicitly shows a break).
- Each character may act ONLY on what THEY know (see CHARACTER KNOWLEDGE). A character who was not present did not witness it and must not reference it unless someone told them in-story.
- Promises, decisions and secrets remain in force until the story explicitly resolves them.
- If the reader asks about something from long ago, use the archive instead of guessing.
${teenBlock}

HOW TO RESPOND:
1. Continue the story immersively: short narration + character dialogue. Keep replies MEDIUM-SHORT (roughly 40-90 words only, max 2 short paragraphs), crisp, punchy, ending with a hook or question that invites the reader's next move. Avoid long monologues.
2. FORMAT (the app renders this, follow it exactly):
   - Action / narration / scene-setting goes on its own line wrapped in SINGLE asterisks: *Beena ke honton par halki si muskaan ubharti hai.* — these render FADED in the chat.
   - Dialogue goes on its own line as: Name: "spoken words" — e.g. Myra: "Umm... lagta hai ye coffee meri nahi hai." Use only real character names from the list above.
   - Alternate 1-3 faded action lines with dialogue. Never use markdown bold, headers or bullet lists.
3. Follow the reader's lead. Keep continuity: never teleport without a believable bridge and never invent events that contradict what happened. If the reader does something wild, react believably inside the story world.
4. NEVER speak as the reader. NEVER decide the reader's actions for them.
5. When addressing the reader, use "${profile.nickname}" occasionally.
${separate ? `6. Write ONLY the visible story reply — narration and dialogue. Do NOT append any state, memory, JSON, notes, lists or bookkeeping: a separate silent record-keeper tracks the story state.` : `6. After your visible reply, append a hidden state block when something changed OR when a durable new fact happened. Format exactly:
\`\`\`kissa-state
{
  "relationships": {"characterId": +5},
  "flags": {"gateOpened": true},
  "inventoryAdd": ["item-id"],
  "location": "Place name",
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
Omit keys that didn't change. Keep memory facts short (under 120 chars), up to ${MAX_MEMORY_NOTES} per reply. Also use presentCharacters/activity/storyTime/importantObjects/threads when relevant. Nothing you write in "memory" or this block is shown to the reader. For high continuity, always emit location/activity/presentCharacters when they change.`}
7. If the reader greets you out-of-story ("hi", "hello"), stay in character briefly and pull them back into the story.`;

  const systemPrompt = interpolatePlayerName(prompt, profile.nickname, playerNameContext);
  const turnInstruction = input.turnInstruction?.trim();
  return turnInstruction
    ? `${systemPrompt}\n\nINTERNAL ACTION INSTRUCTION (not a reader-authored message):\n${turnInstruction}`
    : systemPrompt;
}

export interface BuiltContext {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** The exact private notes inside `system` (for the leak guard's copy check). */
  privateNotes: string;
}

export function buildContext(input: PromptInput, ageGroup: AgeGroup): BuiltContext {
  const windowSize = shortTermWindowOf(input.bundle);
  const history = input.history.slice(-windowSize);
  const cast = input.bundle.characters.characters.map((c) => c.name);
  const messages: BuiltContext['messages'] = [];
  for (const m of history) {
    if (m.role === 'user') messages.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      // A leak saved by an older version must not be fed back to the model —
      // it would learn to repeat it.
      const clean = sanitizeStoredText(m.text, cast) || m.text.trim();
      messages.push({
        role: 'assistant',
        content: m.speaker ? `${m.speaker}: ${clean}` : clean,
      });
    } else if (m.role === 'narration') {
      messages.push({ role: 'assistant', content: `[Scene] ${m.text}` });
    }
  }
  return { system: buildSystemPrompt(input, ageGroup), messages, privateNotes: buildPrivateNotes(input) };
}

/* ---------------- v2.7.0 reply check (before the reader sees it) ---------------- */

export interface ReplyCheck {
  text: string;
  speaker: string | null;
  /** Something was wrong: the chat should silently ask for one rewrite. */
  needsRewrite: boolean;
  reasons: string[];
}

/**
 * Final gate between the model and the screen: strips every leak shape, removes
 * lines written for the reader, and says whether a silent rewrite is warranted.
 */
export function checkAssistantReply(
  parsed: ParsedAssistant,
  opts: { castNames: string[]; readerName?: string; privateNotes?: string },
): ReplyCheck {
  const base = finalizeAssistantText(parsed, '');
  const g: GuardResult = guardVisibleText(base, {
    protectedNames: opts.castNames,
    hiddenNotes: opts.privateNotes,
    readerName: opts.readerName,
  });
  const reasons = [...(parsed.leakReasons ?? []).filter((r) => r !== 'spoke-for-reader'), ...g.reasons];
  // A speaker prefix that is the reader themself is also "speaking for the
  // reader": drop that first line along with the prefix.
  let speaker = parsed.speaker;
  let body = g.text;
  const reader = opts.readerName?.trim().toLowerCase();
  const readerAliases = ['you', 'tum', 'aap', 'reader', 'player', 'user', ...(reader ? [reader] : [])];
  const castLower = opts.castNames.map((n) => n.toLowerCase());
  if (speaker && readerAliases.includes(speaker.trim().toLowerCase()) && !castLower.includes(speaker.trim().toLowerCase())) {
    speaker = null;
    reasons.push('spoke-for-reader');
    const lines = body.split('\n');
    const first = lines.findIndex((l) => l.trim());
    if (first >= 0) lines.splice(first, 1);
    body = lines.join('\n').trim();
    // The next dialogue line (if any) names the real speaker.
    const next = body.split('\n').find((l) => l.trim());
    const hit = next ? matchSpeakerPrefix(next.trim()) : null;
    if (hit && castLower.includes(hit.name.toLowerCase())) {
      speaker = hit.name;
      body = body.replace(next!, hit.rest).trim();
    }
  }
  const text = body.trim();
  if (text.length < 2) reasons.push('empty');
  const needsRewrite = reasons.some((r) => r === 'empty' || r === 'spoke-for-reader' || r === 'copied-note' || r.startsWith('label:') || r === 'tag-line' || r === 'state-marker' || r === 'html-comment');
  return { text: text || '...', speaker, needsRewrite, reasons };
}

/** Nudge used for the single silent rewrite. */
export const REWRITE_INSTRUCTION =
  'Your previous draft broke the format: it showed private notes / bookkeeping or spoke for the reader. Rewrite the SAME story beat as pure narration and character dialogue only. No labels, lists, notes, JSON or state. Never write the reader\'s lines.';

/* ---------------- v2.7.0 silent record-keeper (separate state call) ---------------- */

export interface StateExtractionInput {
  bundle: StoryBundle;
  playthrough: Playthrough;
  worldState?: WorldState | null;
  userText: string;
  assistantText: string;
  assistantSpeaker?: string | null;
  playerName: string;
}

/**
 * Messages for the record-keeper call. It reads ONE finished exchange and
 * returns ONLY the state JSON (same schema as the legacy kissa-state block), so
 * the story reply itself never has to carry anything internal.
 */
export function buildStateExtractionMessages(input: StateExtractionInput): { role: 'system' | 'user'; content: string }[] {
  const { bundle, playthrough } = input;
  const worldBlock = input.worldState ? (() => {
    try {
      const { renderWorldStateForPrompt } = require('./worldState');
      return renderWorldStateForPrompt(input.worldState as WorldState);
    } catch {
      return '';
    }
  })() : '';
  const ids = bundle.characters.characters.map((c) => `${c.id} = ${c.name}`).join(', ');
  const saveHints =
    bundle.memory.extractionHints?.length
      ? bundle.memory.extractionHints.join('; ')
      : 'anything that shifts a relationship, reveals a secret, changes the reader\'s standing, or is promised';
  const neverHints =
    bundle.memory.neverRemember?.length ? bundle.memory.neverRemember.join('; ') : 'real-world personal data';

  const system = `You are the silent record-keeper of an interactive Hinglish story ("${bundle.story.title}"). You never write story text. You read the latest exchange and output ONLY one JSON object describing what CHANGED. No prose, no markdown, no code fence.

CHARACTER IDS: ${ids}. The reader is "${input.playerName}" (use "player" as holder/id for the reader).
The story is free-form: there are no predefined scenes, arcs or endings, so never output "scene" or "endStory".

STATE BEFORE THIS EXCHANGE:
${worldBlock || stateDigest(playthrough.state)}

SCHEMA (omit every key that did not change; {} when nothing changed):
{
  "relationships": {"characterId": +5},
  "flags": {"flagName": true},
  "inventoryAdd": ["item"], "inventoryRemove": ["item"],
  "location": "Place name",
  "presentCharacters": ["characterId"],
  "activity": "what is happening now",
  "playerAction": "what the reader is doing",
  "storyTime": {"clockTime": "8:42 PM", "timeOfDay": "evening"},
  "importantObjects": [{"name": "object", "holder": "characterId or player", "significance": "why it matters"}],
  "threads": [{"title": "open question", "status": "unresolved", "involvedCharacters": ["Name"], "relatedLocation": "Place"}],
  "threadsResolved": ["thread title"],
  "memory": ["short standalone fact, max 120 chars"]
}

MEMORY RULES:
- Worth saving: ${saveHints}
- Never save: ${neverHints}
- Save what the reader reveals about themselves (name, likes, fears, promises) — those facts outlive this story.
- Save a fact only if it will still matter 20 turns from now; name the people involved; up to ${MAX_MEMORY_NOTES} facts.
- Relationship deltas are small (-10..+10) and only when the exchange clearly earned them.
- Never invent anything that did not happen in the exchange.`;

  const reply = input.assistantSpeaker ? `${input.assistantSpeaker}: ${input.assistantText}` : input.assistantText;
  const user = `LATEST EXCHANGE
READER (${input.playerName}): ${input.userText?.trim() || '(no message — the reader asked the story to continue)'}
NARRATOR: ${reply}

Return the JSON object now.`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Parse the record-keeper's answer with the same validation as kissa-state.
 * Returns null when no JSON object is present at all.
 */
export function parseExtractedState(raw: string): ParsedAssistant | null {
  const text = raw || '';
  const fenced = text.match(/```[a-z_-]*\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  if (start === -1) return null;
  const extracted = extractBalancedJson(body, start);
  const json = extracted ? extracted.jsonStr : body.slice(start);
  const parsed = parseAssistantResponse('```kissa-state\n' + json + '\n```');
  if (!parsed.rawStateJson && !parsed.effects && !parsed.memoryNotes.length) return null;
  return parsed;
}

/** Stories have no length, so there is no progress to estimate. Kept for old callers. */
export function progressEstimate(_bundle: StoryBundle, _playthrough: Playthrough): number {
  return 0;
}
