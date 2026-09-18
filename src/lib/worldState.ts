/**
 * KISSA GOD-LEVEL MEMORY — WORLD STATE ENGINE
 *
 * Layer 2: Current World State
 * Layer 6: Location Memory
 * Layer 7: Temporal Memory
 * Layer 8: Relationship Memory
 * Layer 9: Open Threads / Story Threads
 *
 * Single source of truth for "what is CURRENTLY happening".
 * Persists as validated JSON in SQLite KV (worldState:<playthroughId>).
 * Keeps previous valid state for rollback on malformed updates.
 * Contradiction protection prevents weak inference from overwriting strong state.
 */

import { getDb, kvDelete, kvGet, kvSet } from './db';
import { nowIso } from './utils';
import type { Playthrough, StoryBundle } from '../types';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late-night' | null;

export type Confidence = 'high' | 'medium' | 'low';

export interface StoryTime {
  day: number; // 1-indexed
  timeOfDay: TimeOfDay;
  clockTime: string | null; // e.g. "8:42 PM" or null
  elapsedMinutes: number; // total story minutes elapsed (for progression)
  lastUpdated: string; // ISO
}

export interface CharacterPresence {
  id: string;
  name: string;
  present: boolean;
  activity: string | null;
  mood: string | null;
  lastSeenLocation: string | null;
  lastSeenAt: string | null;
  arrivalConfidence: Confidence;
}

export interface RelationshipDetail {
  trust: number; // 0-100
  familiarity: number;
  affection: number;
  respect: number;
  tension: number;
  loyalty: number;
  conflict: number;
  summary?: string;
  lastUpdated: string;
}

export interface ImportantObjectState {
  id: string;
  name: string;
  description?: string;
  holder: string | null; // character id / "player" / location name
  location: string | null;
  discoveredAt: string;
  lastSeenAt: string;
  significance: string | null;
}

export interface StoryThread {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'unresolved' | 'resolved';
  importance: number; // 1-4
  involvedCharacters: string[];
  relatedLocation: string | null;
  discoveredAt: string;
  resolvedAt?: string | null;
  lastMentionedAt: string;
}

export interface LocationMemoryEntry {
  id: string;
  name: string;
  description?: string;
  visits: number;
  firstVisitedAt: string | null;
  lastVisitedAt: string | null;
  events: string[]; // event titles that happened here
  characters: string[]; // character ids associated
  objects: string[]; // object ids discovered here
  status: string | null; // e.g. "closed", "burned", "crowded"
  notes: string[];
}

export interface EpisodicEntry {
  id: string;
  text: string;
  involvedCharacters: string[];
  location: string | null;
  storyTime: string | null;
  importance: number;
  resolved: boolean;
  timestamp: string;
}

export interface WorldState {
  version: 2; // schema version
  playthroughId: string;
  storyId: string;
  // Core scene
  currentLocation: string | null;
  previousLocation: string | null;
  currentActivity: string | null;
  currentScene: string | null;
  currentArc: string | null;
  storyTime: StoryTime;
  // Characters
  presentCharacters: string[]; // ids
  absentCharacters: string[];
  characterStates: Record<string, CharacterPresence>;
  playerState: {
    action: string | null;
    mood: string | null;
    location: string | null;
  };
  // Relationships (detailed) + legacy simple map for compat
  relationships: Record<string, RelationshipDetail>;
  legacyRelationships: Record<string, number>; // 0-100 simple
  // Objects & events
  importantObjects: Record<string, ImportantObjectState>;
  activeEvents: { id: string; title: string; startedAt: string; location?: string | null }[];
  completedEvents: { id: string; title: string; completedAt: string; location?: string | null }[];
  unresolvedThreads: StoryThread[];
  resolvedThreads: StoryThread[];
  locationMemory: Record<string, LocationMemoryEntry>;
  // Meta
  episodeCount: number;
  lastTurnAt: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

export const WORLD_STATE_VERSION = 2;
const WORLD_KEY = (id: string) => `worldState:${id}`;
const WORLD_PREV_KEY = (id: string) => `worldStatePrev:${id}`;
const WORLD_SCHEMA_KEY = (id: string) => `worldStateSchema:${id}`;

// ------------------------------------------------------------------
// Initial state
// ------------------------------------------------------------------

export function createInitialWorldState(playthrough: Playthrough, bundle: StoryBundle): WorldState {
  const now = nowIso();
  const initialLocation = playthrough.state.location || bundle.world.locations[0]?.name || null;
  const sceneTitle = bundle.scenes.scenes.find((s) => s.id === playthrough.currentSceneId)?.title || playthrough.currentSceneId;
  return {
    version: 2,
    playthroughId: playthrough.id,
    storyId: playthrough.storyId,
    currentLocation: initialLocation,
    previousLocation: null,
    currentActivity: null,
    currentScene: sceneTitle,
    currentArc: bundle.scenes.scenes[0]?.title || null,
    storyTime: {
      day: 1,
      timeOfDay: 'evening',
      clockTime: null,
      elapsedMinutes: 0,
      lastUpdated: now,
    },
    presentCharacters: [],
    absentCharacters: bundle.characters.characters.map((c) => c.id),
    characterStates: Object.fromEntries(
      bundle.characters.characters.map((c) => [
        c.id,
        {
          id: c.id,
          name: c.name,
          present: false,
          activity: null,
          mood: null,
          lastSeenLocation: null,
          lastSeenAt: null,
          arrivalConfidence: 'low' as Confidence,
        },
      ]),
    ),
    playerState: {
      action: null,
      mood: null,
      location: initialLocation,
    },
    relationships: {},
    legacyRelationships: { ...playthrough.state.relationships },
    importantObjects: {},
    activeEvents: [],
    completedEvents: [],
    unresolvedThreads: [],
    resolvedThreads: [],
    locationMemory: initialLocation
      ? {
          [slugify(initialLocation)]: {
            id: slugify(initialLocation),
            name: initialLocation,
            description: bundle.world.locations.find((l) => l.name === initialLocation)?.description || undefined,
            visits: 1,
            firstVisitedAt: now,
            lastVisitedAt: now,
            events: [],
            characters: [],
            objects: [],
            status: null,
            notes: [],
          },
        }
      : {},
    episodeCount: 0,
    lastTurnAt: now,
    createdAt: now,
    updatedAt: now,
    schemaVersion: WORLD_STATE_VERSION,
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location';
}

// ------------------------------------------------------------------
// Persistence
// ------------------------------------------------------------------

export async function getWorldState(playthroughId: string): Promise<WorldState | null> {
  let raw = await kvGet(WORLD_KEY(playthroughId));
  // Fallback to SQLite mirror if KV missing (e.g. after partial clear or older build)
  if (!raw) {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ state: string }>(
        'SELECT state FROM world_states WHERE playthrough_id = ?',
        playthroughId,
      );
      if (row?.state) raw = row.state;
    } catch {}
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorldState;
    const migrated = migrateWorldState(parsed);
    if (migrated.schemaVersion !== parsed.schemaVersion) {
      await setWorldState(migrated);
      return migrated;
    }
    if (!validateWorldState(migrated)) {
      const prevRaw = await kvGet(WORLD_PREV_KEY(playthroughId));
      if (prevRaw) {
        try {
          const prev = JSON.parse(prevRaw) as WorldState;
          if (validateWorldState(prev)) return prev;
        } catch {}
      }
      return null;
    }
    return migrated;
  } catch {
    const prevRaw = await kvGet(WORLD_PREV_KEY(playthroughId));
    if (prevRaw) {
      try {
        const prev = JSON.parse(prevRaw) as WorldState;
        if (validateWorldState(prev)) return prev;
      } catch {}
    }
    return null;
  }
}

export async function setWorldState(state: WorldState): Promise<void> {
  if (!validateWorldState(state)) throw new Error('Invalid world state');
  const existingRaw = await kvGet(WORLD_KEY(state.playthroughId));
  if (existingRaw) {
    try {
      await kvSet(WORLD_PREV_KEY(state.playthroughId), existingRaw);
    } catch {}
  }
  state.updatedAt = nowIso();
  const payload = JSON.stringify(state);
  await kvSet(WORLD_KEY(state.playthroughId), payload);
  await kvSet(WORLD_SCHEMA_KEY(state.playthroughId), String(state.schemaVersion));
  // SQLite mirror — best effort, never blocks prompt
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO world_states (playthrough_id, story_id, state, version, updated_at) VALUES (?, ?, ?, ?, ?)',
      state.playthroughId,
      state.storyId,
      payload,
      state.version,
      state.updatedAt,
    );
  } catch {}
}

export async function clearWorldState(playthroughId: string): Promise<void> {
  await kvDelete(WORLD_KEY(playthroughId));
  await kvDelete(WORLD_PREV_KEY(playthroughId));
  await kvDelete(WORLD_SCHEMA_KEY(playthroughId));
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM world_states WHERE playthrough_id = ?', playthroughId);
  } catch {}
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

export function validateWorldState(s: unknown): s is WorldState {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  if (o.version !== 2) return false;
  if (typeof o.playthroughId !== 'string' || !o.playthroughId) return false;
  if (typeof o.storyId !== 'string' || !o.storyId) return false;
  if (o.currentLocation !== null && typeof o.currentLocation !== 'string') return false;
  if (o.currentScene !== null && typeof o.currentScene !== 'string') return false;
  if (!o.storyTime || typeof o.storyTime !== 'object') return false;
  const st = o.storyTime as Record<string, unknown>;
  if (typeof st.day !== 'number' || st.day < 1) return false;
  if (!Array.isArray(o.presentCharacters)) return false;
  if (!o.playerState || typeof o.playerState !== 'object') return false;
  if (!o.characterStates || typeof o.characterStates !== 'object') return false;
  // Must have schemaVersion
  if (typeof o.schemaVersion !== 'number') return false;
  return true;
}

// ------------------------------------------------------------------
// Migration
// ------------------------------------------------------------------

export function migrateWorldState(raw: unknown): WorldState {
  if (!raw || typeof raw !== 'object') throw new Error('Cannot migrate null world state');
  const o = raw as Record<string, unknown>;
  // v1 -> v2: added resolvedThreads, legacyRelationships etc.
  if (o.version === 1 || o.schemaVersion === 1) {
    const v1 = o as unknown as WorldState & { schemaVersion: number };
    const migrated: WorldState = {
      ...(v1 as WorldState),
      version: 2,
      schemaVersion: 2,
      resolvedThreads: (v1 as any).resolvedThreads ?? [],
      legacyRelationships: (v1 as any).legacyRelationships ?? {},
      episodeCount: (v1 as any).episodeCount ?? 0,
    };
    // Ensure all new fields exist
    if (!migrated.locationMemory) migrated.locationMemory = {};
    if (!migrated.importantObjects) migrated.importantObjects = {};
    if (!Array.isArray(migrated.unresolvedThreads)) migrated.unresolvedThreads = [];
    if (!Array.isArray(migrated.resolvedThreads)) migrated.resolvedThreads = [];
    return migrated;
  }
  if (o.version === 2 || o.schemaVersion === 2) {
    // Fill missing defaults for backward compat
    const cur = o as unknown as WorldState;
    if (!cur.resolvedThreads) cur.resolvedThreads = [];
    if (!cur.legacyRelationships) cur.legacyRelationships = {};
    if (!cur.locationMemory) cur.locationMemory = {};
    if (!cur.importantObjects) cur.importantObjects = {};
    cur.schemaVersion = 2;
    cur.version = 2;
    return cur;
  }
  // Unknown version: try to coerce or return as is if validates
  if (validateWorldState(raw)) return raw as WorldState;
  throw new Error('Unknown world state version');
}

// ------------------------------------------------------------------
// Contradiction protection
// ------------------------------------------------------------------

export interface StateUpdate {
  currentLocation?: string | null;
  previousLocation?: string | null;
  currentActivity?: string | null;
  currentScene?: string | null;
  currentArc?: string | null;
  presentCharacters?: string[];
  characterStatesPatch?: Record<string, Partial<CharacterPresence>>;
  playerStatePatch?: Partial<WorldState['playerState']>;
  relationshipPatch?: Record<string, Partial<RelationshipDetail> & { deltaTrust?: number; confidence?: Confidence }>;
  importantObjectsPatch?: Record<string, Partial<ImportantObjectState>>;
  activeEventsAdd?: { title: string }[];
  completedEventsAdd?: { title: string }[];
  threadsAdd?: Partial<StoryThread>[];
  threadsResolve?: string[]; // thread ids
  locationPatch?: Record<string, Partial<LocationMemoryEntry>>;
  storyTimePatch?: Partial<StoryTime>;
  confidence: Confidence;
  evidence?: string; // textual evidence of transition (e.g. "player walked to library")
}

export function canApplyUpdate(current: WorldState, update: StateUpdate): { allowed: boolean; reason?: string } {
  // Location: don't blindly overwrite without evidence
  if (update.currentLocation && update.currentLocation !== current.currentLocation) {
    if (update.confidence === 'low' && !update.evidence) {
      return { allowed: false, reason: 'low confidence location change without evidence' };
    }
    // If same previous location already, that's okay with medium+ confidence
    if (update.confidence === 'medium' && !update.evidence && current.currentLocation) {
      // Allow if location is known world location? For now require high for silent
      return { allowed: false, reason: 'medium confidence location needs evidence' };
    }
  }
  // Character presence: cannot make character present in two places simultaneously check not needed here
  // But prevent re-adding absent without evidence
  // Relationship: don't revert high trust with low confidence delta
  if (update.relationshipPatch) {
    for (const [charId, patch] of Object.entries(update.relationshipPatch)) {
      const existing = current.relationships[charId];
      if (existing && patch.confidence === 'low') {
        // Don't let low confidence overwrite high existing values by large delta
        const trustDelta = (patch as any).deltaTrust ?? 0;
        if (Math.abs(trustDelta) > 20) {
          return { allowed: false, reason: `low confidence large relationship delta for ${charId}` };
        }
      }
    }
  }
  // Thread: prevent resolved becoming unresolved
  if (update.threadsAdd) {
    for (const t of update.threadsAdd) {
      if (t.id && current.resolvedThreads.some((rt) => rt.id === t.id)) {
        return { allowed: false, reason: `thread ${t.id} already resolved` };
      }
    }
  }
  // Completed events shouldn't become active again
  // For now, allow only if high confidence
  return { allowed: true };
}

export function applyWorldStateUpdate(current: WorldState, update: StateUpdate): WorldState {
  const check = canApplyUpdate(current, update);
  if (!check.allowed) {
    // For low confidence contradictions, keep current state
    return current;
  }
  const next: WorldState = JSON.parse(JSON.stringify(current)) as WorldState;
  const now = nowIso();

  // Location
  if (update.currentLocation !== undefined && update.currentLocation !== null) {
    if (update.currentLocation !== current.currentLocation) {
      next.previousLocation = current.currentLocation;
      next.currentLocation = update.currentLocation;
      // Location memory update
      const slug = slugify(update.currentLocation);
      if (!next.locationMemory[slug]) {
        next.locationMemory[slug] = {
          id: slug,
          name: update.currentLocation,
          visits: 1,
          firstVisitedAt: now,
          lastVisitedAt: now,
          events: [],
          characters: [],
          objects: [],
          status: null,
          notes: [],
        };
      } else {
        next.locationMemory[slug].visits += 1;
        next.locationMemory[slug].lastVisitedAt = now;
      }
      // Update player location
      next.playerState.location = update.currentLocation;
    }
  }
  if (update.currentActivity !== undefined) next.currentActivity = update.currentActivity;
  if (update.currentScene !== undefined) next.currentScene = update.currentScene;
  if (update.currentArc !== undefined) next.currentArc = update.currentArc;

  // Present characters
  if (update.presentCharacters) {
    next.presentCharacters = [...new Set(update.presentCharacters)];
    next.absentCharacters = Object.keys(next.characterStates).filter((id) => !next.presentCharacters.includes(id));
    for (const id of next.presentCharacters) {
      if (!next.characterStates[id]) {
        next.characterStates[id] = {
          id,
          name: id,
          present: true,
          activity: null,
          mood: null,
          lastSeenLocation: next.currentLocation,
          lastSeenAt: now,
          arrivalConfidence: update.confidence,
        };
      } else {
        next.characterStates[id].present = true;
        next.characterStates[id].lastSeenLocation = next.currentLocation;
        next.characterStates[id].lastSeenAt = now;
        next.characterStates[id].arrivalConfidence = update.confidence;
      }
    }
    for (const id of next.absentCharacters) {
      if (next.characterStates[id]) next.characterStates[id].present = false;
    }
  }

  if (update.characterStatesPatch) {
    for (const [id, patch] of Object.entries(update.characterStatesPatch)) {
      if (!next.characterStates[id]) {
        next.characterStates[id] = {
          id,
          name: id,
          present: false,
          activity: null,
          mood: null,
          lastSeenLocation: null,
          lastSeenAt: null,
          arrivalConfidence: 'low',
        };
      }
      Object.assign(next.characterStates[id], patch);
      if (patch.activity !== undefined) next.characterStates[id].activity = patch.activity ?? null;
      if (patch.mood !== undefined) next.characterStates[id].mood = patch.mood ?? null;
    }
  }

  if (update.playerStatePatch) {
    Object.assign(next.playerState, update.playerStatePatch);
  }

  // Relationships
  if (update.relationshipPatch) {
    for (const [charId, patch] of Object.entries(update.relationshipPatch)) {
      if (!next.relationships[charId]) {
        next.relationships[charId] = {
          trust: 50,
          familiarity: 20,
          affection: 20,
          respect: 50,
          tension: 10,
          loyalty: 30,
          conflict: 0,
          lastUpdated: now,
        };
      }
      const rel = next.relationships[charId];
      if ((patch as any).deltaTrust !== undefined) {
        rel.trust = clamp(rel.trust + (patch as any).deltaTrust, 0, 100);
      }
      if (patch.trust !== undefined) rel.trust = clamp(patch.trust, 0, 100);
      if (patch.familiarity !== undefined) rel.familiarity = clamp(patch.familiarity, 0, 100);
      if (patch.affection !== undefined) rel.affection = clamp(patch.affection, 0, 100);
      if (patch.respect !== undefined) rel.respect = clamp(patch.respect, 0, 100);
      if (patch.tension !== undefined) rel.tension = clamp(patch.tension, 0, 100);
      if (patch.loyalty !== undefined) rel.loyalty = clamp(patch.loyalty, 0, 100);
      if (patch.conflict !== undefined) rel.conflict = clamp(patch.conflict, 0, 100);
      if ((patch as any).summary !== undefined) rel.summary = (patch as any).summary;
      rel.lastUpdated = now;
      // Sync legacy simple map: trust as proxy
      next.legacyRelationships[charId] = rel.trust;
    }
  }

  // Objects
  if (update.importantObjectsPatch) {
    for (const [key, patch] of Object.entries(update.importantObjectsPatch)) {
      const id = patch.id ?? slugify(patch.name ?? key);
      if (!next.importantObjects[id]) {
        next.importantObjects[id] = {
          id,
          name: patch.name ?? key,
          holder: patch.holder ?? null,
          location: patch.location ?? next.currentLocation,
          discoveredAt: now,
          lastSeenAt: now,
          significance: patch.significance ?? null,
          description: patch.description,
        };
      } else {
        Object.assign(next.importantObjects[id], patch);
        next.importantObjects[id].lastSeenAt = now;
      }
    }
  }

  // Events
  if (update.activeEventsAdd) {
    for (const ev of update.activeEventsAdd) {
      const id = slugify(ev.title);
      if (!next.activeEvents.some((e) => e.id === id) && !next.completedEvents.some((e) => e.id === id)) {
        next.activeEvents.push({ id, title: ev.title, startedAt: now, location: next.currentLocation });
      }
    }
  }
  if (update.completedEventsAdd) {
    for (const ev of update.completedEventsAdd) {
      const id = slugify(ev.title);
      next.activeEvents = next.activeEvents.filter((e) => e.id !== id);
      if (!next.completedEvents.some((e) => e.id === id)) {
        next.completedEvents.push({ id, title: ev.title, completedAt: now, location: next.currentLocation });
      }
    }
  }

  // Threads
  if (update.threadsAdd) {
    for (const t of update.threadsAdd) {
      const id = t.id ?? slugify(t.title ?? `thread-${Date.now()}`);
      if (next.unresolvedThreads.some((th) => th.id === id) || next.resolvedThreads.some((th) => th.id === id)) continue;
      const thread: StoryThread = {
        id,
        title: t.title ?? 'Untitled thread',
        description: t.description,
        status: (t.status as StoryThread['status']) ?? 'unresolved',
        importance: t.importance ?? 2,
        involvedCharacters: t.involvedCharacters ?? [],
        relatedLocation: t.relatedLocation ?? next.currentLocation,
        discoveredAt: now,
        lastMentionedAt: now,
      };
      if (thread.status === 'resolved') {
        thread.resolvedAt = now;
        next.resolvedThreads.push(thread);
      } else {
        next.unresolvedThreads.push(thread);
      }
      // Also add to location memory if related
      if (thread.relatedLocation) {
        const slug = slugify(thread.relatedLocation);
        if (next.locationMemory[slug]) {
          if (!next.locationMemory[slug].events.includes(thread.title)) {
            next.locationMemory[slug].events.push(thread.title);
          }
        }
      }
    }
  }
  if (update.threadsResolve) {
    for (const tid of update.threadsResolve) {
      const idx = next.unresolvedThreads.findIndex((t) => t.id === tid || slugify(t.title) === slugify(tid));
      if (idx >= 0) {
        const th = next.unresolvedThreads.splice(idx, 1)[0];
        th.status = 'resolved';
        th.resolvedAt = now;
        next.resolvedThreads.push(th);
      }
    }
  }

  // Location patch
  if (update.locationPatch) {
    for (const [key, patch] of Object.entries(update.locationPatch)) {
      const slug = slugify(key);
      if (!next.locationMemory[slug]) {
        next.locationMemory[slug] = {
          id: slug,
          name: patch.name ?? key,
          visits: patch.visits ?? 0,
          firstVisitedAt: patch.firstVisitedAt ?? null,
          lastVisitedAt: patch.lastVisitedAt ?? now,
          events: patch.events ?? [],
          characters: patch.characters ?? [],
          objects: patch.objects ?? [],
          status: patch.status ?? null,
          notes: patch.notes ?? [],
        };
      } else {
        Object.assign(next.locationMemory[slug], patch);
      }
    }
  }

  // Story time
  if (update.storyTimePatch) {
    if (update.storyTimePatch.day !== undefined) next.storyTime.day = update.storyTimePatch.day;
    if (update.storyTimePatch.timeOfDay !== undefined) next.storyTime.day = next.storyTime.day; // placeholder
    if ((update.storyTimePatch as any).timeOfDay !== undefined) next.storyTime.timeOfDay = (update.storyTimePatch as any).timeOfDay as TimeOfDay;
    if (update.storyTimePatch.clockTime !== undefined) next.storyTime.clockTime = update.storyTimePatch.clockTime ?? null;
    if (update.storyTimePatch.elapsedMinutes !== undefined) next.storyTime.elapsedMinutes = update.storyTimePatch.elapsedMinutes;
    next.storyTime.lastUpdated = now;
  }

  next.episodeCount += 1;
  next.lastTurnAt = now;
  next.updatedAt = now;
  return next;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ------------------------------------------------------------------
// Rendering for prompt
// ------------------------------------------------------------------

export function renderWorldStateForPrompt(state: WorldState): string {
  const lines: string[] = [];
  lines.push(`CURRENT WORLD STATE:`);
  lines.push(`- Location: ${state.currentLocation ?? 'unknown'}${state.previousLocation ? ` (previously: ${state.previousLocation})` : ''}`);
  if (state.currentActivity) lines.push(`- Activity: ${state.currentActivity}`);
  if (state.currentScene) lines.push(`- Scene: ${state.currentScene}`);
  if (state.currentArc) lines.push(`- Arc: ${state.currentArc}`);
  const time = state.storyTime;
  const timeStr = time.clockTime ? `${time.clockTime} (${time.timeOfDay}, Day ${time.day})` : `${time.timeOfDay}, Day ${time.day}`;
  lines.push(`- Story Time: ${timeStr} | elapsed ${time.elapsedMinutes} min`);
  if (state.presentCharacters.length) lines.push(`- Present: ${state.presentCharacters.map((id) => state.characterStates[id]?.name ?? id).join(', ')}`);
  if (state.absentCharacters.length) lines.push(`- Absent: ${state.absentCharacters.slice(0, 4).map((id) => state.characterStates[id]?.name ?? id).join(', ')}`);
  for (const id of state.presentCharacters.slice(0, 3)) {
    const cs = state.characterStates[id];
    if (cs?.activity) lines.push(`  - ${cs.name} is ${cs.activity}${cs.mood ? ` (${cs.mood})` : ''}`);
  }
  if (state.playerState.action) lines.push(`- Player is ${state.playerState.action}${state.playerState.mood ? `, feeling ${state.playerState.mood}` : ''}`);
  const relEntries = Object.entries(state.relationships);
  if (relEntries.length) {
    lines.push(`- Relationships:`);
    for (const [id, r] of relEntries.slice(0, 4)) {
      const name = state.characterStates[id]?.name ?? id;
      lines.push(`  * ${name}: trust ${r.trust}, affection ${r.affection}, tension ${r.tension}${r.summary ? ` — ${r.summary}` : ''}`);
    }
  }
  const objs = Object.values(state.importantObjects);
  if (objs.length) {
    lines.push(`- Important objects: ${objs.slice(0, 5).map((o) => `${o.name}${o.holder ? ` (${o.holder})` : ''}`).join(', ')}`);
  }
  if (state.unresolvedThreads.length) {
    lines.push(`- Unresolved threads:`);
    for (const t of state.unresolvedThreads.slice(0, 5)) {
      lines.push(`  * ${t.title} (${t.involvedCharacters.join(', ') || '—'})${t.relatedLocation ? ` @ ${t.relatedLocation}` : ''}`);
    }
  }
  if (state.activeEvents.length) {
    lines.push(`- Active events: ${state.activeEvents.slice(0, 3).map((e) => e.title).join(', ')}`);
  }
  // Location memory snippet for current location
  if (state.currentLocation) {
    const slug = slugify(state.currentLocation);
    const loc = state.locationMemory[slug];
    if (loc) {
      lines.push(`- Location memory (${loc.name}): visited ${loc.visits}×, events: ${loc.events.slice(0, 3).join(', ') || 'none'}${loc.status ? `, status: ${loc.status}` : ''}`);
    }
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------
// Recovery
// ------------------------------------------------------------------

export async function rollbackWorldState(playthroughId: string): Promise<WorldState | null> {
  const prevRaw = await kvGet(WORLD_PREV_KEY(playthroughId));
  if (!prevRaw) return null;
  try {
    const prev = JSON.parse(prevRaw) as WorldState;
    if (validateWorldState(prev)) {
      await kvSet(WORLD_KEY(playthroughId), prevRaw);
      return prev;
    }
  } catch {}
  return null;
}

// Ensure world state exists (lazy init)
export async function ensureWorldState(playthrough: Playthrough, bundle: StoryBundle): Promise<WorldState> {
  let ws = await getWorldState(playthrough.id);
  if (!ws) {
    ws = createInitialWorldState(playthrough, bundle);
    await setWorldState(ws);
  }
  return ws;
}
