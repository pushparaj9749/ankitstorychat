/**
 * Saves Screen — Manage journeys per story.
 * Replay, resume, delete. Memory UI removed (internal only).
 * Kissa v2.4.1.
 */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ProgressBar, SectionHeader } from '../components/bits';
import { EmptyState, LoadingState } from '../components/states';
import { deletePlaythrough, listPlaythroughsForStory } from '../lib/db';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Saves'>;

export function Saves({ navigation, route }: Props) {
  const { theme, stories, refreshRecent } = useApp();
  const [saves, setSaves] = useState<Playthrough[] | null>(null);

  const storyId = route.params.storyId;
  const meta = stories.find((s) => s.id === storyId);

  async function load() {
    setSaves(await listPlaythroughsForStory(storyId));
  }

  useEffect(() => {
    void load();
    const unsub = navigation.addListener('focus', () => void load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  function confirmDelete(p: Playthrough) {
    Alert.alert(
      'Delete journey?',
      `"${p.label}" will be permanently removed from this device.`,
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

  if (saves === null) {
    return (
      <Screen>
        <LoadingState label="Loading journeys…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>JOURNEY ARCHIVE</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {meta?.title ?? 'Saved Journeys'}
        </Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Every branch, choice, and ending is saved locally on your device.
        </Text>
      </View>

      <SectionHeader title="Your Journeys" kicker={`${saves.length} saved`} />

      {saves.length === 0 ? (
        <EmptyState
          emoji="📖"
          title="No journeys yet"
          subtitle="Start playing this story to create your first journey."
          action="Back to Story"
          onAction={() => navigation.goBack()}
        />
      ) : (
        <FlatList
          data={saves}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: p }) => {
            const completed = p.status === 'completed';
            return (
              <Pressable
                onPress={() => {
                  lightBuzz();
                  navigation.navigate('Chat', { playthroughId: p.id });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}, ${completed ? 'completed' : 'in progress'}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: withAlpha(theme.surface, pressed ? 0.95 : 0.88),
                    borderColor: theme.border,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                  SHADOWS.card,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.label, { color: theme.text }]}>{p.label}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: completed ? withAlpha(theme.success, 0.16) : withAlpha(theme.accent, 0.14),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: completed ? theme.success : theme.accent },
                      ]}
                    >
                      {completed ? 'COMPLETED' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.meta, { color: theme.textDim }]}>
                  {p.messageCount} messages • Updated {timeAgo(p.updatedAt)}
                </Text>

                <ProgressBar value={p.progress} color={meta?.accentColor ?? theme.accent} />

                <View style={styles.cardFooter}>
                  <Pressable
                    onPress={() => confirmDelete(p)}
                    hitSlop={8}
                    style={styles.deleteBtn}
                  >
                    <Text style={[styles.deleteText, { color: theme.danger }]}>Delete</Text>
                  </Pressable>

                  <View style={[styles.resumeBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.resumeText}>Resume ›</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  sub: { fontSize: 13, marginTop: 4, letterSpacing: 0.1 },
  list: { paddingBottom: 24, gap: 12, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  meta: { fontSize: 12, letterSpacing: 0.1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
  },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  deleteText: { fontSize: 12, fontWeight: '700' },
  resumeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  resumeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
