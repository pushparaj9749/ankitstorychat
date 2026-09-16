/**
 * Content Updates: check GitHub manifest, download new/updated stories.
 * No app rebuild needed — stories arrive as JSON packages.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { EmptyState } from '../components/states';
import { WideCard } from '../components/StoryCard';
import {
  checkForUpdates,
  downloadStory,
  effectiveContentApiBaseUrl,
  removeDownloadedStory,
  downloadedStoryIds,
} from '../content/loader';
import { notifyContentUpdate, notifyDownloadDone } from '../lib/notifications';
import { FONTS, RADIUS, SPACING } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'ContentUpdates'>;

export function ContentUpdates(_props: Props) {
  const {
    theme,
    profile,
    settings,
    updateSettings,
    refreshStories,
    setUpdateAvailable,
  } = useApp();
  const [checking, setChecking] = useState(false);
  const [fresh, setFresh] = useState<StoryMeta[]>([]);
  const [updated, setUpdated] = useState<StoryMeta[]>([]);
  const [remoteVersion, setRemoteVersion] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    void downloadedStoryIds().then(setDownloaded);
  }, []);

  // Check once when the screen opens: arriving here and seeing an empty list is
  // indistinguishable from "no new stories", so users concluded there was no
  // way to download the OTA ones.
  const autoChecked = React.useRef(false);
  React.useEffect(() => {
    if (autoChecked.current) return;
    autoChecked.current = true;
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check() {
    if (!profile || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const base = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
      const res = await checkForUpdates(base, profile.ageGroup);
      setFresh(res.newStories);
      setUpdated(res.updatedStories);
      setRemoteVersion(res.remoteContentVersion);
      await updateSettings({
        installedContentVersion: Math.max(settings.installedContentVersion, res.remoteContentVersion),
        lastContentCheckAt: new Date().toISOString(),
      });
      setUpdateAvailable(res.hasUpdate);
      if (res.hasUpdate && settings.notifications.enabled && settings.notifications.contentUpdates) {
        await notifyContentUpdate(res.newStories.length + res.updatedStories.length);
      }
      setMessage(
        res.hasUpdate
          ? `${res.newStories.length + res.updatedStories.length} update(s) mili!`
          : 'Sab kuch up-to-date hai. ✅',
      );
      await refreshStories();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Check failed. Internet dekho.');
    } finally {
      setChecking(false);
    }
  }

  async function download(meta: StoryMeta) {
    if (!profile || downloading) return;
    setDownloading(meta.id);
    try {
      const base = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
      await downloadStory(meta, base, profile.ageGroup);
      setDownloaded((prev) => new Set(prev).add(meta.id));
      setFresh((prev) => prev.filter((s) => s.id !== meta.id));
      setUpdated((prev) => prev.filter((s) => s.id !== meta.id));
      if (settings.notifications.enabled && settings.notifications.contentUpdates) {
        await notifyDownloadDone(meta.title);
      }
      await refreshStories();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  async function removeDl(meta: StoryMeta) {
    await removeDownloadedStory(meta.id);
    setDownloaded((prev) => {
      const n = new Set(prev);
      n.delete(meta.id);
      return n;
    });
    await refreshStories();
  }

  const items = [...fresh.map((m) => ({ m, tag: 'NEW' as const })), ...updated.map((m) => ({ m, tag: 'UPDATE' as const }))];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>📚 Content Updates</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Nayi stories Kissa story API se aati hain — app update ki zaroorat nahi. Last check:{' '}
          {settings.lastContentCheckAt ? timeAgo(settings.lastContentCheckAt) : 'kabhi nahi'}
          {remoteVersion !== null ? ` • v${remoteVersion}` : ''}
        </Text>
        <View style={styles.gap}>
          <GradientButton title="Check for new stories" loading={checking} onPress={() => void check()} />
        </View>
        {message ? (
          <View style={[styles.msg, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.msgText, { color: theme.text }]}>{message}</Text>
          </View>
        ) : null}

        {items.length === 0 && !checking ? (
          <EmptyState emoji="✨" title="Nothing pending" subtitle="Check dabao — nayi kahaniyan yahan dikhengi." />
        ) : null}

        {items.length > 0 ? <SectionHeader title="Available" /> : null}
        {items.map(({ m, tag }) => (
          <View key={m.id} style={styles.item}>
            <WideCard meta={m} onPress={() => void (downloaded.has(m.id) ? removeDl(m) : download(m))} />
            <View style={[styles.tag, { backgroundColor: theme.accent }]}>
              <Text style={styles.tagText}>{tag} • v{m.version}</Text>
            </View>
            <View style={styles.gap}>
              {downloaded.has(m.id) ? (
                <GradientButton title="Downloaded ✓ — Remove" variant="ghost" onPress={() => void removeDl(m)} />
              ) : (
                <GradientButton
                  title={`⬇ Download "${m.title}"`}
                  loading={downloading === m.id}
                  onPress={() => void download(m)}
                />
              )}
            </View>
          </View>
        ))}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  sub: { fontSize: FONTS.small, marginTop: 6, lineHeight: 20 },
  gap: { marginTop: 12 },
  msg: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 12 },
  msgText: { fontSize: FONTS.small },
  item: { marginBottom: 16 },
  tag: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: '#1A0B2E', fontSize: 10, fontWeight: '900' },
});
