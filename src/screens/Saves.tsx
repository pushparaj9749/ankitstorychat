/** Saves: multiple playthroughs per story — resume / replay / delete. */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/bits';
import { EmptyState, LoadingState } from '../components/states';
import { deletePlaythrough, listPlaythroughsForStory } from '../lib/db';
import { FONTS, RADIUS, SPACING } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Saves'>;

export function Saves({ navigation, route }: Props) {
  const { theme, refreshRecent } = useApp();
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
        <LoadingState label="Loading saves…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>Journeys</Text>
      {saves.length === 0 ? (
        <EmptyState emoji="🌱" title="No journeys yet" subtitle="Start a new journey from the story page." />
      ) : (
        <FlatList
          data={saves}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: p }) => (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Pressable
                onPress={() => navigation.navigate('Chat', { playthroughId: p.id })}
                accessibilityRole="button"
                accessibilityLabel={`Resume ${p.label}`}
              >
                <View style={styles.row}>
                  <Text style={[styles.label, { color: theme.text }]}>{p.label}</Text>
                  <Text style={[styles.status, { color: p.status === 'completed' ? theme.success : theme.accent }]}>
                    {p.status === 'completed' ? '✓ Completed' : p.status === 'abandoned' ? 'Paused' : '▶ Active'}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: theme.textDim }]}>
                  🤖 AI • {p.messageCount} msgs • {timeAgo(p.updatedAt)}
                </Text>
                <View style={styles.bar}>
                  <ProgressBar value={p.progress} />
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => navigation.navigate('Chat', { playthroughId: p.id })}
                  style={[styles.btn, { backgroundColor: theme.primarySoft }]}
                >
                  <Text style={[styles.btnText, { color: theme.primary }]}>Resume</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('Memory', { playthroughId: p.id })}
                  style={[styles.btn, { backgroundColor: theme.accentSoft }]}
                >
                  <Text style={[styles.btnText, { color: theme.accent }]}>🧠 Memory</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(p)}
                  style={[styles.btn, { backgroundColor: 'rgba(248,113,113,0.12)' }]}
                >
                  <Text style={[styles.btnText, { color: theme.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  list: { gap: 12, paddingBottom: SPACING.xl },
  card: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FONTS.body, fontWeight: '800' },
  status: { fontSize: FONTS.small, fontWeight: '700' },
  meta: { fontSize: FONTS.small, marginTop: 4 },
  bar: { marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  btnText: { fontWeight: '700', fontSize: FONTS.small },
});
