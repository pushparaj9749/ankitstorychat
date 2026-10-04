/**
 * KISSA v2.5.1 — STORY MEMORY STORE.
 *
 * The engine never talks to SQLite directly: it talks to this interface. Two
 * implementations ship:
 *
 *  - `createSqliteStoryMemoryStore()` — the production, on-device store. New
 *    tables (schema v7) live beside the existing chats/memories, so the whole
 *    archive stays 100% local and is never uploaded anywhere.
 *  - `createInMemoryStoryMemoryStore()` — the same contract in memory. Unit
 *    tests (and any future import/diagnostics tooling) drive the real engine
 *    code against it, including "restart the app" scenarios where a brand new
 *    engine is built over the same store.
 *
 * Every read is scoped by playthroughId (which is 1:1 with a story run) and
 * stamped with storyId, so memory can never leak between stories.
 */
import type {
  CharacterKnowledgeRecord,
  ChatMessage,
  MemoryContradiction,
  RelationshipStateRecord,
  StoryEventRecord,
  StoryEventType,
} from '../types';
/**
 * The SQLite module is imported lazily: it pulls in `expo-sqlite`, which is not
 * available (and must not be loaded) in plain-node test runs or in any future
 * diagnostics tooling. Only the production store ever touches the database.
 */
type DbHandle = Awaited<ReturnType<typeof import('./db').getDb>>;
let dbModule: Promise<typeof import('./db')> | null = null;

async function openDb(): Promise<DbHandle> {
  if (!dbModule) dbModule = import('./db');
  const mod = await dbModule;
  return mod.getDb();
}

export type IndexedRecordType = 'event' | 'knowledge' | 'relationship';

export interface StoryMemoryStore {
  /* timeline */
  nextSeq(playthroughId: string): Promise<number>;
  insertEvent(e: StoryEventRecord): Promise<void>;
  updateEvent(id: string, patch: Partial<StoryEventRecord>): Promise<void>;
  getEvent(id: string): Promise<StoryEventRecord | null>;
  /** Batch fetch — used by index-backed retrieval so very old records stay reachable. */
  getEvents(ids: string[]): Promise<StoryEventRecord[]>;
  listEvents(
    playthroughId: string,
    opts?: { limit?: number; includeArchived?: boolean; types?: StoryEventType[]; minImportance?: number },
  ): Promise<StoryEventRecord[]>;
  countEvents(playthroughId: string): Promise<number>;

  /* relationships */
  upsertRelationship(r: RelationshipStateRecord): Promise<void>;
  getRelationship(playthroughId: string, pairKey: string): Promise<RelationshipStateRecord | null>;
  listRelationships(playthroughId: string): Promise<RelationshipStateRecord[]>;

  /* character knowledge */
  insertKnowledge(k: CharacterKnowledgeRecord): Promise<void>;
  listKnowledge(
    playthroughId: string,
    opts?: { characterId?: string; includeInvalidated?: boolean; limit?: number },
  ): Promise<CharacterKnowledgeRecord[]>;
  /** Batch fetch for index-backed knowledge retrieval. */
  getKnowledge(ids: string[]): Promise<CharacterKnowledgeRecord[]>;
  findKnowledgeByFactKey(
    playthroughId: string,
    characterId: string,
    factKey: string,
  ): Promise<CharacterKnowledgeRecord | null>;
  updateKnowledge(id: string, patch: Partial<CharacterKnowledgeRecord>): Promise<void>;

  /* inverted index (local semantic retrieval, no external service) */
  indexRecord(
    storyId: string,
    playthroughId: string,
    recordType: IndexedRecordType,
    recordId: string,
    keywords: string[],
  ): Promise<void>;
  searchIndex(
    playthroughId: string,
    tokens: string[],
    limit?: number,
  ): Promise<{ recordType: IndexedRecordType; recordId: string; weight: number }[]>;
  /** Rebuild the inverted index from stored records (after a backup restore). */
  rebuildIndex(): Promise<number>;

  /* contradictions + raw evidence + meta */
  insertContradiction(c: MemoryContradiction): Promise<void>;
  listContradictions(playthroughId: string, limit?: number): Promise<MemoryContradiction[]>;
  rawMessages(ids: string[]): Promise<Pick<ChatMessage, 'id' | 'role' | 'speaker' | 'text' | 'createdAt'>[]>;
  getMeta(playthroughId: string, key: string): Promise<string | null>;
  setMeta(playthroughId: string, key: string, value: string): Promise<void>;
  deleteForPlaythrough(playthroughId: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function toJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? []);
  } catch {
    return '[]';
  }
}

function fromStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function fromHistory(
  raw: unknown,
): RelationshipStateRecord['history'] {
  const arr = fromJsonArray(raw);
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      status: String(x.status ?? ''),
      tier: Number.isFinite(Number(x.tier)) ? Number(x.tier) : -1,
      at: String(x.at ?? ''),
      eventId: x.eventId ? String(x.eventId) : null,
      note: x.note ? String(x.note) : null,
    }))
    .filter((x) => x.status);
}

/** Literal keyword tokens for a set of texts (index rebuild helper). */
function keywordRow(...parts: string[]): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    for (const token of String(part ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (token.length >= 3) out.add(token);
    }
  }
  return [...out];
}

function fromJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* SQLite implementation (production)                                  */
/* ------------------------------------------------------------------ */

export function createSqliteStoryMemoryStore(): StoryMemoryStore {
  const db = () => openDb();

  return {
    async nextSeq(playthroughId) {
      const d = await db();
      const row = await d.getFirstAsync<{ n: number | null }>(
        'SELECT MAX(seq) AS n FROM story_events WHERE playthrough_id = ?',
        playthroughId,
      );
      return (row?.n ?? 0) + 1;
    },

    async insertEvent(e) {
      const d = await db();
      await d.runAsync(
        `INSERT OR REPLACE INTO story_events (
          id, playthrough_id, story_id, seq, type, summary, detail, importance, importance_label,
          confidence, source, source_message_ids, source_event_ids, scene_id, location, participants,
          pair_keys, objects, story_day, occurred_at, created_at, status, superseded_by, keywords, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.playthroughId,
        e.storyId,
        e.seq,
        e.type,
        e.summary,
        e.detail ?? null,
        e.importance,
        e.importanceLabel,
        e.confidence,
        e.source,
        toJson(e.sourceMessageIds),
        toJson(e.sourceEventIds ?? []),
        e.sceneId,
        e.location,
        toJson(e.participants),
        toJson(e.pairKeys),
        toJson(e.objectNames),
        e.storyDay ?? null,
        e.occurredAt,
        e.createdAt,
        e.status,
        e.supersededBy ?? null,
        toJson(e.keywords),
        e.archived ? 1 : 0,
      );
    },

    async updateEvent(id, patch) {
      const d = await db();
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      const jsonKeys: (keyof StoryEventRecord)[] = ['sourceMessageIds', 'sourceEventIds', 'participants', 'pairKeys', 'objectNames', 'keywords'];
      for (const [k, v] of Object.entries(patch)) {
        const column = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        sets.push(`${column} = ?`);
        if (jsonKeys.includes(k as keyof StoryEventRecord)) args.push(toJson(v));
        else if (k === 'archived') args.push(v ? 1 : 0);
        else args.push((v ?? null) as string | number | null);
      }
      if (!sets.length) return;
      args.push(id);
      await d.runAsync(`UPDATE story_events SET ${sets.join(', ')} WHERE id = ?`, ...args);
    },

    async getEvent(id) {
      const d = await db();
      const row = await d.getFirstAsync<Record<string, unknown>>('SELECT * FROM story_events WHERE id = ?', id);
      return row ? rowToEvent(row) : null;
    },

    async getEvents(ids) {
      const uniq = [...new Set(ids.filter(Boolean))].slice(0, 400);
      if (!uniq.length) return [];
      const d = await db();
      const ph = uniq.map(() => '?').join(', ');
      const rows = await d.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM story_events WHERE id IN (${ph})`,
        ...uniq,
      );
      return rows.map(rowToEvent);
    },

    async listEvents(playthroughId, opts = {}) {
      const d = await db();
      const limit = Math.max(1, Math.min(2000, opts.limit ?? 400));
      const clauses = ['playthrough_id = ?'];
      const args: (string | number)[] = [playthroughId];
      if (!opts.includeArchived) clauses.push('archived = 0');
      if (opts.types?.length) {
        clauses.push(`type IN (${opts.types.map(() => '?').join(', ')})`);
        args.push(...opts.types);
      }
      if (opts.minImportance !== undefined) {
        clauses.push('importance >= ?');
        args.push(opts.minImportance);
      }
      const rows = await d.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM story_events WHERE ${clauses.join(' AND ')} ORDER BY seq DESC LIMIT ${limit}`,
        ...args,
      );
      return rows.map(rowToEvent);
    },

    async countEvents(playthroughId) {
      const d = await db();
      const row = await d.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM story_events WHERE playthrough_id = ?',
        playthroughId,
      );
      return row?.n ?? 0;
    },

    async upsertRelationship(r) {
      const d = await db();
      await d.runAsync(
        `INSERT OR REPLACE INTO relationship_states (
          playthrough_id, story_id, pair_key, a_id, a_name, b_id, b_name, status, tier,
          trust, affection, tension, respect, confidence, history, source_event_ids,
          created_at, updated_at, last_confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.playthroughId,
        r.storyId,
        r.pairKey,
        r.a.id,
        r.a.name,
        r.b.id,
        r.b.name,
        r.status,
        r.tier,
        r.trust ?? null,
        r.affection ?? null,
        r.tension ?? null,
        r.respect ?? null,
        r.confidence,
        toJson(r.history),
        toJson(r.sourceEventIds),
        r.createdAt,
        r.updatedAt,
        r.lastConfirmedAt,
      );
    },

    async getRelationship(playthroughId, pairKey) {
      const d = await db();
      const row = await d.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM relationship_states WHERE playthrough_id = ? AND pair_key = ?',
        playthroughId,
        pairKey,
      );
      return row ? rowToRelationship(row) : null;
    },

    async listRelationships(playthroughId) {
      const d = await db();
      const rows = await d.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM relationship_states WHERE playthrough_id = ? ORDER BY tier DESC, updated_at DESC LIMIT 60',
        playthroughId,
      );
      return rows.map(rowToRelationship);
    },

    async insertKnowledge(k) {
      const d = await db();
      await d.runAsync(
        `INSERT OR REPLACE INTO character_knowledge (
          id, playthrough_id, story_id, character_id, character_name, fact, fact_key, source,
          learned_from, source_event_id, source_message_ids, learned_at, story_day, confidence,
          status, invalidated_by, invalidated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        k.id,
        k.playthroughId,
        k.storyId,
        k.characterId,
        k.characterName,
        k.fact,
        k.factKey,
        k.source,
        k.learnedFrom ?? null,
        k.sourceEventId ?? null,
        toJson(k.sourceMessageIds),
        k.learnedAt,
        k.storyDay ?? null,
        k.confidence,
        k.status,
        k.invalidatedBy ?? null,
        k.invalidatedAt ?? null,
      );
    },

    async listKnowledge(playthroughId, opts = {}) {
      const d = await db();
      const limit = Math.max(1, Math.min(600, opts.limit ?? 200));
      const clauses = ['playthrough_id = ?'];
      const args: (string | number)[] = [playthroughId];
      if (opts.characterId) {
        clauses.push('character_id = ?');
        args.push(opts.characterId);
      }
      if (!opts.includeInvalidated) clauses.push("status != 'invalidated'");
      const rows = await d.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM character_knowledge WHERE ${clauses.join(' AND ')} ORDER BY learned_at DESC LIMIT ${limit}`,
        ...args,
      );
      return rows.map(rowToKnowledge);
    },

    async getKnowledge(ids) {
      const uniq = [...new Set(ids.filter(Boolean))].slice(0, 200);
      if (!uniq.length) return [];
      const d = await db();
      const ph = uniq.map(() => '?').join(', ');
      const rows = await d.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM character_knowledge WHERE id IN (${ph})`,
        ...uniq,
      );
      return rows.map(rowToKnowledge);
    },

    async findKnowledgeByFactKey(playthroughId, characterId, factKey) {
      const d = await db();
      const row = await d.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM character_knowledge WHERE playthrough_id = ? AND character_id = ? AND fact_key = ? LIMIT 1',
        playthroughId,
        characterId,
        factKey,
      );
      return row ? rowToKnowledge(row) : null;
    },

    async updateKnowledge(id, patch) {
      const d = await db();
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      for (const [k, v] of Object.entries(patch)) {
        const column = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        sets.push(`${column} = ?`);
        args.push(k === 'sourceMessageIds' ? toJson(v) : ((v ?? null) as string | number | null));
      }
      if (!sets.length) return;
      args.push(id);
      await d.runAsync(`UPDATE character_knowledge SET ${sets.join(', ')} WHERE id = ?`, ...args);
    },

    async indexRecord(storyId, playthroughId, recordType, recordId, keywords) {
      const d = await db();
      const uniq = [...new Set(keywords.filter((k) => k && k.length >= 3))].slice(0, 80);
      if (!uniq.length) return;
      // Replace this record's rows so re-indexing never duplicates weights.
      await d.runAsync(
        'DELETE FROM memory_index WHERE playthrough_id = ? AND record_type = ? AND record_id = ?',
        playthroughId,
        recordType,
        recordId,
      );
      for (const token of uniq) {
        const weight = token.startsWith('c:') ? 2.2 : 1 + Math.min(1, Math.max(0, (token.length - 4) / 3));
        await d.runAsync(
          `INSERT OR REPLACE INTO memory_index (playthrough_id, story_id, record_type, record_id, token, weight)
           VALUES (?, ?, ?, ?, ?, ?)`,
          playthroughId,
          storyId,
          recordType,
          recordId,
          token,
          weight,
        );
      }
    },

    async searchIndex(playthroughId, tokens, limit = 160) {
      const uniq = [...new Set(tokens.filter((t) => t && t.length >= 3))].slice(0, 24);
      if (!uniq.length) return [];
      const d = await db();
      const ph = uniq.map(() => '?').join(', ');
      const rows = await d.getAllAsync<{ record_type: string; record_id: string; w: number }>(
        `SELECT record_type, record_id, SUM(weight) AS w
           FROM memory_index
          WHERE playthrough_id = ? AND token IN (${ph})
          GROUP BY record_type, record_id
          ORDER BY w DESC
          LIMIT ${Math.max(1, Math.min(600, limit))}`,
        playthroughId,
        ...uniq,
      );
      return rows.map((r) => ({
        recordType: r.record_type as IndexedRecordType,
        recordId: r.record_id,
        weight: r.w,
      }));
    },

    async rebuildIndex() {
      const d = await db();
      try {
        await d.execAsync('DELETE FROM memory_index;');
      } catch {
        return 0;
      }
      let written = 0;
      const events = await d.getAllAsync<{ id: string; story_id: string; playthrough_id: string; keywords: string | null; summary: string; type: string }>(
        'SELECT id, story_id, playthrough_id, keywords, summary, type FROM story_events',
      );
      for (const e of events) {
        const keywords = [...new Set([...fromStringArray(e.keywords), ...keywordRow(e.summary, e.type)])];
        await this.indexRecord(e.story_id, e.playthrough_id, 'event', e.id, keywords);
        written++;
      }
      const knowledge = await d.getAllAsync<{ id: string; story_id: string; playthrough_id: string; fact: string; character_name: string }>(
        'SELECT id, story_id, playthrough_id, fact, character_name FROM character_knowledge',
      );
      for (const k of knowledge) {
        await this.indexRecord(k.story_id, k.playthrough_id, 'knowledge', k.id, keywordRow(k.fact, k.character_name));
        written++;
      }
      const rels = await d.getAllAsync<{ pair_key: string; story_id: string; playthrough_id: string; a_name: string; b_name: string; status: string }>(
        'SELECT pair_key, story_id, playthrough_id, a_name, b_name, status FROM relationship_states',
      );
      for (const r of rels) {
        await this.indexRecord(r.story_id, r.playthrough_id, 'relationship', r.pair_key, keywordRow(r.a_name, r.b_name, r.status));
        written++;
      }
      return written;
    },

    async insertContradiction(c) {
      const d = await db();
      await d.runAsync(
        `INSERT OR REPLACE INTO memory_contradictions (
          id, playthrough_id, story_id, at, kind, expected, proposed, reason, evidence, resolved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.playthroughId,
        c.storyId,
        c.at,
        c.kind,
        c.expected,
        c.proposed,
        c.reason,
        c.evidence,
        c.resolved ? 1 : 0,
      );
    },

    async listContradictions(playthroughId, limit = 20) {
      const d = await db();
      const rows = await d.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM memory_contradictions WHERE playthrough_id = ? ORDER BY at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`,
        playthroughId,
      );
      return rows.map((r) => ({
        id: String(r.id),
        storyId: String(r.story_id),
        playthroughId: String(r.playthrough_id),
        at: String(r.at),
        kind: r.kind as MemoryContradiction['kind'],
        expected: String(r.expected ?? ''),
        proposed: String(r.proposed ?? ''),
        reason: String(r.reason ?? ''),
        evidence: String(r.evidence ?? ''),
        resolved: !!r.resolved,
      }));
    },

    async rawMessages(ids) {
      const uniq = [...new Set(ids.filter(Boolean))].slice(0, 24);
      if (!uniq.length) return [];
      const d = await db();
      const ph = uniq.map(() => '?').join(', ');
      const rows = await d.getAllAsync<{
        id: string;
        role: string;
        speaker: string | null;
        text: string;
        created_at: string;
      }>(`SELECT id, role, speaker, text, created_at FROM messages WHERE id IN (${ph})`, ...uniq);
      return rows.map((r) => ({
        id: r.id,
        role: r.role as ChatMessage['role'],
        speaker: r.speaker,
        text: r.text,
        createdAt: r.created_at,
      }));
    },

    async getMeta(playthroughId, key) {
      const d = await db();
      const row = await d.getFirstAsync<{ value: string }>(
        'SELECT value FROM kv WHERE key = ?',
        `storyMem:${playthroughId}:${key}`,
      );
      return row?.value ?? null;
    },

    async setMeta(playthroughId, key, value) {
      const d = await db();
      await d.runAsync(
        'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
        `storyMem:${playthroughId}:${key}`,
        value,
      );
    },

    async deleteForPlaythrough(playthroughId) {
      const d = await db();
      for (const table of [
        'story_events',
        'relationship_states',
        'character_knowledge',
        'memory_index',
        'memory_contradictions',
      ]) {
        try {
          await d.runAsync(`DELETE FROM ${table} WHERE playthrough_id = ?`, playthroughId);
        } catch {
          /* table missing on a partially migrated install */
        }
      }
      try {
        await d.runAsync('DELETE FROM kv WHERE key LIKE ?', `storyMem:${playthroughId}:%`);
      } catch {}
    },
  };
}

function rowToEvent(r: Record<string, unknown>): StoryEventRecord {
  const importance = Number(r.importance ?? 1);
  return {
    id: String(r.id),
    storyId: String(r.story_id),
    playthroughId: String(r.playthrough_id),
    seq: Number(r.seq ?? 0),
    type: (r.type as StoryEventType) ?? 'other',
    summary: String(r.summary ?? ''),
    detail: r.detail == null ? null : String(r.detail),
    importance,
    importanceLabel: (r.importance_label as StoryEventRecord['importanceLabel']) ?? 'LOW',
    confidence: (r.confidence as StoryEventRecord['confidence']) ?? 'medium',
    source: (r.source as StoryEventRecord['source']) ?? 'derived',
    sourceMessageIds: fromStringArray(r.source_message_ids),
    sourceEventIds: fromStringArray(r.source_event_ids),
    sceneId: r.scene_id == null ? null : String(r.scene_id),
    location: r.location == null ? null : String(r.location),
    participants: fromStringArray(r.participants),
    pairKeys: fromStringArray(r.pair_keys),
    objectNames: fromStringArray(r.objects),
    storyDay: r.story_day == null ? null : Number(r.story_day),
    occurredAt: String(r.occurred_at ?? new Date().toISOString()),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    status: (r.status as StoryEventRecord['status']) ?? 'active',
    supersededBy: r.superseded_by == null ? null : String(r.superseded_by),
    keywords: fromStringArray(r.keywords),
    archived: !!r.archived,
  };
}

function rowToRelationship(r: Record<string, unknown>): RelationshipStateRecord {
  return {
    id: String(r.pair_key),
    storyId: String(r.story_id),
    playthroughId: String(r.playthrough_id),
    pairKey: String(r.pair_key),
    a: { id: String(r.a_id), name: String(r.a_name) },
    b: { id: String(r.b_id), name: String(r.b_name) },
    status: String(r.status ?? 'acquaintance'),
    tier: Number(r.tier ?? -1),
    trust: r.trust == null ? null : Number(r.trust),
    affection: r.affection == null ? null : Number(r.affection),
    tension: r.tension == null ? null : Number(r.tension),
    respect: r.respect == null ? null : Number(r.respect),
    confidence: (r.confidence as RelationshipStateRecord['confidence']) ?? 'medium',
    history: fromHistory(r.history),
    sourceEventIds: fromStringArray(r.source_event_ids),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    lastConfirmedAt: String(r.last_confirmed_at ?? new Date().toISOString()),
  };
}

function rowToKnowledge(r: Record<string, unknown>): CharacterKnowledgeRecord {
  return {
    id: String(r.id),
    storyId: String(r.story_id),
    playthroughId: String(r.playthrough_id),
    characterId: String(r.character_id),
    characterName: String(r.character_name),
    fact: String(r.fact ?? ''),
    factKey: String(r.fact_key ?? ''),
    source: (r.source as CharacterKnowledgeRecord['source']) ?? 'witnessed',
    learnedFrom: r.learned_from == null ? null : String(r.learned_from),
    sourceEventId: r.source_event_id == null ? null : String(r.source_event_id),
    sourceMessageIds: fromStringArray(r.source_message_ids),
    learnedAt: String(r.learned_at ?? new Date().toISOString()),
    storyDay: r.story_day == null ? null : Number(r.story_day),
    confidence: (r.confidence as CharacterKnowledgeRecord['confidence']) ?? 'medium',
    status: (r.status as CharacterKnowledgeRecord['status']) ?? 'believed',
    invalidatedBy: r.invalidated_by == null ? null : String(r.invalidated_by),
    invalidatedAt: r.invalidated_at == null ? null : String(r.invalidated_at),
  };
}

/* ------------------------------------------------------------------ */
/* In-memory implementation (tests, diagnostics)                       */
/* ------------------------------------------------------------------ */

export interface InMemoryStoryMemoryStore extends StoryMemoryStore {
  /** Direct inspection for tests/diagnostics — never used by the app. */
  readonly _data: {
    events: StoryEventRecord[];
    relationships: RelationshipStateRecord[];
    knowledge: CharacterKnowledgeRecord[];
    index: { playthroughId: string; storyId: string; recordType: IndexedRecordType; recordId: string; token: string; weight: number }[];
    contradictions: MemoryContradiction[];
    messages: Pick<ChatMessage, 'id' | 'role' | 'speaker' | 'text' | 'createdAt'>[];
    meta: Map<string, string>;
  };
}

export function createInMemoryStoryMemoryStore(): InMemoryStoryMemoryStore {
  const events: StoryEventRecord[] = [];
  const relationships: RelationshipStateRecord[] = [];
  const knowledge: CharacterKnowledgeRecord[] = [];
  const index: InMemoryStoryMemoryStore['_data']['index'] = [];
  const contradictions: MemoryContradiction[] = [];
  const messages: InMemoryStoryMemoryStore['_data']['messages'] = [];
  const meta = new Map<string, string>();
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  return {
    _data: { events, relationships, knowledge, index, contradictions, messages, meta },

    async nextSeq(playthroughId) {
      const seqs = events.filter((e) => e.playthroughId === playthroughId).map((e) => e.seq);
      return seqs.length ? Math.max(...seqs) + 1 : 1;
    },

    async insertEvent(e) {
      const i = events.findIndex((x) => x.id === e.id);
      if (i >= 0) events[i] = clone(e);
      else events.push(clone(e));
    },

    async updateEvent(id, patch) {
      const i = events.findIndex((x) => x.id === id);
      if (i >= 0) events[i] = { ...events[i], ...clone(patch) };
    },

    async getEvent(id) {
      const e = events.find((x) => x.id === id);
      return e ? clone(e) : null;
    },

    async getEvents(ids) {
      const wanted = new Set(ids);
      return events.filter((e) => wanted.has(e.id)).map(clone);
    },

    async listEvents(playthroughId, opts = {}) {
      const limit = Math.max(1, opts.limit ?? 400);
      return events
        .filter((e) => e.playthroughId === playthroughId)
        .filter((e) => opts.includeArchived || !e.archived)
        .filter((e) => !opts.types?.length || opts.types.includes(e.type))
        .filter((e) => opts.minImportance === undefined || e.importance >= opts.minImportance)
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
        .map(clone);
    },

    async countEvents(playthroughId) {
      return events.filter((e) => e.playthroughId === playthroughId).length;
    },

    async upsertRelationship(r) {
      const i = relationships.findIndex((x) => x.playthroughId === r.playthroughId && x.pairKey === r.pairKey);
      if (i >= 0) relationships[i] = clone(r);
      else relationships.push(clone(r));
    },

    async getRelationship(playthroughId, pairKey) {
      const r = relationships.find((x) => x.playthroughId === playthroughId && x.pairKey === pairKey);
      return r ? clone(r) : null;
    },

    async listRelationships(playthroughId) {
      return relationships.filter((r) => r.playthroughId === playthroughId).map(clone);
    },

    async insertKnowledge(k) {
      const i = knowledge.findIndex((x) => x.id === k.id);
      if (i >= 0) knowledge[i] = clone(k);
      else knowledge.push(clone(k));
    },

    async listKnowledge(playthroughId, opts = {}) {
      return knowledge
        .filter((k) => k.playthroughId === playthroughId)
        .filter((k) => !opts.characterId || k.characterId === opts.characterId)
        .filter((k) => opts.includeInvalidated || k.status !== 'invalidated')
        .slice(0, opts.limit ?? 200)
        .map(clone);
    },

    async getKnowledge(ids) {
      const wanted = new Set(ids);
      return knowledge.filter((k) => wanted.has(k.id)).map(clone);
    },

    async findKnowledgeByFactKey(playthroughId, characterId, factKey) {
      const k = knowledge.find(
        (x) => x.playthroughId === playthroughId && x.characterId === characterId && x.factKey === factKey,
      );
      return k ? clone(k) : null;
    },

    async updateKnowledge(id, patch) {
      const i = knowledge.findIndex((x) => x.id === id);
      if (i >= 0) knowledge[i] = { ...knowledge[i], ...clone(patch) };
    },

    async indexRecord(storyId, playthroughId, recordType, recordId, keywords) {
      for (let i = index.length - 1; i >= 0; i--) {
        const row = index[i];
        if (row.playthroughId === playthroughId && row.recordType === recordType && row.recordId === recordId) {
          index.splice(i, 1);
        }
      }
      for (const token of [...new Set(keywords.filter((k) => k && k.length >= 3))].slice(0, 80)) {
        const weight = token.startsWith('c:') ? 2.2 : 1 + Math.min(1, Math.max(0, (token.length - 4) / 3));
        index.push({ playthroughId, storyId, recordType, recordId, token, weight });
      }
    },

    async searchIndex(playthroughId, tokens, limit = 160) {
      const wanted = new Set(tokens.filter((t) => t && t.length >= 3).slice(0, 24));
      if (!wanted.size) return [];
      const byRecord = new Map<string, { recordType: IndexedRecordType; recordId: string; weight: number }>();
      for (const row of index) {
        if (row.playthroughId !== playthroughId || !wanted.has(row.token)) continue;
        const key = `${row.recordType}|${row.recordId}`;
        const cur = byRecord.get(key) ?? { recordType: row.recordType, recordId: row.recordId, weight: 0 };
        cur.weight += row.weight;
        byRecord.set(key, cur);
      }
      return [...byRecord.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
    },

    async rebuildIndex() {
      for (const event of events) {
        await this.indexRecord(event.storyId, event.playthroughId, 'event', event.id, [
          ...new Set([...(event.keywords ?? []), ...keywordRow(event.summary, event.type)]),
        ]);
      }
      for (const k of knowledge) {
        await this.indexRecord(k.storyId, k.playthroughId, 'knowledge', k.id, keywordRow(k.fact, k.characterName));
      }
      for (const r of relationships) {
        await this.indexRecord(r.storyId, r.playthroughId, 'relationship', r.pairKey, keywordRow(r.a.name, r.b.name, r.status));
      }
      return events.length + knowledge.length + relationships.length;
    },

    async insertContradiction(c) {
      const i = contradictions.findIndex((x) => x.id === c.id);
      if (i >= 0) contradictions[i] = clone(c);
      else contradictions.push(clone(c));
    },

    async listContradictions(playthroughId, limit = 20) {
      return contradictions.filter((c) => c.playthroughId === playthroughId).slice(0, limit).map(clone);
    },

    async rawMessages(ids) {
      const wanted = new Set(ids);
      return messages.filter((m) => wanted.has(m.id)).map(clone);
    },

    async getMeta(playthroughId, key) {
      return meta.get(`${playthroughId}:${key}`) ?? null;
    },

    async setMeta(playthroughId, key, value) {
      meta.set(`${playthroughId}:${key}`, value);
    },

    async deleteForPlaythrough(playthroughId) {
      const drop = <T extends { playthroughId: string }>(arr: T[]) => {
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i].playthroughId === playthroughId) arr.splice(i, 1);
      };
      drop(events);
      drop(relationships);
      drop(knowledge);
      drop(index);
      drop(contradictions);
      for (const key of [...meta.keys()]) if (key.startsWith(`${playthroughId}:`)) meta.delete(key);
    },
  };
}
