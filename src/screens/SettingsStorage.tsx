/**
 * Storage & Data Screen — Export/import backup, clear cache, delete data.
 * Local-first data sovereignty. Kissa v2.4.1.
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
import { clearAllUserData, getDb, listProviders } from '../lib/db';
import { deleteApiKey } from '../lib/secureKeys';
import { clearCache, getStorageUsage, type StorageUsage } from '../lib/storage';
import { exportAndShare, importBackup, importFromUri, pickBackupFile } from '../lib/backup';
import { downloadedStoryIds, removeDownloadedStory } from '../content/loader';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
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

  async function onExport() {
    setBusy('export');
    setNote(null);
    try {
      const res = await exportAndShare();
      setNote(
        res.shared
          ? 'Backup created and shared successfully.'
          : `Backup saved locally at: ${res.fileUri}`,
      );
    } catch (e) {
      Alert.alert('Export Error', e instanceof Error ? e.message : 'Could not export backup.');
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    setNote(null);
    try {
      const uri = await pickBackupFile();
      if (!uri) return;
      setBusy('import');
      const data = await importFromUri(uri);
      Alert.alert(
        'Restore Backup?',
        `${data.playthroughs.length} journeys, ${data.messages.length} messages found. Current on-device data will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore & Replace',
            style: 'destructive',
            onPress: () =>
              void (async () => {
                try {
                  const old = await listProviders();
                  for (const p of old) await deleteApiKey(p.id);
                  await importBackup(data);
                  await reloadAll();
                  await load();
                  setNote('Backup restored successfully! Re-enter your AI keys in AI Add-ons.');
                } catch (e) {
                  Alert.alert('Import Error', e instanceof Error ? e.message : 'Invalid backup file.');
                } finally {
                  setBusy(null);
                }
              })(),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import Error', e instanceof Error ? e.message : 'Could not read backup file.');
      setBusy(null);
    }
  }

  async function onClearCache() {
    Alert.alert('Clear Image Cache?', 'Cached story covers and gallery previews will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Cache',
        onPress: () =>
          void (async () => {
            setBusy('cache');
            try {
              await clearCache();
              await load();
              setNote('Cache cleared.');
            } finally {
              setBusy(null);
            }
          })(),
      },
    ]);
  }

  async function onDeleteDownloads() {
    Alert.alert(
      'Delete Downloaded Stories?',
      'Downloaded offline packages will be deleted. Your chat messages and profile remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Downloads',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy('dls');
              try {
                for (const id of downloads) await removeDownloadedStory(id);
                await load();
                setNote('Downloaded stories removed.');
              } finally {
                setBusy(null);
              }
            })(),
        },
      ],
    );
  }

  async function onDeleteChats() {
    Alert.alert(
      'Delete All Chats & Journeys?',
      'All message history and journeys will be cleared. Settings and API providers will remain untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Chats',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy('chats');
              try {
                const db = await getDb();
                await db.execAsync('DELETE FROM messages; DELETE FROM memories; DELETE FROM playthroughs;');
                await load();
                await reloadAll();
                setNote('All chat messages deleted.');
              } finally {
                setBusy(null);
              }
            })(),
        },
      ],
    );
  }

  async function onClearAll() {
    Alert.alert(
      'Reset All Data?',
      'This will permanently delete your local profile, all journeys, and saved AI keys from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
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
                await load();
                setNote('All local data wiped. App reset to fresh state.');
              } finally {
                setBusy(null);
              }
            })(),
        },
      ],
    );
  }

  if (!usage) {
    return (
      <Screen>
        <LoadingState label="Calculating storage…" />
      </Screen>
    );
  }

  const downloadedMetas = stories.filter((s) => downloads.has(s.id));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>LOCAL DATA</Text>
          <Text style={[styles.title, { color: theme.text }]}>Storage & Backup</Text>
        </View>

        <View
          style={[
            styles.usageCard,
            { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
            SHADOWS.card,
          ]}
        >
          <Text style={[styles.usageTotal, { color: theme.text }]}>
            {formatBytes(usage.contentBytes)}
          </Text>
          <Text style={[styles.usageSub, { color: theme.textDim }]}>Downloaded story packages & cache</Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.usageRow}>
            <Text style={[styles.usageLabel, { color: theme.textDim }]}>Downloaded Stories</Text>
            <Text style={[styles.usageVal, { color: theme.text }]}>{usage.downloadedStories}</Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={[styles.usageLabel, { color: theme.textDim }]}>Journeys / Playthroughs</Text>
            <Text style={[styles.usageVal, { color: theme.text }]}>{usage.dbPlaythroughs}</Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={[styles.usageLabel, { color: theme.textDim }]}>Saved Messages</Text>
            <Text style={[styles.usageVal, { color: theme.text }]}>{usage.dbMessages}</Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={[styles.usageLabel, { color: theme.textDim }]}>Story Memories</Text>
            <Text style={[styles.usageVal, { color: theme.text }]}>{usage.dbMemories}</Text>
          </View>
        </View>

        {note ? <Text style={[styles.note, { color: theme.success }]}>{note}</Text> : null}

        <SectionHeader title="Backup & Migration" kicker="Data Portability" />
        <View style={styles.gap}>
          <GradientButton title="Export Encrypted Backup" variant="ghost" loading={busy === 'export'} onPress={onExport} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="Import Backup File" variant="ghost" loading={busy === 'import'} onPress={onImport} />
        </View>
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          API keys are never exported — re-enter them in AI Add-ons after restoring.
        </Text>

        <SectionHeader title="Storage Maintenance" kicker="Cleanup" />
        <View style={styles.gap}>
          <GradientButton title="Clear Image Cache" variant="ghost" loading={busy === 'cache'} onPress={onClearCache} />
        </View>
        {downloadedMetas.length > 0 ? (
          <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 12 }]}>
            <Text style={[styles.boxTitle, { color: theme.text }]}>Downloaded Stories</Text>
            {downloadedMetas.map((s) => (
              <View key={s.id} style={styles.dlRow}>
                <Text style={[styles.dlName, { color: theme.textDim }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <GradientButton
                  title="Remove"
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
            title={`Delete Downloaded Packages (${usage.downloadedStories})`}
            variant="ghost"
            loading={busy === 'dls'}
            onPress={onDeleteDownloads}
          />
        </View>
        <View style={styles.gap}>
          <GradientButton title="Delete Chat Messages" variant="ghost" loading={busy === 'chats'} onPress={onDeleteChats} />
        </View>

        <SectionHeader title="Danger Zone" kicker="Reset" />
        <View style={styles.gap}>
          <GradientButton title="Erase All Local Data" loading={busy === 'all'} onPress={onClearAll} />
        </View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  usageCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginTop: 12,
  },
  usageTotal: { ...TYPE.display, letterSpacing: -0.5 },
  usageSub: { fontSize: 13, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  usageLabel: { fontSize: FONTS.small },
  usageVal: { fontSize: FONTS.small, fontWeight: '700' },
  hint: { fontSize: FONTS.tiny, marginTop: 8, lineHeight: 16 },
  note: { fontSize: FONTS.small, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  box: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12 },
  boxTitle: { fontSize: FONTS.body, fontWeight: '800', marginBottom: 8 },
  dlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  dlName: { fontSize: FONTS.small, flex: 1 },
  gap: { marginTop: 10 },
});
