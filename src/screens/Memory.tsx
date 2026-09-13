/**
 * Memory viewer — "what does the app actually remember about this journey?"
 *
 * Everything the narrator can see is here, in the three layers the engine uses:
 *   1. the rolling digest (compressed past)
 *   2. live facts (curated story facts + the episodic log of each turn)
 *   3. what we remember about YOU, shared across every story
 * Plus the folded rows: facts that were compressed into the digest. They are
 * archived, never deleted — "wapas laao" puts one back into live recall.
 *
 * Deleting here is the reader's escape hatch: a wrong or embarrassing fact can be
 * forgotten without deleting the whole chat.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemoryEntry, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { EmptyState, LoadingState } from '../components/states';
import { deleteMemory, deleteMemoriesForPlaythrough } from '../lib/db';
import {
  clearSummary,
  journeyMemoryView,
  pinMemory,
  restoreMemory,
  type JourneyMemoryView,
} from '../lib/memory';
import { FONTS, RADIUS, SPACING } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

const KIND_LABEL: Record<string, string> = {
  story: '📘 kahani',
  character: '🎭 character',
  world: '🌍 duniya',
  preference: '🙋 tum',
  episode: '🧾 turn log',
  summary: '📦 digest',
};

export function Memory({ navigation, route }: Props) {
  const { playthroughId, storyTitle } = route.params;
  const { theme } = useApp();
  const [view, setView] = useState<JourneyMemoryView | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showFolded, setShowFolded] = useState(false);

  const load = useCallback(async () => {
    setView(await journeyMemoryView(playthroughId));
  }, [playthroughId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function forget(m: MemoryEntry) {
    Alert.alert('Ye bhool jao?', 'Narrator ko ye fact dobara yaad nahi hoga.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await deleteMemory(m.id);
            await load();
          })(),
      },
    ]);
  }

  function forgetAll() {
    Alert.alert(
      'Poori journey ki memory bhool jao?',
      'Saare facts aur digest delete ho jayenge. Chat aur progress safe rahenge — narrator bas story ka past bhool jayega.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget everything',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              await deleteMemoriesForPlaythrough(playthroughId);
              await clearSummary(playthroughId);
              await load();
            })(),
        },
      ],
    );
  }

  if (!view) {
    return (
      <Screen>
        <LoadingState label="Yaad kar raha hoon…" />
      </Screen>
    );
  }

  const facts = view.live.filter((m) => m.kind !== 'episode');
  const log = view.live.filter((m) => m.kind === 'episode');
  const visibleLog = showLog ? log : log.slice(0, 8);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>🧠 Kya yaad hai</Text>
        {storyTitle ? (
          <Text style={[styles.sub, { color: theme.textDim }]}>{storyTitle}</Text>
        ) : null}

        <SectionHeader title="Story so far (compressed)" />
        <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {view.summary ? (
            <Text style={[styles.digest, { color: theme.textDim }]}>{view.summary}</Text>
          ) : (
            <Text style={[styles.hint, { color: theme.textFaint }]}>
              Abhi tak kuch fold nahi hua — har 8 turn ke baad purani baatein isi digest me samat hoti
              hain, taaki shuru ki kahani bhi yaad rahe.
            </Text>
          )}
          {view.summary ? (
            <Pressable onPress={() => void (async () => { await clearSummary(playthroughId); await load(); })()}>
              <Text style={[styles.link, { color: theme.accent }]}>Digest clear karo</Text>
            </Pressable>
          ) : null}
        </View>

        <SectionHeader title={`Yaad hai (${facts.length})`} />
        {facts.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textFaint }]}>
            Koi curated fact nahi — chat karo, narrator khud important baatein yahan likhega.
          </Text>
        ) : null}
        {facts.map((m) => (
          <MemoryRow key={m.id} m={m} onForget={() => void forget(m)} onPin={() => void pinMemory(m.id).then(load)} />
        ))}

        <SectionHeader title={`Turn log (${log.length})`} />
        {visibleLog.map((m) => (
          <MemoryRow key={m.id} m={m} dim onForget={() => void forget(m)} onPin={() => void pinMemory(m.id).then(load)} />
        ))}
        {log.length > 8 ? (
          <Pressable onPress={() => setShowLog((v) => !v)}>
            <Text style={[styles.link, { color: theme.accent }]}>
              {showLog ? 'Kam dikhao' : `${log.length - 8} aur purani lines dikhao`}
            </Text>
          </Pressable>
        ) : null}

        {view.readerPrefs.length ? (
          <>
            <SectionHeader title="Tumhare baare me (har story me yaad rahega)" />
            {view.readerPrefs.map((m) => (
              <MemoryRow key={m.id} m={m} onForget={() => void forget(m)} onPin={() => void pinMemory(m.id).then(load)} />
            ))}
          </>
        ) : null}

        {view.folded.length ? (
          <>
            <SectionHeader title={`Digest me fold hue (${view.folded.length})`} />
            <Text style={[styles.hint, { color: theme.textFaint }]}>
              Ye delete nahi hue — bas prompt me dobara nahi bheje jaate. "Wapas laao" se fir se live ho
              jayenge.
            </Text>
            {(showFolded ? view.folded : view.folded.slice(0, 5)).map((m) => (
              <MemoryRow
                key={m.id}
                m={m}
                dim
                onForget={() => void forget(m)}
                onRestore={() => void restoreMemory(m.id).then(load)}
              />
            ))}
            {view.folded.length > 5 ? (
              <Pressable onPress={() => setShowFolded((v) => !v)}>
                <Text style={[styles.link, { color: theme.accent }]}>
                  {showFolded ? 'Kam dikhao' : `${view.folded.length - 5} aur dikhao`}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {facts.length + log.length > 0 ? (
          <View style={styles.gap}>
            <GradientButton title="🗑 Poori journey ki memory bhool jao" variant="ghost" onPress={forgetAll} />
          </View>
        ) : null}
        <Text style={[styles.note, { color: theme.textFaint }]}>
          Sab kuch sirf is phone me hai — koi server nahi. Story delete karoge to ye bhi chala jayega.
        </Text>
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function MemoryRow({
  m,
  dim,
  onForget,
  onPin,
  onRestore,
}: {
  m: MemoryEntry;
  dim?: boolean;
  onForget: () => void;
  onPin?: () => void;
  onRestore?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border, opacity: dim ? 0.72 : 1 }]}>
      <View style={styles.rowBody}>
        <View style={styles.metaRow}>
          <Text style={[styles.kind, { color: theme.accent }]}>{KIND_LABEL[m.kind] ?? m.kind}</Text>
          <Text style={[styles.when, { color: theme.textFaint }]}>{timeAgo(m.createdAt)}</Text>
          {m.importance >= 6 ? <Text style={[styles.when, { color: theme.success }]}>★{m.importance}</Text> : null}
          {m.hits ? <Text style={[styles.when, { color: theme.textFaint }]}>· {m.hits}×</Text> : null}
        </View>
        <Text style={[styles.text, { color: theme.text }]}>{m.text}</Text>
      </View>
      <View style={styles.actions}>
        {onRestore ? (
          <Pressable onPress={onRestore} accessibilityLabel="Wapas laao" style={styles.act}>
            <Text style={styles.actText}>↩︎</Text>
          </Pressable>
        ) : null}
        {onPin ? (
          <Pressable onPress={onPin} accessibilityLabel="Yaad rakhna strong karo" style={styles.act}>
            <Text style={styles.actText}>📌</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onForget} accessibilityLabel="Bhool jao" style={styles.act}>
          <Text style={styles.actText}>🗑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 6 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  title: { fontSize: FONTS.display, fontWeight: '900', marginTop: 6 },
  sub: { fontSize: FONTS.small, marginTop: 2 },
  box: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, gap: 10 },
  digest: { fontSize: FONTS.small, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 8,
  },
  rowBody: { flex: 1 },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  kind: { fontSize: FONTS.tiny, fontWeight: '800' },
  when: { fontSize: FONTS.tiny },
  text: { fontSize: FONTS.small, lineHeight: 19, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 4 },
  act: { paddingHorizontal: 6, paddingVertical: 4 },
  actText: { fontSize: 15 },
  link: { fontSize: FONTS.small, fontWeight: '700', marginTop: 4 },
  hint: { fontSize: FONTS.small, lineHeight: 19 },
  gap: { marginTop: 16 },
  note: { fontSize: FONTS.tiny, marginTop: 14, lineHeight: 16 },
});
