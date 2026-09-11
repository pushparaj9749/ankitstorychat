/**
 * Storage & Data: usage, export/import, clear cache, delete downloads,
 * delete chats, delete everything. Confirmations for destructive ops.
 */
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { LoadingState } from '../components/states';
import { clearAllUserData, getDb, getStats } from '../lib/db';
import { deleteApiKey } from '../lib/secureKeys';
import { listProviders } from '../lib/db';
import { clearCache, getStorageUsage, type StorageUsage } from '../lib/storage';
import { exportAndShare, importBackup, importFromUri, parseBackup, pickBackupFile } from '../lib/backup';
import { downloadedStoryIds, removeDownloadedStory } from '../content/loader';
import { FONTS, RADIUS, SPACING } from '../theme';
import { formatBytes } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsStorage'>;

export function SettingsStorage(_props: Props) {
  const { theme, stories, reloadAll } = useApp();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Set<string>>(new Set());

  async function load() {
    setUsage(await getStorageUsage());
    setDownloads(await downloadedStoryIds());
  }
  useEffect(() => {
    void load();
  }, []);

  async function doExport() {
    setBusy('export');
    setNote(null);
    try {
      const res = await exportAndShare();
      setNote(
        res.shared
          ? 'Backup ready — use the share sheet to save it (Drive, Files, WhatsApp…).'
          : `Share unavailable. Backup saved at: ${res.fileUri}`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    setBusy('import');
    setNote(null);
    try {
      const uri = await pickBackupFile();
      if (!uri) {
        setNote('No file selected.');
        return;
      }
      const data = await importFromUri(uri);
      parseBackup(JSON.stringify(data)); // re-validate
      Alert.alert(
        'Import backup?',
        `${data.playthroughs.length} journeys, ${data.messages.length} messages. CURRENT device data will be REPLACED. API keys must be re-entered afterwards.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import & Replace',
            style: 'destructive',
            onPress: () =>
              void (async () => {
                try {
                  // Wipe old provider keys — imported config has no keys.
                  const old = await listProviders();
                  for (const p of old) await deleteApiKey(p.id);
                  await importBackup(data);
                  await reloadAll();
                  await load();
                  setNote('Import successful! Re-enter API keys in AI Add-ons. 🔑');
                } catch (e) {
                  setNote(e instanceof Error ? e.message : 'Import failed.');
                }
              })(),
          },
        ],
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  }

  async function doClearCache() {
    setBusy('cache');
    try {
      await clearCache();
      await load();
      setNote('Cache cleared. 🧹 Downloads and chats are safe.');
    } finally {
      setBusy(null);
    }
  }

  async function doDeleteDownloads() {
    Alert.alert(
      'Delete all downloaded stories?',
      'Downloaded JSON packages delete honge. Bundled stories aur tumhari chats safe rahengi.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy('dls');
              try {
                for (const id of downloads) await removeDownloadedStory(id);
                await load();
                setNote('Downloads deleted.');
              } finally {
                setBusy(null);
              }
            })(),
        },
      ],
    );
  }

  async function doDeleteChats() {
    Alert.alert(
      'Delete all chats?',
      'Saari journeys, messages aur memories delete hongi. Stories, settings aur providers rahenge.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete chats',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy('chats');
              try {
                const db = await getDb();
                await db.execAsync('DELETE FROM messages; DELETE FROM memories; DELETE FROM playthroughs;');
                await load();
                await reloadAll();
                setNote('All chats deleted.');
              } finally {
                setBusy(null);
              }
            })(),
        },
      ],
    );
  }

  async function doDeleteAll() {
    Alert.alert(
      'Delete EVERYTHING?',
      'Profile, chats, saves, favorites, providers, settings — SAB delete hoga. App fresh start hogi. Ye undo NAHI hoga!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Pakka?!', 'Last chance. Export liya kya?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'YES, wipe it',
                style: 'destructive',
                onPress: () =>
                  void (async () => {
                    setBusy('all');
                    try {
                      const provs = await listProviders();
                      for (const p of provs) await deleteApiKey(p.id);
                      await clearAllUserData();
                      await clearCache();
                      await reloadAll();
                      setNote('All local data deleted. Restart the app for a fresh start. 👋');
                    } finally {
                      setBusy(null);
                      await load();
                    }
                  })(),
              },
            ]),
        },
      ],
    );
  }

  if (!usage) {
    return (
      <Screen>
        <LoadingState label="Measuring storage…" />
      </Screen>
    );
  }

  const downloadedMetas = stories.filter((s) => downloads.has(s.id));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>Storage & Data</Text>

        <SectionHeader title="Usage (on this device)" />
        <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <UsageRow label="Downloaded stories" value={`${usage.downloadedStories} (${formatBytes(usage.contentBytes)})`} />
          <UsageRow label="Journeys" value={`${usage.dbPlaythroughs}`} />
          <UsageRow label="Messages" value={`${usage.dbMessages}`} />
          <UsageRow label="Memories" value={`${usage.dbMemories}`} />
        </View>

        <SectionHeader title="Backup" />
        <View style={styles.gap}>
          <GradientButton title="📤 Export My Data" loading={busy === 'export'} onPress={() => void doExport()} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="📥 Import My Data" variant="ghost" loading={busy === 'import'} onPress={() => void doImport()} />
        </View>
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          Backup mein API keys NAHI hoti — import ke baad keys dobara daalo.
        </Text>

        {note ? (
          <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.noteText, { color: theme.text }]}>{note}</Text>
          </View>
        ) : null}

        <SectionHeader title="Cleanup" />
        <View style={styles.gap}>
          <GradientButton title="🧹 Clear cache" variant="ghost" loading={busy === 'cache'} onPress={() => void doClearCache()} />
        </View>
        {downloadedMetas.length > 0 ? (
          <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 12 }]}>
            <Text style={[styles.boxTitle, { color: theme.text }]}>Downloaded stories</Text>
            {downloadedMetas.map((s) => (
              <View key={s.id} style={styles.dlRow}>
                <Text style={[styles.dlName, { color: theme.textDim }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <GradientButton
                  title="Delete"
                  variant="ghost"
                  onPress={() =>
                    void (async () => {
                      await removeDownloadedStory(s.id);
                      await load();
                    })()
                  }
                />
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.gap}>
          <GradientButton
            title={`Delete all downloads${usage.downloadedStories ? ` (${usage.downloadedStories})` : ''}`}
            variant="ghost"
            loading={busy === 'dls'}
            onPress={() => void doDeleteDownloads()}
          />
        </View>
        <View style={styles.gap}>
          <GradientButton title="Delete all chats" variant="ghost" loading={busy === 'chats'} onPress={() => void doDeleteChats()} />
        </View>

        <SectionHeader title="Danger zone" />
        <View style={styles.gap}>
          <GradientButton title="💥 Delete ALL local data" loading={busy === 'all'} onPress={() => void doDeleteAll()} />
        </View>
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.urow}>
      <Text style={[styles.ulabel, { color: theme.textDim }]}>{label}</Text>
      <Text style={[styles.uvalue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  box: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12 },
  boxTitle: { fontSize: FONTS.body, fontWeight: '800', marginBottom: 8 },
  urow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  ulabel: { fontSize: FONTS.small },
  uvalue: { fontSize: FONTS.small, fontWeight: '700' },
  gap: { marginTop: 10 },
  hint: { fontSize: FONTS.tiny, marginTop: 8 },
  note: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 12 },
  noteText: { fontSize: FONTS.small, lineHeight: 20 },
  dlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  dlName: { fontSize: FONTS.small, flex: 1 },
});
