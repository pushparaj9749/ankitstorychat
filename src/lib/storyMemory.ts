/**
 * KISSA v2.5.1 — UNIVERSAL STORY MEMORY ENGINE.
 *
 * One engine, every story. It gives each playthrough a complete LOCAL archive:
 *
 *   story ── messages (raw, immutable)
 *          ├── events        (typed, importance-ranked, timeline-ordered)
 *          ├── relationships  (current state + full history per pair)
 *          ├── knowledge      (who knows what, and how they learned it)
 *          ├── contradictions (rejected state changes, kept for traceability)
 *          └── memoryIndex    (local inverted index → fast, meaning-based search)
 *
 * Write path  : AI/user turn → detect events → validate transitions →
 *               accept/reject → persist → index        (never overwrite raw history)
 * Read path   : current scene → build query → search index → rank → multi-hop
 *               expand (knowledge → source event → raw messages) → bounded block
 *
 * Everything is namespaced by playthroughId AND storyId, so a Poonam story can
 * never bleed into a Zara story. Nothing here is specific to any story, character
 * or genre; the rules are generic storytelling rules, driven by an extendable
 * concept lexicon and a universal relationship ladder.
 */
import type {
  CharacterKnowledgeRecord,
  ChatMessage,
  MemoryConfidence,
  MemoryContradiction,
  Playthrough,
  RelationshipStateRecord,
  StoryBundle,
  StoryEventRecord,
  StoryEventType,
  StoryMemoryQuery,
  StoryMemoryQueryResult,
} from '../types';
import { importanceLabel } from '../types';
import { hashText, looksTooPrivate, sanitize, tokenize } from './memoryCore';
import { nowIso, uid } from './utils';
import {
  chronological,
  conceptTokens,
  detectEvents,
  knowledgeInvalidatedBy,
  detectRelationshipSignals,
  keywordSet,
  pairKeyOf,
  parseProposedState,
  planConsolidation,
  rankArchive,
  renderMemoryBlock,
  splitStatements,
  universalTierOf,
  validateTransition,
  type MemoryContextRef,
} from './storyMemoryCore';
import {
  createInMemoryStoryMemoryStore,
  createSqliteStoryMemoryStore,
  type StoryMemoryStore,
} from './storyMemoryStore';

export const PLAYER_ID = 'player';
/** Bump when the archive layout changes so old installs migrate once. */
export const STORY_MEMORY_VERSION = 1;
const MIGRATION_KEY = 'migrated';

/* ------------------------------------------------------------------ */
/* Engine construction                                                 */
/* ------------------------------------------------------------------ */

export interface StoryMemoryEngine {
  writeTurn(input: WriteTurnInput): Promise<WriteTurnResult>;
  /** The internal memory-query API (spec §18). */
  memorySearch(query: StoryMemoryQuery): Promise<StoryMemoryQueryResult>;
  /** Everything for one playthrough — used by consolidation + diagnostics. */
  loadArchive(playthroughId: string, opts?: { limit?: number }): Promise<ArchiveSnapshot>;
  consolidate(playthroughId: string, storyId: string, opts?: { keepLive?: number }): Promise<{ rollups: number; folded: number }>;
  migrate(input: MigrateInput): Promise<{ migrated: boolean; events: number; relationships: number; knowledge: number }>;
  buildContextBlock(
    result: StoryMemoryQueryResult,
    opts: { currentSeq: number; nameOf?: (id: string) => string; charBudget?: number },
  ): string;
  stats(playthroughId: string): Promise<{ events: number; relationships: number; knowledge: number; contradictions: number }>;
  /** Mark a knowledge record as no longer believed (story revealed it was wrong). */
  invalidateKnowledge(knowledgeId: string, byEventId?: string | null): Promise<void>;
  deleteForPlaythrough(playthroughId: string): Promise<void>;
  readonly store: StoryMemoryStore;
}

export function createStoryMemoryEngine(store: StoryMemoryStore = createSqliteStoryMemoryStore()): StoryMemoryEngine {
  const engine: StoryMemoryEngine = {
    store,

    async writeTurn(input) {
      const ctx = contextFromBundle(input.bundle, {
        playerName: input.playerName ?? 'Player',
        currentLocation: input.location ?? null,
      });
      const detected = detectEvents(input.userText, input.assistantText, ctx, { maxEvents: 6, minImportance: 2 });
      const proposed = parseProposedState(input.parsedState, ctx);
      const baseSeq = await store.nextSeq(input.playthrough.id);
      const turnAt = input.at ?? nowIso();
      const messageIds = (input.messageIds ?? []).filter(Boolean);
      let knowledgeWritten = 0;

      // ---- 1. persist events (deterministic id ⇒ retries replace, never duplicate)
      const stored: StoryEventRecord[] = [];
      for (let i = 0; i < detected.length; i++) {
        const d = detected[i];
        const id = `ev_${hashText(`${input.playthrough.id}|${d.type}|${d.summary.toLowerCase()}`)}`;
        const record: StoryEventRecord = {
          id,
          storyId: input.playthrough.storyId,
          playthroughId: input.playthrough.id,
          seq: baseSeq + i,
          type: d.type,
          summary: d.summary,
          detail: d.detail ?? null,
          importance: d.importance,
          importanceLabel: d.importanceLabel,
          confidence: d.confidence,
          source: input.source ?? 'narrator',
          sourceMessageIds: messageIds.slice(0, 6),
          sceneId: input.sceneId ?? input.playthrough.currentSceneId,
          location: input.location ?? null,
          participants: d.participants,
          pairKeys: d.pairKeys,
          objectNames: d.objectNames,
          storyDay: input.storyDay ?? null,
          occurredAt: turnAt,
          createdAt: turnAt,
          status: 'active',
          supersededBy: null,
          keywords: d.keywords,
          archived: false,
        };
        await store.insertEvent(record);
        await store.indexRecord(record.storyId, record.playthroughId, 'event', record.id, record.keywords);
        stored.push(record);

        // Character knowledge carried by this statement ("Poonam ko pata hai ki …")
        for (const k of d.knowledge ?? []) {
          const wrote = await rememberKnowledge(store, {
            storyId: input.playthrough.storyId,
            playthroughId: input.playthrough.id,
            characterId: k.characterId,
            characterName: k.characterName,
            fact: k.fact,
            source: k.source,
            learnedFrom: k.learnedFrom,
            sourceEventId: record.id,
            sourceMessageIds: messageIds.slice(0, 4),
            storyDay: input.storyDay ?? null,
            confidence: k.confidence,
          });
          if (wrote) knowledgeWritten++;
        }
      }

      // ---- 2. explicit structured status from the model (validated, never trusted)
      const contradictions: MemoryContradiction[] = [];
      const statusSignals = [
        ...detectRelationshipSignals([input.userText, input.assistantText].join('\n'), ctx),
        ...proposed.relationships,
      ];
      let relCount = 0;
      const seenPairs = new Set<string>();
      for (const signal of statusSignals) {
        if (seenPairs.has(signal.pairKey)) continue;
        seenPairs.add(signal.pairKey);
        const applied = await applyRelationshipSignal(store, {
          storyId: input.playthrough.storyId,
          playthroughId: input.playthrough.id,
          pairKey: signal.pairKey,
          status: signal.status,
          tier: signal.tier,
          confidence: signal.confidence,
          evidence: signal.evidence,
          explicit: signal.explicit,
          at: turnAt,
          sourceEventId: stored[0]?.id ?? null,
          ctx,
        });
        if (applied === 'applied') relCount++;
        if (applied && typeof applied === 'object' && applied.contradiction) contradictions.push(applied.contradiction);
      }

      // ---- 3. knowledge proposed by the model directly
      for (const k of proposed.knowledge) {
        const ch = ctx.characters.find((c) => c.id === k.characterId);
        if (!ch) continue;
        const wrote = await rememberKnowledge(store, {
          storyId: input.playthrough.storyId,
          playthroughId: input.playthrough.id,
          characterId: k.characterId,
          characterName: ch.name,
          fact: k.fact,
          source: k.source,
          learnedFrom: null,
          sourceEventId: stored[0]?.id ?? null,
          sourceMessageIds: messageIds.slice(0, 4),
          storyDay: input.storyDay ?? null,
          confidence: 'high',
        });
        if (wrote) knowledgeWritten++;
      }

      // ---- 4. promises / decisions / secrets the model flagged explicitly
      for (const [type, list] of [
        ['promise', proposed.promises],
        ['decision', proposed.decisions],
        ['secret', proposed.secrets],
      ] as [StoryEventType, string[]][]) {
        let i = 0;
        for (const text of list.slice(0, 3)) {
          const summary = sanitize(text, 240);
          if (summary.length < 8 || looksTooPrivate(summary)) continue;
          // Already captured by the deterministic detector? Then don't duplicate.
          if (stored.some((e) => e.type === type && e.summary.toLowerCase().includes(summary.toLowerCase().slice(0, 40)))) continue;
          const id = `ev_${hashText(`${input.playthrough.id}|${type}|${summary.toLowerCase()}`)}`;
          const record: StoryEventRecord = {
            id,
            storyId: input.playthrough.storyId,
            playthroughId: input.playthrough.id,
            seq: baseSeq + 20 + i,
            type,
            summary,
            detail: null,
            importance: 4,
            importanceLabel: importanceLabel(4),
            confidence: 'high',
            source: 'narrator',
            sourceMessageIds: messageIds.slice(0, 6),
            sceneId: input.sceneId ?? input.playthrough.currentSceneId,
            location: input.location ?? null,
            participants: [],
            pairKeys: [],
            objectNames: [],
            storyDay: input.storyDay ?? null,
            occurredAt: turnAt,
            createdAt: turnAt,
            status: 'active',
            supersededBy: null,
            keywords: keywordSet(summary),
            archived: false,
          };
          await store.insertEvent(record);
          await store.indexRecord(record.storyId, record.playthroughId, 'event', record.id, record.keywords);
          stored.push(record);
          i++;
        }
      }

      // ---- 5. revelations invalidate stale knowledge (nothing is deleted)
      for (const event of stored) {
        if (!event.keywords.includes('c:revelation') && !event.keywords.includes('c:truth')) continue;
        const subjects = event.participants.length ? event.participants : [];
        if (!subjects.length) continue;
        const candidates = (
          await Promise.all(subjects.map((id) => store.listKnowledge(input.playthrough.id, { characterId: id, limit: 60 })))
        ).flat();
        for (const stale of knowledgeInvalidatedBy(event.summary, candidates, subjects)) {
          await store.updateKnowledge(stale.id, {
            status: 'invalidated',
            invalidatedBy: event.id,
            invalidatedAt: turnAt,
          });
        }
      }

      return {
        events: stored.length,
        relationships: relCount,
        contradictions,
        knowledge: knowledgeWritten,
        seqStart: baseSeq,
      };
    },

    async memorySearch(query) {
      const structural = await loadArchive(store, query.playthroughId);
      // Index lane: the inverted index finds records anywhere in the archive, so
      // a fact from turn 3 is reachable at turn 3,000 without scanning history.
      const indexTokens = [...new Set([...tokenize(query.query), ...conceptTokens(query.query)])];
      const hits = indexTokens.length ? await store.searchIndex(query.playthroughId, indexTokens, 160) : [];
      const eventIds = hits.filter((h) => h.recordType === 'event').map((h) => h.recordId);
      const knowledgeIds = hits.filter((h) => h.recordType === 'knowledge').map((h) => h.recordId);
      const [indexedEvents, indexedKnowledge] = await Promise.all([
        eventIds.length ? store.getEvents(eventIds) : Promise.resolve([]),
        knowledgeIds.length ? store.getKnowledge(knowledgeIds) : Promise.resolve([]),
      ]);
      const eventMap = new Map<string, StoryEventRecord>();
      for (const e of [...structural.events, ...indexedEvents]) eventMap.set(e.id, e);
      const knowledgeMap = new Map<string, CharacterKnowledgeRecord>();
      for (const k of [...structural.knowledge, ...indexedKnowledge]) knowledgeMap.set(k.id, k);
      // Knowledge belonging to the characters this turn is about (bounded).
      const focusCharacters = (query.characters ?? []).filter((c) => c && c !== PLAYER_ID).slice(0, 4);
      if (focusCharacters.length) {
        const perCharacter = await Promise.all(
          focusCharacters.map((id) => store.listKnowledge(query.playthroughId, { characterId: id, limit: 60 })),
        );
        for (const list of perCharacter) for (const k of list) knowledgeMap.set(k.id, k);
      }
      const archive: ArchiveSnapshot = {
        events: [...eventMap.values()],
        relationships: structural.relationships,
        knowledge: [...knowledgeMap.values()],
      };
      const ctx = contextFromArchive(archive, {
        characters: query.characters,
        playerName: 'Player',
      });
      const profileCtx = ctx;
      const ranked = rankArchive(
        { events: archive.events, knowledge: archive.knowledge, relationships: archive.relationships },
        query.query,
        profileCtx,
        {
          limit: query.limit ?? 14,
          eventTypes: query.eventTypes,
          timeRange: query.timeRange,
          importance: query.importance,
          relationshipPair: query.relationshipPair ?? null,
          currentSeq: query.currentSeq,
        },
      );

      // Perspective filter: when a scene focuses on one character, knowledge
      // belonging to other characters still informs the narrator BUT is clearly
      // attributed. Invalidated knowledge is already excluded by the ranker.
      const knowledge = query.perspective
        ? [...ranked.knowledge].sort((a, b) =>
            (b.characterId === query.perspective ? 1 : 0) - (a.characterId === query.perspective ? 1 : 0),
          )
        : ranked.knowledge;

      const evidenceIds = [
        ...new Set(ranked.events.flatMap((e) => (e.sourceMessageIds ?? []).slice(-2))),
      ].slice(0, 6);
      const evidence = evidenceIds.length
        ? (await store.rawMessages(evidenceIds)).map((m) => ({
            messageId: m.id,
            role: m.role,
            speaker: m.speaker,
            text: m.text,
            createdAt: m.createdAt,
          }))
        : [];

      return {
        events: ranked.events,
        relationships: ranked.relationships,
        knowledge,
        timeline: chronological(ranked.events),
        evidence,
        hops: ranked.hops,
        candidates: ranked.candidates,
      };
    },

    async loadArchive(playthroughId, opts = {}) {
      return loadArchive(store, playthroughId, { full: opts.limit === undefined ? true : opts.limit > 1000 });
    },

    async consolidate(playthroughId, storyId, opts = {}) {
      const archive = await loadArchive(store, playthroughId, { full: true });
      const clusters = planConsolidation(archive.events, { keepLive: opts.keepLive ?? 60 });
      let folded = 0;
      const at = nowIso();
      const maxSeq = archive.events.reduce((n, e) => Math.max(n, e.seq), 0);
      for (const [i, cluster] of clusters.entries()) {
        const rollup: StoryEventRecord = {
          id: `roll_${hashText(`${playthroughId}|${cluster.key}|${cluster.firstSeq}-${cluster.lastSeq}`)}`,
          storyId,
          playthroughId,
          seq: maxSeq + 1 + i,
          type: 'rollup',
          summary: cluster.summary,
          detail: null,
          importance: cluster.importance,
          importanceLabel: importanceLabel(cluster.importance),
          confidence: 'high',
          source: 'derived',
          sourceMessageIds: cluster.sourceMessageIds.slice(0, 8),
          sourceEventIds: cluster.eventIds,
          sceneId: null,
          location: null,
          participants: cluster.participants,
          pairKeys: cluster.pairKey ? [cluster.pairKey] : [],
          objectNames: [],
          storyDay: null,
          occurredAt: at,
          createdAt: at,
          status: 'active',
          supersededBy: null,
          keywords: keywordSet(`${cluster.summary} ${cluster.eventType}`),
          archived: false,
        };
        await store.insertEvent(rollup);
        await store.indexRecord(storyId, playthroughId, 'event', rollup.id, rollup.keywords);
        for (const id of cluster.eventIds) {
          await store.updateEvent(id, { archived: true });
        }
        folded += cluster.eventIds.length;
      }
      return { rollups: clusters.length, folded };
    },

    async migrate(input) {
      const { playthrough, bundle } = input;
      const done = await store.getMeta(playthrough.id, MIGRATION_KEY);
      if (done && Number(done) >= STORY_MEMORY_VERSION) {
        return { migrated: false, events: 0, relationships: 0, knowledge: 0 };
      }
      const ctx = contextFromBundle(bundle, { playerName: input.playerName ?? 'Player' });
      const at = nowIso();

      // 1) Seed canonical knowledge from the story bible: every character starts
      //    knowing exactly what their pack says they know.
      let knowledge = 0;
      for (const ch of bundle.characters.characters) {
        for (const fact of ch.knowledge.slice(0, 12)) {
          const wrote = await rememberKnowledge(store, {
            storyId: playthrough.storyId,
            playthroughId: playthrough.id,
            characterId: ch.id,
            characterName: ch.name,
            fact,
            source: 'seed',
            learnedFrom: null,
            sourceEventId: null,
            sourceMessageIds: [],
            storyDay: 1,
            confidence: 'high',
          });
          if (wrote) knowledge++;
        }
        // The pack's stated relationship with the player is the initial state.
        const signal = detectRelationshipSignals(ch.relationshipWithUser ?? '', {
          ...ctx,
          characters: [{ id: ch.id, name: ch.name }],
        })[0];
        if (signal && signal.tier > 0) {
          await applyRelationshipSignal(store, {
            storyId: playthrough.storyId,
            playthroughId: playthrough.id,
            pairKey: pairKeyOf(PLAYER_ID, ch.id),
            status: signal.status,
            tier: signal.tier,
            confidence: 'high',
            evidence: sanitize(ch.relationshipWithUser, 240),
            explicit: true,
            at,
            sourceEventId: null,
            ctx,
            seed: true,
          });
        }
      }

      // 2) Replay the raw archive so pre-v2.5.1 stories gain events immediately.
      let events = 0;
      const messages = [...(input.messages ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      let seq = await store.nextSeq(playthrough.id);
      let pendingUser: ChatMessage | null = null;
      for (const m of messages) {
        if (m.role === 'user') {
          pendingUser = m;
          continue;
        }
        if (m.role === 'narration') continue;
        const userText = pendingUser?.text ?? '';
        const detected = detectEvents(userText, m.text, ctx, { maxEvents: 4, minImportance: 3 });
        const ids = [pendingUser?.id, m.id].filter((x): x is string => !!x);
        for (const d of detected) {
          const id = `ev_${hashText(`${playthrough.id}|${d.type}|${d.summary.toLowerCase()}`)}`;
          const existing = await store.getEvent(id);
          if (existing) continue;
          const record: StoryEventRecord = {
            id,
            storyId: playthrough.storyId,
            playthroughId: playthrough.id,
            seq: seq++,
            type: d.type,
            summary: d.summary,
            detail: null,
            importance: d.importance,
            importanceLabel: d.importanceLabel,
            confidence: 'medium',
            source: 'migration',
            sourceMessageIds: ids,
            sceneId: m.sceneId,
            location: null,
            participants: d.participants,
            pairKeys: d.pairKeys,
            objectNames: d.objectNames,
            storyDay: null,
            occurredAt: m.createdAt,
            createdAt: at,
            status: 'active',
            supersededBy: null,
            keywords: d.keywords,
            archived: false,
          };
          await store.insertEvent(record);
          await store.indexRecord(record.storyId, record.playthroughId, 'event', record.id, record.keywords);
          events++;
        }
        pendingUser = null;
      }

      // 3) Numeric relationship map (legacy state) becomes the starting statuses.
      let relationships = 0;
      for (const [charId, value] of Object.entries(playthrough.state?.relationships ?? {})) {
        const ch = bundle.characters.characters.find((c) => c.id === charId);
        if (!ch) continue;
        const status = value >= 85 ? 'close_friend' : value >= 60 ? 'friend' : 'acquaintance';
        const written = await applyRelationshipSignal(store, {
          storyId: playthrough.storyId,
          playthroughId: playthrough.id,
          pairKey: pairKeyOf(PLAYER_ID, ch.id),
          status,
          tier: universalTierOf(status),
          confidence: 'medium',
          evidence: `legacy relationship score ${Math.round(value)}/100`,
          explicit: true,
          at,
          sourceEventId: null,
          ctx,
          seed: true,
        });
        if (written === 'applied') relationships++;
      }

      await store.setMeta(playthrough.id, MIGRATION_KEY, String(STORY_MEMORY_VERSION));
      return { migrated: true, events, relationships, knowledge };
    },

    buildContextBlock(result, opts) {
      return renderMemoryBlock({
        relationships: result.relationships,
        events: result.events,
        knowledge: result.knowledge,
        evidence: result.evidence.map((e) => ({ speaker: e.speaker, role: e.role, text: e.text })),
        currentSeq: opts.currentSeq,
        nameOf: opts.nameOf,
        charBudget: opts.charBudget,
      });
    },

    async stats(playthroughId) {
      const [events, relationships, knowledge, contradictions] = await Promise.all([
        store.countEvents(playthroughId),
        store.listRelationships(playthroughId),
        store.listKnowledge(playthroughId, { limit: 600 }),
        store.listContradictions(playthroughId, 50),
      ]);
      return { events, relationships: relationships.length, knowledge: knowledge.length, contradictions: contradictions.length };
    },

    async invalidateKnowledge(knowledgeId, byEventId = null) {
      await store.updateKnowledge(knowledgeId, {
        status: 'invalidated',
        invalidatedBy: byEventId,
        invalidatedAt: nowIso(),
      });
    },

    async deleteForPlaythrough(playthroughId) {
      await store.deleteForPlaythrough(playthroughId);
    },
  };
  return engine;
}

/* ------------------------------------------------------------------ */
/* Default engine (SQLite) + reusable helpers                          */
/* ------------------------------------------------------------------ */

let defaultEngine: StoryMemoryEngine | null = null;

/** The app-wide engine. Created lazily so tests never touch SQLite. */
export function getStoryMemoryEngine(): StoryMemoryEngine {
  if (!defaultEngine) defaultEngine = createStoryMemoryEngine(createSqliteStoryMemoryStore());
  return defaultEngine;
}

/** Test/DI seam: point the default engine at another store. */
export function __setStoryMemoryEngineForTests(engine: StoryMemoryEngine | null): void {
  defaultEngine = engine;
}

/* ------------------------------------------------------------------ */
/* Inputs / outputs                                                    */
/* ------------------------------------------------------------------ */

export interface WriteTurnInput {
  playthrough: Playthrough;
  bundle: StoryBundle;
  userText: string;
  assistantText: string;
  /** Raw kissa-state payload the narrator emitted (already validated/parsed). */
  parsedState?: unknown;
  /** Raw archive rows this turn produced (user + assistant message ids). */
  messageIds?: string[];
  sceneId?: string | null;
  location?: string | null;
  storyDay?: number | null;
  playerName?: string;
  source?: StoryEventRecord['source'];
  at?: string;
}

export interface WriteTurnResult {
  events: number;
  relationships: number;
  knowledge: number;
  contradictions: MemoryContradiction[];
  seqStart: number;
}

export interface ArchiveSnapshot {
  events: StoryEventRecord[];
  relationships: RelationshipStateRecord[];
  knowledge: CharacterKnowledgeRecord[];
}

export interface MigrateInput {
  playthrough: Playthrough;
  bundle: StoryBundle;
  messages: ChatMessage[];
  playerName?: string;
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

export function contextFromBundle(
  bundle: StoryBundle,
  opts: { playerName: string; currentLocation?: string | null },
): MemoryContextRef {
  return {
    playerId: PLAYER_ID,
    playerName: opts.playerName,
    characters: bundle.characters.characters.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: [c.id.replace(/[-_]+/g, ' ')].filter((a) => a && a.length >= 3 && a.toLowerCase() !== c.name.toLowerCase()),
    })),
    locations: bundle.world.locations.map((l) => l.name),
    // World files carry locations and lore; object nouns are picked up from the
    // transcript itself by the concept lexicon, so no story-specific list is needed.
    objects: [],
    currentLocation: opts.currentLocation ?? null,
  };
}

/**
 * Rebuild a usable context from the archive alone (memorySearch can run without
 * a story bundle — e.g. from diagnostics or a future Memory screen).
 */
export function contextFromArchive(
  archive: ArchiveSnapshot,
  opts: { characters?: string[]; playerName?: string; currentLocation?: string | null } = {},
): MemoryContextRef {
  const byId = new Map<string, string>();
  for (const r of archive.relationships) {
    byId.set(r.a.id, r.a.name);
    byId.set(r.b.id, r.b.name);
  }
  for (const k of archive.knowledge) byId.set(k.characterId, k.characterName);
  for (const e of archive.events) for (const p of e.participants) if (!byId.has(p)) byId.set(p, p);
  const wanted = opts.characters?.length ? opts.characters.filter((c) => c !== PLAYER_ID) : [...byId.keys()];
  return {
    playerId: PLAYER_ID,
    playerName: opts.playerName ?? 'Player',
    characters: wanted.map((id) => ({ id, name: byId.get(id) ?? id })),
    locations: [],
    objects: [],
    currentLocation: opts.currentLocation ?? null,
  };
}

/**
 * Bounded archive load. The structural lane is deliberately small and constant
 * per turn — recent events, everything still open (promises/tasks/secrets) and
 * high-importance milestones. Deep history is reached through the inverted
 * index (see memorySearch), never by scanning the whole archive.
 */
async function loadArchive(
  store: StoryMemoryStore,
  playthroughId: string,
  opts: { full?: boolean } = {},
): Promise<ArchiveSnapshot> {
  if (opts.full) {
    const [events, relationships, knowledge] = await Promise.all([
      store.listEvents(playthroughId, { includeArchived: true, limit: 5000 }),
      store.listRelationships(playthroughId),
      store.listKnowledge(playthroughId, { limit: 600 }),
    ]);
    return { events, relationships, knowledge };
  }
  const [recent, open, milestones, relationships, knowledge] = await Promise.all([
    store.listEvents(playthroughId, { includeArchived: true, limit: 150 }),
    store.listEvents(playthroughId, { types: ['promise', 'task', 'secret', 'rollup'], limit: 80 }),
    store.listEvents(playthroughId, { minImportance: 4, limit: 80 }),
    store.listRelationships(playthroughId),
    store.listKnowledge(playthroughId, { limit: 150 }),
  ]);
  const seen = new Set<string>();
  const events = [...recent, ...open, ...milestones].filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  return { events, relationships, knowledge };
}

interface KnowledgeInput {
  storyId: string;
  playthroughId: string;
  characterId: string;
  characterName: string;
  fact: string;
  source: CharacterKnowledgeRecord['source'];
  learnedFrom: string | null;
  sourceEventId: string | null;
  sourceMessageIds: string[];
  storyDay: number | null;
  confidence: MemoryConfidence;
}

/** Idempotent knowledge write: the same fact never duplicates. */
async function rememberKnowledge(store: StoryMemoryStore, input: KnowledgeInput): Promise<boolean> {
  const fact = sanitize(input.fact, 240);
  if (fact.length < 6 || looksTooPrivate(fact)) return false;
  const factKey = hashText(fact);
  const existing = await store.findKnowledgeByFactKey(input.playthroughId, input.characterId, factKey);
  const at = nowIso();
  if (existing) {
    if (existing.status === 'invalidated') {
      // Re-learned after being invalidated: the newer knowledge supersedes.
      await store.updateKnowledge(existing.id, { status: 'believed', invalidatedAt: null, invalidatedBy: null, learnedAt: at });
    }
    return false;
  }
  const record: CharacterKnowledgeRecord = {
    id: uid('know'),
    storyId: input.storyId,
    playthroughId: input.playthroughId,
    characterId: input.characterId,
    characterName: input.characterName,
    fact,
    factKey,
    source: input.source,
    learnedFrom: input.learnedFrom,
    sourceEventId: input.sourceEventId,
    sourceMessageIds: input.sourceMessageIds.slice(0, 6),
    learnedAt: at,
    storyDay: input.storyDay,
    confidence: input.confidence,
    status: 'believed',
    invalidatedBy: null,
    invalidatedAt: null,
  };
  await store.insertKnowledge(record);
  await store.indexRecord(input.storyId, input.playthroughId, 'knowledge', record.id, keywordSet(fact));
  return true;
}

interface RelationshipApplyInput {
  storyId: string;
  playthroughId: string;
  pairKey: string;
  status: string;
  tier: number;
  confidence: MemoryConfidence;
  evidence: string;
  explicit: boolean;
  at: string;
  sourceEventId: string | null;
  ctx: MemoryContextRef;
  seed?: boolean;
}

/**
 * The validated state-transition pipeline:
 * proposed change → compare with stored state → accept / flag / reject →
 * persist (append history) or record a contradiction. A hallucinated reply can
 * never silently rewrite an established relationship.
 */
async function applyRelationshipSignal(
  store: StoryMemoryStore,
  input: RelationshipApplyInput,
): Promise<'applied' | 'flagged' | 'rejected' | 'ignored' | { contradiction: MemoryContradiction }> {
  const { pairKey } = input;
  const [aId, bId] = pairKey.split('::');
  if (!aId || !bId || aId === bId) return 'ignored';
  const current = await store.getRelationship(input.playthroughId, pairKey);
  const decision = validateTransition(
    current ? { status: current.status, tier: current.tier } : null,
    { status: input.status, tier: input.tier },
    input.evidence,
    input.confidence,
    input.explicit,
  );

  if (!decision.accepted) {
    const contradiction: MemoryContradiction = {
      id: uid('con'),
      storyId: input.storyId,
      playthroughId: input.playthroughId,
      at: input.at,
      kind: 'relationship_downgrade',
      expected: current ? `${current.a.name} ↔ ${current.b.name}: ${current.status}` : '(none)',
      proposed: `${pairKey}: ${input.status}`,
      reason: decision.reason,
      evidence: sanitize(input.evidence, 300),
      resolved: false,
    };
    await store.insertContradiction(contradiction);
    return { contradiction };
  }

  const nameOf = (id: string): string => {
    if (id === PLAYER_ID) return input.ctx.playerName;
    const known = input.ctx.characters.find((c) => c.id === id);
    if (known) return known.name;
    if (current?.a.id === id) return current.a.name;
    if (current?.b.id === id) return current.b.name;
    return id;
  };

  const history = current ? [...current.history] : [];
  const changed = !current || current.status !== input.status;
  if (changed) {
    history.push({
      status: input.status,
      tier: input.tier,
      at: input.at,
      eventId: input.sourceEventId,
      note: decision.flagged ? `flagged: ${decision.reason}` : decision.reason,
    });
  }
  const record: RelationshipStateRecord = {
    id: pairKey,
    storyId: input.storyId,
    playthroughId: input.playthroughId,
    pairKey,
    a: { id: aId, name: nameOf(aId) },
    b: { id: bId, name: nameOf(bId) },
    status: input.status,
    tier: input.tier,
    trust: current?.trust ?? null,
    affection: current?.affection ?? null,
    tension: current?.tension ?? null,
    respect: current?.respect ?? null,
    // A confirmed status keeps its confidence; a weaker re-statement never
    // lowers a strong state.
    confidence: current && !changed && current.confidence === 'high' ? 'high' : input.confidence,
    history: history.slice(-40),
    sourceEventIds: [...new Set([...(current?.sourceEventIds ?? []), input.sourceEventId].filter((x): x is string => !!x))].slice(-12),
    createdAt: current?.createdAt ?? input.at,
    updatedAt: input.at,
    lastConfirmedAt: input.at,
  };
  await store.upsertRelationship(record);
  await store.indexRecord(input.storyId, input.playthroughId, 'relationship', pairKey, [
    ...tokenize(`${record.a.name} ${record.b.name} ${record.status}`),
    ...keywordSet(record.status),
  ]);
  if (decision.flagged) return 'flagged';
  return 'applied';
}

/* ------------------------------------------------------------------ */
/* Convenience wrappers used by the chat screen                        */
/* ------------------------------------------------------------------ */

export interface RecallForPromptInput {
  playthrough: Playthrough;
  bundle: StoryBundle;
  query: string;
  /** Reader's nickname/display name for Player replacement. */
  playerName?: string;
  /** Characters present/known in the current scene (ids). */
  characters?: string[];
  location?: string | null;
  currentSeq?: number;
  perspective?: string | null;
  limit?: number;
  charBudget?: number;
  engine?: StoryMemoryEngine;
}

export interface RecallForPromptResult {
  result: StoryMemoryQueryResult;
  block: string;
}

/**
 * The single call the chat orchestration makes before generation: build a
 * compact, relevant, source-tagged memory block from the local archive.
 */
export async function recallStoryMemoryForPrompt(input: RecallForPromptInput): Promise<RecallForPromptResult> {
  const engine = input.engine ?? getStoryMemoryEngine();
  const currentSeq = input.currentSeq ?? input.playthrough.messageCount;
  const result = await engine.memorySearch({
    storyId: input.playthrough.storyId,
    playthroughId: input.playthrough.id,
    query: input.query,
    characters: input.characters,
    relationshipPair: null,
    sceneId: input.playthrough.currentSceneId,
    limit: input.limit ?? 14,
    perspective: input.perspective ?? null,
    currentSeq,
  });
  const nameOf = (id: string): string => {
    if (id === PLAYER_ID) return input.playerName || (input.playthrough as any).playerName || 'Player';
    return input.bundle.characters.characters.find((c) => c.id === id)?.name ?? id;
  };
  const block = engine.buildContextBlock(result, {
    currentSeq: currentSeq ?? Math.max(0, ...result.events.map((e) => e.seq)),
    nameOf,
    charBudget: input.charBudget ?? 4200,
  });
  return { result, block };
}

/** Persist one turn into the archive (events, state transitions, knowledge). */
export async function rememberTurn(input: WriteTurnInput, engine?: StoryMemoryEngine): Promise<WriteTurnResult> {
  const e = engine ?? getStoryMemoryEngine();
  return e.writeTurn(input);
}

/** Backfill the archive for stories played before v2.5.1 (idempotent). */
export async function migrateStoryMemory(
  input: MigrateInput,
  engine?: StoryMemoryEngine,
): Promise<{ migrated: boolean; events: number; relationships: number; knowledge: number }> {
  const e = engine ?? getStoryMemoryEngine();
  return e.migrate(input);
}

/** Fold very old events into durable rollups (raw rows are kept). */
export async function consolidateStoryMemory(
  playthroughId: string,
  storyId: string,
  opts?: { keepLive?: number },
  engine?: StoryMemoryEngine,
): Promise<{ rollups: number; folded: number }> {
  const e = engine ?? getStoryMemoryEngine();
  return e.consolidate(playthroughId, storyId, opts);
}

/** Direct memory query API alias (spec §18). */
export async function memorySearch(
  query: StoryMemoryQuery,
  engine?: StoryMemoryEngine,
): Promise<StoryMemoryQueryResult> {
  const e = engine ?? getStoryMemoryEngine();
  return e.memorySearch(query);
}

export { createInMemoryStoryMemoryStore };
export { splitStatements, detectEvents, validateTransition, universalTierOf, pairKeyOf };
