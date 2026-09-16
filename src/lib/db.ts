/**
 * Local-first SQLite database (expo-sqlite).
 * Stores: profile, settings, chats, messages, memories, playthroughs,
 * favorites, downloads, provider metadata (NEVER api keys), stats.
 */
import * as SQLite from 'expo-sqlite';
import type {
  AIProvider,
  AppSettings,
  ChatMessage,
  DEFAULT_SETTINGS as _DS,
  DownloadRecord,
  Favorite,
  LocalProfile,
  LocalStats,
  MemoryEntry,
  Playthrough,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';

const DB_NAME = 'kissa.db';
const SCHEMA_VERSION = 4;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playthroughs (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      current_scene_id TEXT NOT NULL,
      state TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      ending_id TEXT,
      mode TEXT NOT NULL DEFAULT 'ai',
      provider_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_playthroughs_story ON playthroughs(story_id);
    CREATE INDEX IF NOT EXISTS idx_playthroughs_updated ON playthroughs(updated_at DESC);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      playthrough_id TEXT NOT NULL,
      role TEXT NOT NULL,
      speaker TEXT,
      text TEXT NOT NULL,
      scene_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_playthrough ON messages(playthrough_id, created_at);
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      playthrough_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      hash TEXT,
      hits INTEGER NOT NULL DEFAULT 0,
      last_used TEXT,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_memories_playthrough ON memories(playthrough_id);
    CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(playthrough_id, kind, archived);
    CREATE TABLE IF NOT EXISTS favorites (
      story_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS downloads (
      story_id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      downloaded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.8,
      max_tokens INTEGER NOT NULL DEFAULT 600,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_tested_at TEXT,
      last_test_ok INTEGER
    );
  `);

  // v3 -> v4: long-term memory columns. Runs AFTER the CREATEs above, so a fresh
  // install already has them (ALTER then throws "duplicate column" -> ignored),
  // while an existing install gets them added in place.
  if (current < 4) {
    for (const ddl of [
      'ALTER TABLE memories ADD COLUMN hash TEXT',
      'ALTER TABLE memories ADD COLUMN hits INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE memories ADD COLUMN last_used TEXT',
      'ALTER TABLE memories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0',
      'CREATE UNIQUE INDEX IF NOT EXISTS u_mem_hash ON memories(playthrough_id, hash)',
    ]) {
      try {
        await db.execAsync(ddl);
      } catch {
        /* column/index already present */
      }
    }
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/* ---------------- key-value ---------------- */

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

/** All kv rows whose key starts with `prefix` (used to export memory digests). */
export async function kvEntries(prefix: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM kv WHERE key LIKE ?',
    `${prefix}%`,
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM kv WHERE key = ?', key);
}

/* ---------------- profile / settings / stats ---------------- */

const K_PROFILE = 'profile';
const K_SETTINGS = 'settings';
const K_STATS = 'stats';

export async function getProfile(): Promise<LocalProfile | null> {
  const raw = await kvGet(K_PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(p: LocalProfile): Promise<void> {
  await kvSet(K_PROFILE, JSON.stringify(p));
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await kvGet(K_SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { contentManifestUrl?: string };
    // Retired setting: the pre-API raw-GitHub manifest URL. Dropped on read so
    // old installs fall back to the configured story API base.
    delete parsed.contentManifestUrl;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await kvSet(K_SETTINGS, JSON.stringify(s));
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await getSettings();
  const next: AppSettings = {
    ...cur,
    ...patch,
    notifications: { ...cur.notifications, ...(patch.notifications ?? {}) },
  };
  await saveSettings(next);
  return next;
}

export function defaultStats(): LocalStats {
  return { storiesStarted: 0, storiesCompleted: 0, messagesSent: 0, choicesMade: 0, minutesPlayed: 0 };
}

export async function getStats(): Promise<LocalStats> {
  const raw = await kvGet(K_STATS);
  if (!raw) return defaultStats();
  try {
    return { ...defaultStats(), ...(JSON.parse(raw) as Partial<LocalStats>) };
  } catch {
    return defaultStats();
  }
}

export async function updateStats(patch: Partial<LocalStats>): Promise<LocalStats> {
  const cur = await getStats();
  const next = { ...cur };
  (Object.keys(patch) as (keyof LocalStats)[]).forEach((k) => {
    next[k] = (cur[k] ?? 0) + (patch[k] ?? 0);
  });
  await kvSet(K_STATS, JSON.stringify(next));
  return next;
}

/* ---------------- playthroughs ---------------- */

interface PlaythroughRow {
  id: string;
  story_id: string;
  label: string;
  status: string;
  current_scene_id: string;
  state: string;
  progress: number;
  message_count: number;
  ending_id: string | null;
  mode: string;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPlaythrough(r: PlaythroughRow): Playthrough {
  return {
    id: r.id,
    storyId: r.story_id,
    label: r.label,
    status: r.status as Playthrough['status'],
    currentSceneId: r.current_scene_id,
    state: JSON.parse(r.state) as Playthrough['state'],
    progress: r.progress,
    messageCount: r.message_count,
    endingId: r.ending_id,
    mode: 'ai' as Playthrough['mode'],
    providerId: r.provider_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertPlaythrough(p: Playthrough): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO playthroughs (id, story_id, label, status, current_scene_id, state, progress,
      message_count, ending_id, mode, provider_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id,
    p.storyId,
    p.label,
    p.status,
    p.currentSceneId,
    JSON.stringify(p.state),
    p.progress,
    p.messageCount,
    p.endingId,
    p.mode,
    p.providerId,
    p.createdAt,
    p.updatedAt,
  );
}

export async function updatePlaythrough(p: Playthrough): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE playthroughs SET label=?, status=?, current_scene_id=?, state=?, progress=?,
      message_count=?, ending_id=?, mode=?, provider_id=?, updated_at=? WHERE id=?`,
    p.label,
    p.status,
    p.currentSceneId,
    JSON.stringify(p.state),
    p.progress,
    p.messageCount,
    p.endingId,
    p.mode,
    p.providerId,
    p.updatedAt,
    p.id,
  );
}

export async function getPlaythrough(id: string): Promise<Playthrough | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PlaythroughRow>('SELECT * FROM playthroughs WHERE id = ?', id);
  return row ? rowToPlaythrough(row) : null;
}

export async function listPlaythroughsForStory(storyId: string): Promise<Playthrough[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaythroughRow>(
    'SELECT * FROM playthroughs WHERE story_id = ? ORDER BY updated_at DESC',
    storyId,
  );
  return rows.map(rowToPlaythrough);
}

export async function listRecentPlaythroughs(limit = 10): Promise<Playthrough[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaythroughRow>(
    'SELECT * FROM playthroughs ORDER BY updated_at DESC LIMIT ?',
    limit,
  );
  return rows.map(rowToPlaythrough);
}

export async function listAllPlaythroughs(): Promise<Playthrough[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlaythroughRow>('SELECT * FROM playthroughs ORDER BY updated_at DESC');
  return rows.map(rowToPlaythrough);
}

export async function deletePlaythrough(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages WHERE playthrough_id = ?', id);
  await db.runAsync('DELETE FROM memories WHERE playthrough_id = ?', id);
  await db.runAsync('DELETE FROM playthroughs WHERE id = ?', id);
}

export async function deletePlaythroughsForStory(storyId: string): Promise<void> {
  const list = await listPlaythroughsForStory(storyId);
  for (const p of list) await deletePlaythrough(p.id);
}

/* ---------------- messages ---------------- */

interface MessageRow {
  id: string;
  playthrough_id: string;
  role: string;
  speaker: string | null;
  text: string;
  scene_id: string | null;
  created_at: string;
}

function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    playthroughId: r.playthrough_id,
    role: r.role as ChatMessage['role'],
    speaker: r.speaker,
    text: r.text,
    sceneId: r.scene_id,
    createdAt: r.created_at,
  };
}

export async function insertMessage(m: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO messages (id, playthrough_id, role, speaker, text, scene_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    m.id,
    m.playthroughId,
    m.role,
    m.speaker,
    m.text,
    m.sceneId,
    m.createdAt,
  );
}

/** Paginated history, newest-first (for inverted FlatList). */
export async function listMessages(
  playthroughId: string,
  limit = 50,
  beforeCreatedAt?: string,
): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = beforeCreatedAt
    ? await db.getAllAsync<MessageRow>(
        'SELECT * FROM messages WHERE playthrough_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
        playthroughId,
        beforeCreatedAt,
        limit,
      )
    : await db.getAllAsync<MessageRow>(
        'SELECT * FROM messages WHERE playthrough_id = ? ORDER BY created_at DESC LIMIT ?',
        playthroughId,
        limit,
      );
  return rows.map(rowToMessage);
}

/** Oldest-first window for AI context. */
export async function listRecentMessagesAsc(playthroughId: string, limit = 30): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT * FROM (SELECT * FROM messages WHERE playthrough_id = ? ORDER BY created_at DESC LIMIT ?)
     ORDER BY created_at ASC`,
    playthroughId,
    limit,
  );
  return rows.map(rowToMessage);
}

export async function countMessages(playthroughId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM messages WHERE playthrough_id = ?',
    playthroughId,
  );
  return row?.n ?? 0;
}

export async function listAllMessages(): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>('SELECT * FROM messages ORDER BY created_at ASC');
  return rows.map(rowToMessage);
}

export async function clearMessages(playthroughId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages WHERE playthrough_id = ?', playthroughId);
}

/* ---------------- memories ---------------- */

interface MemoryRow {
  id: string;
  playthrough_id: string;
  kind: string;
  text: string;
  importance: number;
  created_at: string;
  hash: string | null;
  hits: number | null;
  last_used: string | null;
  archived: number | null;
}

function rowToMemory(r: MemoryRow): MemoryEntry {
  return {
    id: r.id,
    playthroughId: r.playthrough_id,
    kind: r.kind as MemoryEntry['kind'],
    text: r.text,
    importance: r.importance,
    createdAt: r.created_at,
    hash: r.hash ?? undefined,
    hits: r.hits ?? 0,
    archived: !!r.archived,
  };
}

export type InsertMemoryResult = 'inserted' | 'reinforced';

/**
 * Store a memory. When the same fact already exists (dedupe key
 * playthrough_id + hash) the existing row is reinforced instead of duplicated,
 * and un-archived so a corrected/repeated fact becomes live again.
 */
export async function insertMemory(m: MemoryEntry, hash?: string): Promise<InsertMemoryResult> {
  const db = await getDb();
  if (hash) {
    const dup = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM memories WHERE playthrough_id = ? AND hash = ? LIMIT 1',
      m.playthroughId,
      hash,
    );
    if (dup) {
      await db.runAsync(
        'UPDATE memories SET importance = MIN(9, importance + 1), hits = hits + 1, archived = 0 WHERE id = ?',
        dup.id,
      );
      return 'reinforced';
    }
  }
  await db.runAsync(
    `INSERT INTO memories (id, playthrough_id, kind, text, importance, created_at, hash, hits, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    m.id,
    m.playthroughId,
    m.kind,
    m.text,
    m.importance,
    m.createdAt,
    hash ?? null,
  );
  return 'inserted';
}

export interface CandidateCaps {
  recent: number;
  important: number;
  pinned: number;
  total: number;
}

const DEFAULT_CAPS: CandidateCaps = { recent: 160, important: 160, pinned: 120, total: 420 };

/**
 * Retrieval pool for one turn. A UNION of buckets instead of "the newest N rows",
 * so a fact learned on turn 3 is still reachable on turn 900.
 */
export async function listMemoryCandidates(
  playthroughIds: string[],
  caps: Partial<CandidateCaps> = {},
): Promise<MemoryEntry[]> {
  const ids = playthroughIds.filter(Boolean);
  if (!ids.length) return [];
  const c = { ...DEFAULT_CAPS, ...caps };
  const ph = ids.map(() => '?').join(', ');
  const db = await getDb();
  // Each bucket is wrapped in its own subquery: SQLite rejects ORDER BY/LIMIT directly
  // on a UNION arm. Interpolated caps are internal integers, never user input.
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM (
       SELECT * FROM (
         SELECT * FROM memories WHERE playthrough_id IN (${ph}) AND archived = 0
         ORDER BY created_at DESC LIMIT ${c.recent}
       )
       UNION
       SELECT * FROM (
         SELECT * FROM memories WHERE playthrough_id IN (${ph}) AND archived = 0
         ORDER BY importance DESC, created_at DESC LIMIT ${c.important}
       )
       UNION
       SELECT * FROM (
         SELECT * FROM memories WHERE playthrough_id IN (${ph}) AND archived = 0
           AND kind IN ('preference','summary')
         ORDER BY created_at DESC LIMIT ${c.pinned}
       )
     )
     ORDER BY importance DESC, created_at DESC LIMIT ${c.total}`,
  );
  return rows.map(rowToMemory);
}

/** Memories actually used this turn become stronger (capped, throttled). */
export async function reinforceMemories(ids: string[], usedAt: string): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const ph = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE memories SET
       hits = hits + 1,
       last_used = ?,
       importance = CASE WHEN (hits + 1) % 3 = 0 THEN MIN(9, importance + 1) ELSE importance END
     WHERE id IN (${ph}) AND kind != 'episode'`,
    usedAt,
    ...ids,
  );
}

export async function archiveMemories(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const ph = ids.map(() => '?').join(', ');
  await db.runAsync(`UPDATE memories SET archived = 1 WHERE id IN (${ph})`);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM memories WHERE id = ?', id);
}

/** Live memories per kind — drives the consolidation trigger. */
export async function countMemories(playthroughIds: string[], kinds: string[] = []): Promise<number> {
  const ids = playthroughIds.filter(Boolean);
  if (!ids.length) return 0;
  const db = await getDb();
  const args = [...ids, ...kinds];
  const kindClause = kinds.length
    ? ` AND kind IN (${kinds.map(() => '?').join(', ')})`
    : '';
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM memories
      WHERE playthrough_id IN (${ids.map(() => '?').join(', ')}) AND archived = 0${kindClause}`,
    ...args,
  );
  return row?.n ?? 0;
}

/** Oldest live memories of the given kinds — the ones safe to fold into the digest. */
export async function listOldestMemories(
  playthroughIds: string[],
  kinds: string[],
  limit: number,
): Promise<MemoryEntry[]> {
  const ids = playthroughIds.filter(Boolean);
  if (!ids.length || limit <= 0) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM memories
      WHERE playthrough_id IN (${ids.map(() => '?').join(', ')})
        AND archived = 0 AND kind IN (${kinds.map(() => '?').join(', ')})
      ORDER BY created_at ASC LIMIT ${Math.max(1, Math.floor(limit))}`,
    ...ids,
    ...kinds,
  );
  return rows.map(rowToMemory);
}

export async function listMemories(playthroughId: string, limit = 200): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    'SELECT * FROM memories WHERE playthrough_id = ? AND archived = 0 ORDER BY importance DESC, created_at DESC LIMIT ?',
    playthroughId,
    limit,
  );
  return rows.map(rowToMemory);
}

export async function listAllMemories(): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>('SELECT * FROM memories ORDER BY created_at ASC');
  return rows.map(rowToMemory);
}

/** Everything stored for one journey, folded rows included — for the memory viewer. */
export async function listJourneyMemories(playthroughId: string): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    'SELECT * FROM memories WHERE playthrough_id = ? ORDER BY archived ASC, importance DESC, created_at DESC LIMIT 400',
    playthroughId,
  );
  return rows.map(rowToMemory);
}

/** Reader-level facts shared across every journey (scope `*`). */
export async function listGlobalMemories(): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    "SELECT * FROM memories WHERE playthrough_id = '*' ORDER BY importance DESC, created_at DESC LIMIT 200",
  );
  return rows.map(rowToMemory);
}

/** Pin a fact to the top of recall (importance 9 = never starved by the budget). */
export async function pinMemory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE memories SET importance = 9, archived = 0 WHERE id = ?", id);
}

/** Bring a folded (archived) fact back into live recall without touching the digest. */
export async function restoreMemory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE memories SET archived = 0 WHERE id = ?', id);
}

export async function deleteMemoriesForPlaythrough(playthroughId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM memories WHERE playthrough_id = ?', playthroughId);
}

/* ---------------- favorites ---------------- */

export async function addFavorite(storyId: string, createdAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO favorites (story_id, created_at) VALUES (?, ?)', storyId, createdAt);
}

export async function removeFavorite(storyId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE story_id = ?', storyId);
}

export async function isFavorite(storyId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ story_id: string }>(
    'SELECT story_id FROM favorites WHERE story_id = ?',
    storyId,
  );
  return !!row;
}

export async function listFavorites(): Promise<Favorite[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ story_id: string; created_at: string }>(
    'SELECT * FROM favorites ORDER BY created_at DESC',
  );
  return rows.map((r) => ({ storyId: r.story_id, createdAt: r.created_at }));
}

/* ---------------- downloads ---------------- */

export async function recordDownload(storyId: string, version: number, downloadedAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO downloads (story_id, version, downloaded_at) VALUES (?, ?, ?)',
    storyId,
    version,
    downloadedAt,
  );
}

export async function removeDownloadRecord(storyId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM downloads WHERE story_id = ?', storyId);
}

export async function getDownloadRecord(storyId: string): Promise<DownloadRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ story_id: string; version: number; downloaded_at: string }>(
    'SELECT * FROM downloads WHERE story_id = ?',
    storyId,
  );
  return row ? { storyId: row.story_id, version: row.version, downloadedAt: row.downloaded_at } : null;
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ story_id: string; version: number; downloaded_at: string }>(
    'SELECT * FROM downloads',
  );
  return rows.map((r) => ({ storyId: r.story_id, version: r.version, downloadedAt: r.downloaded_at }));
}

/* ---------------- providers (metadata only) ---------------- */

interface ProviderRow {
  id: string;
  name: string;
  type: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: number;
  created_at: string;
  updated_at: string;
  last_tested_at: string | null;
  last_test_ok: number | null;
}

function rowToProvider(r: ProviderRow): AIProvider {
  return {
    id: r.id,
    name: r.name,
    type: r.type as AIProvider['type'],
    baseUrl: r.base_url,
    model: r.model,
    temperature: r.temperature,
    maxTokens: r.max_tokens,
    enabled: r.enabled === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastTestedAt: r.last_tested_at,
    lastTestOk: r.last_test_ok === null ? null : r.last_test_ok === 1,
  };
}

export async function upsertProvider(p: AIProvider): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO providers (id, name, type, base_url, model, temperature, max_tokens,
      enabled, created_at, updated_at, last_tested_at, last_test_ok)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id,
    p.name,
    p.type,
    p.baseUrl,
    p.model,
    p.temperature,
    p.maxTokens,
    p.enabled ? 1 : 0,
    p.createdAt,
    p.updatedAt,
    p.lastTestedAt,
    p.lastTestOk === null ? null : p.lastTestOk ? 1 : 0,
  );
}

export async function deleteProvider(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM providers WHERE id = ?', id);
}

export async function listProviders(): Promise<AIProvider[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers ORDER BY created_at ASC');
  return rows.map(rowToProvider);
}

export async function getProvider(id: string): Promise<AIProvider | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ProviderRow>('SELECT * FROM providers WHERE id = ?', id);
  return row ? rowToProvider(row) : null;
}

/* ---------------- destructive ---------------- */

export async function clearAllUserData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM messages;
    DELETE FROM memories;
    DELETE FROM playthroughs;
    DELETE FROM favorites;
    DELETE FROM downloads;
    DELETE FROM providers;
    DELETE FROM kv;
  `);
}

export async function clearCacheTables(): Promise<void> {
  // Messages/memories of abandoned playthroughs older than nothing — cache here
  // means downloaded-story records are kept; this clears nothing destructive.
  // Real cache (downloaded JSON files) is cleared from the file layer.
  await kvDelete('content_remote_manifest_cache');
}

/** Approximate DB file usage for the Storage screen. */
export async function dbUsage(): Promise<{ messages: number; memories: number; playthroughs: number }> {
  const db = await getDb();
  const m = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM messages');
  const me = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories');
  const p = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM playthroughs');
  return { messages: m?.n ?? 0, memories: me?.n ?? 0, playthroughs: p?.n ?? 0 };
}

// Re-export to keep tree-shaken type import referenced.
export type { _DS };
