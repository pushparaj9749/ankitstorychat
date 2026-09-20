/**
 * Export / Import — move local data between devices WITHOUT any cloud.
 * The file is written locally and shared via the OS share sheet
 * (user picks where it goes). Nothing is uploaded automatically.
 *
 * NOTE: API keys are NEVER exported (they live in SecureStore).
 * After import, the user re-enters keys in AI Add-ons.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import type { DataExport } from '../types';
import {
  getProfile,
  getSettings,
  getStats,
  listAllMemories,
  listAllMessages,
  listAllPlaythroughs,
  listFavorites,
  listProviders,
  saveProfile,
  saveSettings,
  kvEntries,
  kvSet,
  getDb,
} from './db';
import { cachePath, docPath, readText, writeText } from './files';
import { nowIso } from './utils';

export async function buildExport(): Promise<DataExport> {
  const [profile, settings, providers, playthroughs, messages, memories, favorites, stats, digests] =
    await Promise.all([
      getProfile(),
      getSettings(),
      listProviders(),
      listAllPlaythroughs(),
      listAllMessages(),
      listAllMemories(),
      listFavorites(),
      getStats(),
      kvEntries('memsum:'),
    ]);
  return {
    format: 'kissa-backup',
    formatVersion: 1,
    exportedAt: nowIso(),
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    profile,
    settings,
    providers,
    playthroughs,
    messages,
    memories,
    favorites,
    stats,
    memoryDigests: digests,
  };
}

/** Write the backup to a local file and open the OS share sheet. */
export async function exportAndShare(): Promise<{ fileUri: string; shared: boolean }> {
  const data = await buildExport();
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = cachePath(`kissa-backup-${stamp}.json`);
  await writeText(uri, JSON.stringify(data));
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your Kissa backup',
    });
    return { fileUri: uri, shared: true };
  }
  return { fileUri: uri, shared: false };
}

export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return res.assets[0].uri;
}

export function parseBackup(raw: string): DataExport {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('Ye valid backup file nahi hai (JSON toot gaya hai).');
  }
  const d = obj as Partial<DataExport>;
  if (d.format !== 'kissa-backup' || d.formatVersion !== 1) {
    throw new Error('Ye Kissa backup file nahi lag rahi.');
  }
  if (!Array.isArray(d.playthroughs) || !Array.isArray(d.messages)) {
    throw new Error('Backup file adhoori hai (playthroughs/messages missing).');
  }
  return d as DataExport;
}

/**
 * Replace ALL local data with the backup. Destructive — the UI must confirm.
 * Provider API keys must be re-entered afterwards (never exported).
 */
export async function importBackup(d: DataExport): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM messages;
    DELETE FROM memories;
    DELETE FROM playthroughs;
    DELETE FROM favorites;
    DELETE FROM downloads;
    DELETE FROM providers;
    DELETE FROM world_states;
    DELETE FROM kv;
  `);

  if (d.profile) await saveProfile(d.profile);
  if (d.settings) await saveSettings({ ...d.settings, activeProviderId: null });
  if (d.stats) await kvSet('stats', JSON.stringify(d.stats));

  for (const p of d.providers ?? []) {
    await db.runAsync(
      `INSERT INTO providers (id, name, type, base_url, model, temperature, max_tokens,
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
      null,
      null,
    );
  }
  for (const p of d.playthroughs) {
    await db.runAsync(
      `INSERT INTO playthroughs (id, story_id, label, status, current_scene_id, state,
        progress, message_count, ending_id, mode, provider_id, created_at, updated_at)
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
  for (const m of d.messages) {
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
  for (const m of d.memories ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO memories (
        id, playthrough_id, kind, text, importance, created_at, hash, hits,
        last_used, confidence, source, entities, expires_at, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      m.id,
      m.playthroughId,
      m.kind,
      m.text,
      m.importance,
      m.createdAt,
      m.hash ?? null,
      m.hits ?? 0,
      m.lastUsedAt ?? null,
      m.confidence ?? 'medium',
      m.source ?? 'derived',
      m.entities?.length ? JSON.stringify(m.entities) : null,
      m.expiresAt ?? null,
      m.archived ? 1 : 0,
    );
  }
  // Memory digests live in kv under memsum:<playthroughId>.
  for (const [key, value] of Object.entries(d.memoryDigests ?? {})) {
    if (key.startsWith('memsum:') && typeof value === 'string') await kvSet(key, value);
  }
  for (const f of d.favorites ?? []) {
    await db.runAsync('INSERT INTO favorites (story_id, created_at) VALUES (?, ?)', f.storyId, f.createdAt);
  }
}

export async function importFromUri(uri: string): Promise<DataExport> {
  const raw = await readText(uri.startsWith('file://') ? uri : docPath(uri));
  if (!raw) throw new Error('Backup file padhi nahi jaa saki.');
  return parseBackup(raw);
}
