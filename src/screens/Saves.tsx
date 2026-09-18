/** Saves: multiple playthroughs per story — resume / replay / delete. Cinematic premium. */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/bits';
import { EmptyState, LoadingState } from '../components/states';
import { deletePlaythrough, listPlaythroughsForStory } from '../lib/db';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Saves'>;

export function Saves({ navigation, route }: Props) {
  const { theme } = useApp();
  const { refreshRecent } = useApp();
  const [saves, setSaves] = useState<Playthrough[] | null>(null);

  async function load() {
    setSaves(await listPlaythroughsForStory(route.params.storyId));
  }
  useEffect(() => {
    void load();
    const unsub = navigation.addListener('focus', () => void load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.storyId]);

  function confirmDelete(p: Playthrough) {
    Alert.alert(
      'Delete journey?',
      `"${p.label}" ki saari chat, memory aur progress delete ho jayegi. Ye undo nahi hoga.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              await deletePlaythrough(p.id);
              await refreshRecent();
              await load();
            })(),
        },
      ],
    );
  }

  if (!saves) {
    return (
      <Screen>
        <LoadingState label="Loading journeys…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={[styles.kicker, { color: theme.accent }]}>YOUR STORY</Text>
        <Text style={[styles.title, { color: theme.text }]}>Journeys</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          {saves.length === 0 ? 'No journeys yet — start fresh from the story.' : `${saves.length} ${saves.length === 1 ? 'journey' : 'journeys'} • all on this device`}
        </Text>
      </View>

      {saves.length === 0 ? (
        <EmptyState emoji="🌱" title="No journeys yet" subtitle="Start a new journey from the story page — your world state and memories live here." />
      ) : (
        <FlatList
          data={saves}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: p }) => {
            const isCompleted = p.status === 'completed';
            const isActive = p.status === 'active';
            const statusLabel = isCompleted ? '✓ Completed' : p.status === 'abandoned' ? 'Paused' : '▶ Active';
            const statusColor = isCompleted ? theme.success : isActive ? theme.accent : theme.textDim;
            const progressPct = Math.round((p.progress ?? 0) * 100);
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: withAlpha(theme.surface, 0.96),
                    borderColor: withAlpha(theme.border, 0.9),
                  },
                ]}
              >
                {/* Glow rail for active */}
                {isActive ? <View style={[styles.glow, { backgroundColor: withAlpha(theme.accent, 0.12) }]} /> : null}

                <Pressable
                  onPress={() => navigation.navigate('Chat', { playthroughId: p.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Resume ${p.label}`}
                  style={styles.cardPress}
                >
                  <View style={styles.row}>
                    <View style={styles.labelWrap}>
                      <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={[styles.meta, { color: theme.textDim }]} numberOfLines={1}>
                        🤖 AI • {p.messageCount} msgs • {timeAgo(p.updatedAt)} {progressPct > 0 ? `• ${progressPct}%` : ''}
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: withAlpha(statusColor, 0.12), borderColor: withAlpha(statusColor, 0.18) }]}>
                      <Text style={[styles.chipText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.bar}>
                    <ProgressBar value={p.progress} />
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => navigation.navigate('Chat', { playthroughId: p.id })}
                    style={[styles.btnPrimary, { backgroundColor: theme.primary, borderColor: withAlpha(theme.primary, 0.28) }]}
                  >
                    <Text style={[styles.btnPrimaryText, { color: '#FFF8F0' }]}>{isCompleted ? '↺ Replay' : 'Resume'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(p)}
                    style={[styles.btnGhost, { backgroundColor: withAlpha(theme.surface2, 0.92), borderColor: withAlpha(theme.border, 0.9) }]}
                  >
                    <Text style={[styles.btnGhostText, { color: theme.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: 8, paddingBottom: 14, gap: 4 },
  kicker: { ...TYPE.overline, letterSpacing: 1.8 },
  title: { ...TYPE.displaySmall, marginTop: 2 },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 6, letterSpacing: 0.1, opacity: 0.92 },
  list: { gap: 14, paddingBottom: SPACING.xxl + 12 },
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.9 },
  cardPress: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  labelWrap: { flex: 1, gap: 4 },
  label: { ...TYPE.subheading, letterSpacing: -0.2 },
  meta: { fontSize: FONTS.small, lineHeight: 16, letterSpacing: 0.1 },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  bar: { marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnPrimary: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: 'center', borderWidth: 1, ...SHADOWS.card },
  btnPrimaryText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: 'center', borderWidth: 1 },
  btnGhostText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
});
