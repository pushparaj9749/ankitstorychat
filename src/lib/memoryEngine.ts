/**
 * KISSA GOD-LEVEL MEMORY ENGINE — WRITE/READ PIPELINES
 *
 * Implements:
 * - Layer 1 Immediate Context (short-term window)
 * - Layer 3 Episodic Memory
 * - Layer 4 Semantic / Fact Memory
 * - Layer 5 Character Memory
 * - Layer 10 Importance + confidence
 * - Write pipeline: USER INPUT -> MEMORY+WORLD -> AI -> RESPONSE -> EXTRACTION -> VALIDATION -> UPDATE -> PERSISTENCE
 * - Read pipeline: builds compact context package with relevance selection
 * - Recall: relevance-based, character/location/thread aware
 * - Contradiction protection delegates to worldState
 */

import type { MemoryEntry } from '../types';
import { hashText, sanitize, looksTooPrivate, MEMORY_MAX_CHARS } from './memoryCore';
import { insertMemory, kvGet, kvSet } from './db';
import { nowIso, uid } from './utils';
import {
  getWorldState,
  ensureWorldState,
  applyWorldStateUpdate,
  setWorldState,
  type WorldState,
  type Confidence,
  type StateUpdate,
} from './worldState';
import type { StoryBundle, Playthrough, ChatMessage } from '../types';
import { selectRelevant, tokenize, buildQuery, overlapScore } from './memoryCore';

// ------------------------------------------------------------------
// Confidence helpers
// ------------------------------------------------------------------

export function inferConfidence(text: string, evidence: string | null): Confidence {
  if (!text) return 'low';
  const t = text.toLowerCase();
  // High: explicit statements with clear actors
  if (/^(maya|kabir|aarav|myra|player).*?(hai|gaya|gayi|tha|thi)/i.test(text) && evidence) return 'high';
  if (evidence && evidence.length > 10) return 'high';
  if (t.includes('lagta hai') || t.includes('shayad') || t.includes('maybe')) return 'low';
  if (t.length < 10) return 'low';
  return 'medium';
}

// ------------------------------------------------------------------
// Importance detection (deterministic signals)
// ------------------------------------------------------------------

export type ImportanceLevel = 1 | 2 | 3 | 4; // 1 trivial, 4 critical

export function deterministicImportance(text: string, meta: { isPromise?: boolean; isLocationChange?: boolean; isDiscovery?: boolean; isRelationshipShift?: boolean; isConflict?: boolean; hasNamedObject?: boolean; hasRecurringToken?: boolean }): ImportanceLevel {
  let score = 1;
  if (meta.isPromise) score = Math.max(score, 4);
  if (meta.isLocationChange) score = Math.max(score, 3);
  if (meta.isRelationshipShift) score = Math.max(score, 3);
  if (meta.isConflict) score = Math.max(score, 3);
  if (meta.isDiscovery) score = Math.max(score, 3);
  if (meta.hasNamedObject) score = Math.max(score, 3);
  if (meta.hasRecurringToken) score = Math.max(score, 2);
  // Heuristics from text
  const lower = text.toLowerCase();
  if (/\b(waada|promise|vow|kasam)\b/.test(lower)) score = Math.max(score, 4);
  if (/\b(photograph|tasveer|photo|scarf|ring|key|diary|letter)\b/.test(lower)) score = Math.max(score, 3);
  if (/\b(maafi|apolog|dhokha|betray|secret|raaz)\b/.test(lower)) score = Math.max(score, 3);
  if (/\b(pyaar|love|nafrat|hate)\b/.test(lower)) score = Math.max(score, 3);
  // Short trivial text caps to 2, but important signals are exempt
  if (text.length < 20 && score < 3) score = Math.min(score, 2);
  return score as ImportanceLevel;
}

// Simple trivial filter: short greetings, etc.
export function isTrivial(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 12) return true;
  const trivialPatterns = [
    /^(hi|hello|hey|namaste|hmm|ok|okay|haan|nahi|acha|arre|kya|kyu|hello ji)\b/,
    /^(lol|haha|😂|❤️|😊|👍)$/,
    /^.{0,15}\?$/,
  ];
  // Very short generic chat
  if (t.split(/\s+/).length <= 3 && !t.includes('waada') && !t.includes('promise')) return true;
  for (const p of trivialPatterns) if (p.test(t)) return true;
  return false;
}

// ------------------------------------------------------------------
// Extraction: structured output from AI response
// ------------------------------------------------------------------

export interface RawExtraction {
  location?: string;
  activity?: string;
  scene?: string;
  presentCharacters?: string[];
  characterActions?: Record<string, string>;
  characterMoods?: Record<string, string>;
  playerAction?: string;
  storyTime?: { clockTime?: string; timeOfDay?: string; dayDelta?: number };
  relationships?: Record<string, number>; // legacy delta
  relationshipDetails?: Record<string, { trust?: number; affection?: number; tension?: number; summary?: string }>;
  importantObjects?: { name: string; holder?: string; location?: string; significance?: string }[];
  activeEvents?: string[];
  completedEvents?: string[];
  threads?: { title: string; status?: string; involvedCharacters?: string[]; relatedLocation?: string; importance?: number }[];
  threadsResolved?: string[];
  facts?: string[]; // semantic facts
  episodicFacts?: string[]; // alternative
  importance?: number;
  confidence?: Confidence;
}

export function validateExtraction(raw: unknown): RawExtraction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // Sanitize each field, drop malformed
  const out: RawExtraction = {};

  if (typeof o.location === 'string' && o.location.trim().length && o.location.trim().length < 120) {
    out.location = sanitize(o.location.trim(), 120);
  }
  if (typeof o.activity === 'string' && o.activity.trim().length < 200) {
    out.activity = sanitize(o.activity.trim(), 200);
  }
  if (typeof o.scene === 'string' && o.scene.trim().length < 120) {
    out.scene = sanitize(o.scene.trim(), 120);
  }
  if (Array.isArray(o.presentCharacters)) {
    const arr = o.presentCharacters.filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.trim().length < 40).map((s) => s.trim());
    if (arr.length) out.presentCharacters = arr.slice(0, 8);
  }
  if (o.characterActions && typeof o.characterActions === 'object' && !Array.isArray(o.characterActions)) {
    out.characterActions = {};
    for (const [k, v] of Object.entries(o.characterActions as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length < 200) out.characterActions[k] = sanitize(v, 200);
    }
    if (!Object.keys(out.characterActions).length) delete out.characterActions;
  }
  if (o.characterMoods && typeof o.characterMoods === 'object' && !Array.isArray(o.characterMoods)) {
    out.characterMoods = {};
    for (const [k, v] of Object.entries(o.characterMoods as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length < 100) out.characterMoods[k] = sanitize(v, 100);
    }
    if (!Object.keys(out.characterMoods).length) delete out.characterMoods;
  }
  if (typeof o.playerAction === 'string' && o.playerAction.trim().length < 200) {
    out.playerAction = sanitize(o.playerAction.trim(), 200);
  }
  if (o.storyTime && typeof o.storyTime === 'object' && !Array.isArray(o.storyTime)) {
    const st = o.storyTime as Record<string, unknown>;
    const patch: NonNullable<RawExtraction['storyTime']> = {};
    if (typeof st.clockTime === 'string' && st.clockTime.trim().length < 20) patch.clockTime = st.clockTime.trim();
    if (typeof st.timeOfDay === 'string' && ['dawn','morning','afternoon','evening','night','late-night'].includes(st.timeOfDay.trim().toLowerCase())) {
      patch.timeOfDay = st.timeOfDay.trim().toLowerCase();
    }
    if (typeof st.dayDelta === 'number' && Number.isFinite(st.dayDelta) && Math.abs(st.dayDelta) <= 10) {
      patch.dayDelta = Math.trunc(st.dayDelta);
    }
    if (Object.keys(patch).length) out.storyTime = patch;
  }
  if (o.relationships && typeof o.relationships === 'object' && !Array.isArray(o.relationships)) {
    out.relationships = {};
    for (const [k, v] of Object.entries(o.relationships as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100) out.relationships[k] = v;
    }
    if (!Object.keys(out.relationships).length) delete out.relationships;
  }
  if (o.importantObjects && Array.isArray(o.importantObjects)) {
    const arr: NonNullable<RawExtraction['importantObjects']> = [];
    for (const rawObj of o.importantObjects.slice(0, 6)) {
      if (!rawObj || typeof rawObj !== 'object') continue;
      const ro = rawObj as Record<string, unknown>;
      if (typeof ro.name === 'string' && ro.name.trim().length && ro.name.trim().length < 80) {
        const entry: { name: string; holder?: string; location?: string; significance?: string } = { name: sanitize(ro.name.trim(), 80) };
        if (typeof ro.holder === 'string' && ro.holder.length < 40) entry.holder = sanitize(ro.holder, 40);
        if (typeof ro.location === 'string' && ro.location.length < 80) entry.location = sanitize(ro.location, 80);
        if (typeof ro.significance === 'string' && ro.significance.length < 120) entry.significance = sanitize(ro.significance, 120);
        arr.push(entry);
      }
    }
    if (arr.length) out.importantObjects = arr;
  }
  if (o.activeEvents && Array.isArray(o.activeEvents)) {
    const arr = o.activeEvents.filter((x): x is string => typeof x === 'string' && x.trim().length > 2 && x.trim().length < 100).map((s) => sanitize(s.trim(), 100));
    if (arr.length) out.activeEvents = arr.slice(0, 5);
  }
  if (o.completedEvents && Array.isArray(o.completedEvents)) {
    const arr = o.completedEvents.filter((x): x is string => typeof x === 'string' && x.trim().length > 2 && x.trim().length < 100).map((s) => sanitize(s.trim(), 100));
    if (arr.length) out.completedEvents = arr.slice(0, 5);
  }
  if (o.threads && Array.isArray(o.threads)) {
    const arr: NonNullable<RawExtraction['threads']> = [];
    for (const rawTh of o.threads.slice(0, 6)) {
      if (!rawTh || typeof rawTh !== 'object') continue;
      const rt = rawTh as Record<string, unknown>;
      if (typeof rt.title === 'string' && rt.title.trim().length && rt.title.trim().length < 120) {
        const th: NonNullable<RawExtraction['threads']>[number] = { title: sanitize(rt.title.trim(), 120) };
        if (typeof rt.status === 'string' && ['active','unresolved','resolved'].includes(rt.status)) th.status = rt.status;
        if (Array.isArray(rt.involvedCharacters)) {
          const chars = rt.involvedCharacters.filter((x): x is string => typeof x === 'string' && x.trim().length < 40).map((s) => s.trim()).slice(0, 5);
          if (chars.length) th.involvedCharacters = chars;
        }
        if (typeof rt.relatedLocation === 'string' && rt.relatedLocation.trim().length < 80) th.relatedLocation = sanitize(rt.relatedLocation.trim(), 80);
        if (typeof rt.importance === 'number' && Number.isFinite(rt.importance)) th.importance = Math.max(1, Math.min(4, Math.trunc(rt.importance)));
        arr.push(th);
      }
    }
    if (arr.length) out.threads = arr;
  }
  if (o.threadsResolved && Array.isArray(o.threadsResolved)) {
    const arr = o.threadsResolved.filter((x): x is string => typeof x === 'string' && x.trim().length > 2).map((s) => sanitize(s.trim(), 120));
    if (arr.length) out.threadsResolved = arr.slice(0, 5);
  }
  if (o.facts && Array.isArray(o.facts)) {
    const arr = o.facts.filter((x): x is string => typeof x === 'string' && x.trim().length > 4 && x.trim().length < MEMORY_MAX_CHARS).map((s) => sanitize(s.trim(), MEMORY_MAX_CHARS));
    if (arr.length) out.facts = arr.slice(0, 8);
  }
  if (o.episodicFacts && Array.isArray(o.episodicFacts)) {
    const arr = o.episodicFacts.filter((x): x is string => typeof x === 'string' && x.trim().length > 4).map((s) => sanitize(s.trim(), MEMORY_MAX_CHARS));
    if (arr.length) {
      out.facts = [...(out.facts ?? []), ...arr].slice(0, 8);
    }
  }
  // Filter out private data
  if (out.facts) {
    out.facts = out.facts.filter((f) => !looksTooPrivate(f));
    if (!out.facts.length) delete out.facts;
  }
  if (typeof o.confidence === 'string' && ['high','medium','low'].includes(o.confidence)) {
    out.confidence = o.confidence as Confidence;
  } else {
    out.confidence = 'medium';
  }

  // If nothing meaningful, return null to skip update
  const hasSomething = !!(out.location || out.activity || out.presentCharacters || out.playerAction || out.facts || out.threads || out.importantObjects || out.relationships || out.activeEvents || out.completedEvents);
  if (!hasSomething) return null;
  return out;
}

// Extract deterministic signals from user+assistant text when AI didn't emit structured block
export function heuristicExtraction(userText: string, assistantText: string, bundle: StoryBundle, currentWorld: WorldState): RawExtraction | null {
  const combined = `${userText} ${assistantText}`.toLowerCase();
  const out: RawExtraction = { confidence: 'low' };
  let has = false;

  // Location heuristics: look for known location names mentioned
  for (const loc of bundle.world.locations) {
    const name = loc.name.toLowerCase();
    if (combined.includes(name) || combined.includes(name.split(' ')[0].toLowerCase())) {
      // Check for movement verbs near location
      if (/\b(gaya|gayi|ja raha|ja rahi|enter|entered|walked|pahucha|aaya|aayi|chala|chali)\b/.test(combined)) {
        out.location = loc.name;
        has = true;
        break;
      }
    }
  }

  // Character arrival/departure heuristics
  const present: string[] = [];
  for (const ch of bundle.characters.characters) {
    const lower = ch.name.toLowerCase();
    if (combined.includes(lower)) {
      // If mentioned, assume present unless says left/went away
      if (!/\b(chala gaya|chali gayi|left|went away|nikal gaya)\b/.test(combined)) {
        present.push(ch.id);
      }
    }
  }
  if (present.length && present.length !== currentWorld.presentCharacters.length) {
    out.presentCharacters = present;
    has = true;
  }

  // Object discovery: look for important objects
  for (const obj of bundle.world.importantObjects) {
    const name = obj.name.toLowerCase();
    if (combined.includes(name)) {
      out.importantObjects = out.importantObjects ?? [];
      out.importantObjects.push({ name: obj.name, location: currentWorld.currentLocation ?? undefined });
      has = true;
    }
  }

  // Threads: if photograph etc. mentioned
  if (/\b(photograph|tasveer|photo|picture)\b/.test(combined)) {
    out.threads = [{ title: 'Unknown photograph', status: 'unresolved', involvedCharacters: present.slice(0, 2), relatedLocation: currentWorld.currentLocation ?? undefined, importance: 3 }];
    has = true;
  }

  // Activity: simple
  if (/\b(baat kar raha|conversation|talking|discussing|arguing|ladai|jhadga)\b/.test(combined)) {
    // Keep existing
  }

  return has ? out : null;
}

// Convert RawExtraction to StateUpdate
export function toStateUpdate(extraction: RawExtraction, currentWorld: WorldState, evidence: string | null): StateUpdate {
  const confidence = extraction.confidence ?? 'medium';
  const update: StateUpdate = { confidence, evidence: evidence ?? undefined };

  if (extraction.location) update.currentLocation = extraction.location;
  if (extraction.activity) update.currentActivity = extraction.activity;
  if (extraction.scene) update.currentScene = extraction.scene;
  if (extraction.presentCharacters) update.presentCharacters = extraction.presentCharacters;
  if (extraction.characterActions || extraction.characterMoods) {
    update.characterStatesPatch = {};
    const allIds = new Set<string>([...Object.keys(extraction.characterActions ?? {}), ...Object.keys(extraction.characterMoods ?? {})]);
    for (const id of allIds) {
      update.characterStatesPatch[id] = {
        activity: extraction.characterActions?.[id] ?? undefined,
        mood: extraction.characterMoods?.[id] ?? undefined,
      };
    }
  }
  if (extraction.playerAction) update.playerStatePatch = { action: extraction.playerAction };
  if (extraction.relationships) {
    update.relationshipPatch = {};
    for (const [k, v] of Object.entries(extraction.relationships)) {
      update.relationshipPatch[k] = { deltaTrust: v, confidence };
    }
  }
  if (extraction.relationshipDetails) {
    update.relationshipPatch = update.relationshipPatch ?? {};
    for (const [k, v] of Object.entries(extraction.relationshipDetails)) {
      update.relationshipPatch[k] = { ...(update.relationshipPatch[k] ?? {}), ...v, confidence };
    }
  }
  if (extraction.importantObjects) {
    update.importantObjectsPatch = {};
    for (const obj of extraction.importantObjects) {
      const id = obj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      update.importantObjectsPatch[id] = { id, name: obj.name, holder: obj.holder ?? null, location: obj.location ?? null, significance: obj.significance ?? null };
    }
  }
  if (extraction.activeEvents) update.activeEventsAdd = extraction.activeEvents.map((title) => ({ title }));
  if (extraction.completedEvents) update.completedEventsAdd = extraction.completedEvents.map((title) => ({ title }));
  if (extraction.threads) {
    update.threadsAdd = extraction.threads.map((t) => ({
      title: t.title,
      status: (t.status as any) ?? 'unresolved',
      involvedCharacters: t.involvedCharacters,
      relatedLocation: t.relatedLocation,
      importance: t.importance,
    }));
  }
  if (extraction.threadsResolved) update.threadsResolve = extraction.threadsResolved;
  if (extraction.storyTime) {
    const patch: Record<string, unknown> = {};
    if (extraction.storyTime.clockTime) patch.clockTime = extraction.storyTime.clockTime;
    if (extraction.storyTime.timeOfDay) patch.timeOfDay = extraction.storyTime.timeOfDay;
    if (extraction.storyTime.dayDelta !== undefined) {
      const currentDay = currentWorld.storyTime.day;
      patch.day = currentDay + extraction.storyTime.dayDelta;
    }
    if (Object.keys(patch).length) update.storyTimePatch = patch as any;
    // Also bump elapsed if time progressed
    if (extraction.storyTime.clockTime && currentWorld.storyTime.clockTime) {
      // Simple: add 15 min per turn if clock moved forward? We'll add 5 min deterministically
      update.storyTimePatch = { ...(update.storyTimePatch ?? {}), elapsedMinutes: currentWorld.storyTime.elapsedMinutes + 5 };
    } else if (extraction.storyTime.clockTime) {
      update.storyTimePatch = { ...(update.storyTimePatch ?? {}), elapsedMinutes: currentWorld.storyTime.elapsedMinutes + 5 };
    }
  } else {
    // Default time progression: +2-5 min per turn deterministically
    const jitter = 3; // fixed to avoid randomness for tests
    update.storyTimePatch = { elapsedMinutes: currentWorld.storyTime.elapsedMinutes + jitter };
    // Auto advance timeOfDay after long elapsed? Keep simple: if elapsed > 240 (4h) advance day?
  }

  return update;
}

// ------------------------------------------------------------------
// Write pipeline
// ------------------------------------------------------------------

export interface WritePipelineInput {
  playthrough: Playthrough;
  bundle: StoryBundle;
  userText: string;
  assistantText: string;
  parsedExtractionRaw?: unknown; // from kissa-state block
  worldState?: WorldState | null;
}

export interface WritePipelineResult {
  worldState: WorldState;
  storedFacts: number;
  episodeStored: boolean;
  threadsUpdated: number;
}

export async function runMemoryWritePipeline(input: WritePipelineInput): Promise<WritePipelineResult> {
  const { playthrough, bundle, userText, assistantText } = input;
  let ws = input.worldState ?? (await getWorldState(playthrough.id));
  if (!ws) {
    ws = await ensureWorldState(playthrough, bundle);
  }

  // Step 1: try structured extraction from AI block
  let rawExtraction: RawExtraction | null = null;
  if (input.parsedExtractionRaw) {
    rawExtraction = validateExtraction(input.parsedExtractionRaw);
  }
  // Step 2: if no structured block, try deterministic + heuristic
  if (!rawExtraction) {
    rawExtraction = heuristicExtraction(userText, assistantText, bundle, ws);
  }
  // Step 3: also extract facts heuristically even if structured present
  // Merge heuristic threads/objects? For now trust structured primary, but also check heuristic for missing

  let worldStateUpdated = ws;
  let threadsUpdated = 0;

  if (rawExtraction) {
    const evidence = `${userText} ${assistantText}`.slice(0, 400);
    const update = toStateUpdate(rawExtraction, ws, evidence);
    // Validate contradiction before applying
    const next = applyWorldStateUpdate(ws, update);
    if (next !== ws) {
      try {
        await setWorldState(next);
        worldStateUpdated = next;
        threadsUpdated = (next.unresolvedThreads.length - ws.unresolvedThreads.length) + (next.resolvedThreads.length - ws.resolvedThreads.length);
      } catch {
        // Keep last valid state on failure
        worldStateUpdated = ws;
      }
    }
    // Store facts into memories table with importance
    if (rawExtraction.facts && rawExtraction.facts.length) {
      for (const fact of rawExtraction.facts) {
        if (isTrivial(fact)) continue;
        const importance = deterministicImportance(fact, {
          isPromise: /\b(waada|promise)\b/i.test(fact),
          isDiscovery: /\b(mila|mili|discovered|found|photograph)\b/i.test(fact),
          hasNamedObject: /\b(photograph|ring|key|diary|letter|scarf)\b/i.test(fact),
        });
        if (importance < 2 && fact.length < 30) continue; // filter low importance tiny
        const clean = sanitize(fact, MEMORY_MAX_CHARS);
        if (clean.length < 8) continue;
        await insertMemory(
          {
            id: uid('mem'),
            playthroughId: playthrough.id,
            kind: inferMemoryKind(fact, bundle),
            text: clean,
            importance,
            createdAt: nowIso(),
            hash: hashText(clean),
            hits: 0,
            archived: false,
          },
          hashText(clean),
        ).catch(() => {});
      }
    }
  }

  // Always log episodic trace (never filtered as trivial if has substance)
  let episodeStored = false;
  const episodeText = buildEpisodeLine(userText, assistantText);
  if (episodeText && !looksTooPrivate(episodeText)) {
    try {
      await insertMemory(
        {
          id: uid('mem'),
          playthroughId: playthrough.id,
          kind: 'episode',
          text: episodeText,
          importance: 1,
          createdAt: nowIso(),
          hash: hashText(episodeText),
          hits: 0,
          archived: false,
        },
        hashText(episodeText),
      );
      episodeStored = true;
    } catch {}
  }

  return { worldState: worldStateUpdated, storedFacts: rawExtraction?.facts?.length ?? 0, episodeStored, threadsUpdated };
}

function inferMemoryKind(fact: string, bundle: StoryBundle): 'story' | 'character' | 'world' {
  const lower = fact.toLowerCase();
  // Character name mention -> character
  for (const ch of bundle.characters.characters) {
    if (lower.includes(ch.name.toLowerCase())) return 'character';
  }
  // Location mention -> world
  for (const loc of bundle.world.locations) {
    if (lower.includes(loc.name.toLowerCase())) return 'world';
  }
  return 'story';
}

function buildEpisodeLine(userText: string, assistantText: string): string {
  const u = sanitize(userText, 100);
  const a = sanitize(assistantText.replace(/\*/g, ''), 150);
  return `U: ${u}${a ? ` | ${a}` : ''}`.slice(0, 260);
}

// ------------------------------------------------------------------
// Read pipeline: builds compact context package
// ------------------------------------------------------------------

export interface MemoryReadResult {
  worldState: WorldState | null;
  memories: MemoryEntry[]; // selected relevant
  summary: string;
  immediateContext: string; // last few turns rendered
  candidates: number;
}

export async function recallWithWorldState(
  playthrough: Playthrough,
  bundle: StoryBundle,
  queryText: string,
  recentHistory: ChatMessage[],
  pool: MemoryEntry[],
  summary: string,
  opts: { charBudget?: number; maxItems?: number } = {},
): Promise<MemoryReadResult> {
  const ws = await getWorldState(playthrough.id);
  const charBudget = opts.charBudget ?? 3800;
  const maxItems = opts.maxItems ?? 28;

  // Build immediate context: last 4 turns
  const immediate = recentHistory.slice(-6).map((m) => `${m.role === 'user' ? 'Player' : m.speaker ?? 'Narrator'}: ${m.text.slice(0, 120)}`).join('\n');

  // Character/location aware scoring: boost memories that match current scene
  const location = ws?.currentLocation?.toLowerCase() ?? '';
  const presentNames = ws?.presentCharacters.map((id) => ws.characterStates[id]?.name?.toLowerCase() ?? id.toLowerCase()) ?? [];
  const threadTitles = ws?.unresolvedThreads.map((t) => t.title.toLowerCase()) ?? [];

  // Create augmented query that includes world state cues
  const augmentedQuery = [queryText, location, ...presentNames, ...threadTitles].join(' ');

  // Use existing selectRelevant but with augmented query
  const queryProfile = buildQuery(augmentedQuery);

  // Pre-score with bonuses for character/location/thread matches
  const scored = pool.map((m) => {
    let bonus = 0;
    const lower = m.text.toLowerCase();
    if (location && lower.includes(location)) bonus += 8;
    for (const pn of presentNames) if (pn && lower.includes(pn)) bonus += 6;
    for (const th of threadTitles) if (th && lower.includes(th.split(' ')[0])) bonus += 5;
    // Character-specific: if memory mentions a present character, prioritize
    const baseScore = overlapScore(m.text, queryProfile) * 3 + m.importance * 2;
    return { m, score: baseScore + bonus, lower };
  });
  scored.sort((a, b) => b.score - a.score);

  // Select within budget, pinned by importance & world relevance
  const chosen: MemoryEntry[] = [];
  let used = 0;
  const seen = new Set<string>();

  // 1) Always include unresolved threads as synthetic memories? We'll inject via world state block, not as memory entries.
  // 2) Pick top scored within budget
  for (const s of scored) {
    if (chosen.length >= maxItems) break;
    if (used + s.m.text.length > charBudget && chosen.length >= 4) break;
    if (seen.has(s.m.id)) continue;
    if (s.m.archived) continue;
    // Filter trivial with low score
    if (s.score < 2 && s.m.importance <= 1 && chosen.length >= 8) continue;
    seen.add(s.m.id);
    chosen.push(s.m);
    used += s.m.text.length + 3;
  }

  // If ws has threads, prioritize memories mentioning them even if low score? Already boosted.

  return { worldState: ws, memories: chosen, summary, immediateContext: immediate, candidates: pool.length };
}

// Re-export helpers for tests
export { sanitize, hashText, looksTooPrivate };
