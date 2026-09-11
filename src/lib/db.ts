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
const SCHEMA_VERSION = 3;

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
      mode TEXT NOT NULL DEFAULT 'offline',
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
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_playthrough ON memories(playthrough_id);
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
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
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
    mode: (r.mode === 'ai' ? 'ai' : 'offline') as Playthrough['mode'],
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

export async function insertMemory(m: MemoryEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO memories (id, playthrough_id, kind, text, importance, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    m.id,
    m.playthroughId,
    m.kind,
    m.text,
    m.importance,
    m.createdAt,
  );
}

export async function listMemories(playthroughId: string, limit = 60): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    playthrough_id: string;
    kind: string;
    text: string;
    importance: number;
    created_at: string;
  }>(
    'SELECT * FROM memories WHERE playthrough_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?',
    playthroughId,
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    playthroughId: r.playthrough_id,
    kind: r.kind as MemoryEntry['kind'],
    text: r.text,
    importance: r.importance,
    createdAt: r.created_at,
  }));
}

export async function listAllMemories(): Promise<MemoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    playthrough_id: string;
    kind: string;
    text: string;
    importance: number;
    created_at: string;
  }>('SELECT * FROM memories ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    playthroughId: r.playthrough_id,
    kind: r.kind as MemoryEntry['kind'],
    text: r.text,
    importance: r.importance,
    createdAt: r.created_at,
  }));
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
