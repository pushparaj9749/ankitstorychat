/**
 * KISSA v2.7 — Yaadein: what the story remembers about THIS journey.
 *
 *   Summary    stage 1 — the running digest (editable)
 *   Recent     live facts the narrator keeps (pin / edit / delete, add your own)
 *   Key facts  stage 3 ledger — where you are, who is here, objects and their
 *              owners, bonds, open threads, your preferences
 *   Chapters   closed chapter summaries
 *
 * Spoiler-safe by design: the author's seed notes and every character's
 * private knowledge (who knows which secret) are NEVER shown here — only what
 * has actually happened in the reader's own story.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MemoryEntry, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { Icon, type IconName } from '../components/icons';
import { LoadingState } from '../components/states';
import {
  addReaderMemory,
  deleteMemory,
  editMemory,
  isReaderVisibleMemory,
  journeyMemoryView,
  pinMemory,
  restoreMemory,
  setSummary,
  unpinMemory,
  type JourneyMemoryView,
} from '../lib/memory';
import { getChapters, type Chapter } from '../lib/chapters';
import { getWorldState, type WorldState } from '../lib/worldState';
import { sanitizeStoredText } from '../lib/leakGuard';
import { timeAgo } from '../lib/utils';
import { RADIUS, SCALE, SPACING, withAlpha } from '../theme';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Yaadein'>;
type Tab = 'summary' | 'recent' | 'facts' | 'chapters';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'recent', label: 'Recent' },
  { id: 'facts', label: 'Key facts' },
  { id: 'chapters', label: 'Chapters' },
];

const PINNED = 9;

/** Reader-facing text: strip any leaked note markup an old version may have stored. */
const clean = (t: string) => sanitizeStoredText(t) || t;

export function Yaadein({ navigation, route }: Props) {
  const { playthroughId } = route.params;
  const { theme, profile } = useApp();
  const [tab, setTab] = useState<Tab>('recent');
  const [view, setView] = useState<JourneyMemoryView | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [ws, setWs] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [v, ch, w] = await Promise.all([
      journeyMemoryView(playthroughId).catch(() => null),
      getChapters(playthroughId).catch(() => []),
      getWorldState(playthroughId).catch(() => null),
    ]);
    setView(v);
    setChapters(ch);
    setWs(w);
    setLoading(false);
  }, [playthroughId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const live = useMemo(
    () =>
      (view?.live ?? [])
        .filter(isReaderVisibleMemory)
        .sort((a, b) => (b.importance >= PINNED ? 1 : 0) - (a.importance >= PINNED ? 1 : 0) || b.createdAt.localeCompare(a.createdAt)),
    [view],
  );
  const folded = useMemo(() => (view?.folded ?? []).filter(isReaderVisibleMemory), [view]);

  return (
    <Screen padded={false}>
      {/* header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="chevron-back" size={20} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Yaadein</Text>
          <Text style={[styles.sub, { color: theme.textFaint }]}>Kahani ko is journey ke baare mein kya yaad hai</Text>
        </View>
      </View>

      {/* tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                lightBuzz();
                setTab(t.id);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { backgroundColor: theme.surface3 }]}
            >
              <Text style={[styles.tabText, { color: on ? theme.text : theme.textFaint }, on && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <LoadingState label="Yaadein khul rahi hain…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab === 'summary' ? <SummaryTab playthroughId={playthroughId} summary={view?.summary ?? ''} onSaved={reload} /> : null}
          {tab === 'recent' ? (
            <RecentTab playthroughId={playthroughId} live={live} folded={folded} onChange={reload} />
          ) : null}
          {tab === 'facts' ? <FactsTab ws={ws} prefs={view?.readerPrefs ?? []} playerName={profile?.nickname ?? 'Tum'} /> : null}
          {tab === 'chapters' ? <ChaptersTab chapters={chapters} /> : null}

          <View style={[styles.note, { borderColor: theme.borderSoft }]}>
            <Icon name="lock-closed-outline" size={13} color={theme.textFaint} />
            <Text style={[styles.noteText, { color: theme.textFaint }]}>
              Story ke raaz aur characters ki chhupi baatein yahan nahi dikhti — taaki spoiler na ho.
            </Text>
          </View>
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ parts */

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { theme } = useApp();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

function Heading({ icon, title, count }: { icon: IconName; title: string; count?: number }) {
  const { theme } = useApp();
  return (
    <View style={styles.heading}>
      <Icon name={icon} size={15} color={theme.textDim} />
      <Text style={[styles.headingText, { color: theme.text }]}>{title}</Text>
      {count !== undefined ? <Text style={[styles.headingCount, { color: theme.textFaint }]}>{count}</Text> : null}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { theme } = useApp();
  return <Text style={[styles.empty, { color: theme.textFaint }]}>{text}</Text>;
}

function SmallButton({ label, icon, onPress, tone }: { label: string; icon: IconName; onPress: () => void; tone?: 'danger' | 'accent' }) {
  const { theme } = useApp();
  const color = tone === 'danger' ? theme.danger : tone === 'accent' ? theme.primary : theme.textDim;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.smallBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={13} color={color} />
      <Text style={[styles.smallBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Summary */

function SummaryTab({ playthroughId, summary, onSaved }: { playthroughId: string; summary: string; onSaved: () => void }) {
  const { theme } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary);
  useEffect(() => setDraft(summary), [summary]);

  return (
    <>
      <Heading icon="document-text-outline" title="Ab tak ki kahani" />
      <Card>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            style={[styles.input, styles.inputTall, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bgSoft }]}
            placeholder="Kahani ka summary…"
            placeholderTextColor={theme.textFaint}
          />
        ) : summary ? (
          <Text style={[styles.summary, { color: theme.textDim }]}>{clean(summary)}</Text>
        ) : (
          <Empty text="Abhi summary nahi bani. Kahani aage badhne par purani baatein yahan apne aap jud jayengi." />
        )}
        <View style={styles.actions}>
          {editing ? (
            <>
              <SmallButton label="Cancel" icon="close" onPress={() => { setDraft(summary); setEditing(false); }} />
              <SmallButton
                label="Save"
                icon="checkmark"
                tone="accent"
                onPress={async () => {
                  await setSummary(playthroughId, draft);
                  setEditing(false);
                  onSaved();
                }}
              />
            </>
          ) : (
            <SmallButton label={summary ? 'Edit' : 'Likho'} icon="create-outline" onPress={() => setEditing(true)} />
          )}
        </View>
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------- Recent */

function RecentTab({
  playthroughId,
  live,
  folded,
  onChange,
}: {
  playthroughId: string;
  live: MemoryEntry[];
  folded: MemoryEntry[];
  onChange: () => void;
}) {
  const { theme } = useApp();
  const [adding, setAdding] = useState('');
  const [showFolded, setShowFolded] = useState(false);

  return (
    <>
      <Heading icon="add" title="Khud se yaad jodo" />
      <Card>
        <TextInput
          value={adding}
          onChangeText={setAdding}
          placeholder="Jaise: Mahi ko gulab pasand nahi, use mogra pasand hai"
          placeholderTextColor={theme.textFaint}
          multiline
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bgSoft }]}
        />
        <View style={styles.actions}>
          <SmallButton
            label="Pakki yaad banao"
            icon="checkmark"
            tone="accent"
            onPress={async () => {
              const t = adding.trim();
              if (t.length < 4) return;
              const res = await addReaderMemory(playthroughId, t);
              if (res === 'skipped') Alert.alert('Save nahi hua', 'Yeh yaad bahut chhoti hai ya private info jaisi lag rahi hai.');
              setAdding('');
              onChange();
            }}
          />
        </View>
      </Card>

      <Heading icon="sparkles-outline" title="Recent yaadein" count={live.length} />
      {live.length === 0 ? <Empty text="Abhi koi yaad nahi. Kahani chalegi toh yahan bharne lagengi." /> : null}
      {live.map((m) => (
        <MemoryRow key={m.id} m={m} onChange={onChange} />
      ))}

      {folded.length > 0 ? (
        <>
          <Pressable onPress={() => setShowFolded((v) => !v)} style={styles.foldToggle} accessibilityRole="button">
            <Text style={[styles.foldText, { color: theme.textDim }]}>
              {folded.length} purani yaadein summary mein jud chuki hain
            </Text>
            <Icon name={showFolded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textDim} />
          </Pressable>
          {showFolded
            ? folded.map((m) => (
                <Card key={m.id} style={{ opacity: 0.75 }}>
                  <Text style={[styles.memText, { color: theme.textDim }]}>{clean(m.text)}</Text>
                  <View style={styles.actions}>
                    <SmallButton label="Wapas lao" icon="refresh-outline" onPress={async () => { await restoreMemory(m.id); onChange(); }} />
                  </View>
                </Card>
              ))
            : null}
        </>
      ) : null}
    </>
  );
}

const KIND_LABEL: Record<string, string> = {
  story: 'Kahani',
  character: 'Character',
  world: 'Duniya',
  preference: 'Pasand',
  episode: 'Pal',
  summary: 'Summary',
};

function MemoryRow({ m, onChange }: { m: MemoryEntry; onChange: () => void }) {
  const { theme } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const pinned = m.importance >= PINNED;

  return (
    <Card style={pinned ? { borderColor: withAlpha(theme.primary, 0.4) } : undefined}>
      <View style={styles.memMeta}>
        {pinned ? (
          <View style={[styles.pinTag, { backgroundColor: theme.primarySoft }]}>
            <Icon name="star" size={10} color={theme.primary} />
            <Text style={[styles.pinTagText, { color: theme.primary }]}>Pakki</Text>
          </View>
        ) : null}
        <Text style={[styles.memMetaText, { color: theme.textFaint }]}>
          {KIND_LABEL[m.kind] ?? m.kind}
          {m.source === 'manual' ? ' · tumne joda' : ''} · {timeAgo(m.createdAt)}
        </Text>
      </View>
      {editing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bgSoft }]}
        />
      ) : (
        <Text style={[styles.memText, { color: theme.text }]}>{clean(m.text)}</Text>
      )}
      <View style={styles.actions}>
        {editing ? (
          <>
            <SmallButton label="Cancel" icon="close" onPress={() => { setDraft(m.text); setEditing(false); }} />
            <SmallButton
              label="Save"
              icon="checkmark"
              tone="accent"
              onPress={async () => {
                await editMemory(m.id, draft);
                setEditing(false);
                onChange();
              }}
            />
          </>
        ) : (
          <>
            <SmallButton
              label={pinned ? 'Unpin' : 'Pin'}
              icon={pinned ? 'star' : 'star-outline'}
              tone={pinned ? 'accent' : undefined}
              onPress={async () => {
                lightBuzz();
                await (pinned ? unpinMemory(m.id) : pinMemory(m.id));
                onChange();
              }}
            />
            <SmallButton label="Edit" icon="create-outline" onPress={() => setEditing(true)} />
            <SmallButton
              label="Delete"
              icon="trash-outline"
              tone="danger"
              onPress={() =>
                Alert.alert('Yaad hata dein?', 'Kahani ise phir yaad nahi rakhegi.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteMemory(m.id);
                      onChange();
                    },
                  },
                ])
              }
            />
          </>
        )}
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------- Key facts */

const TIME_LABEL: Record<string, string> = {
  dawn: 'Subah-subah',
  morning: 'Subah',
  afternoon: 'Dopahar',
  evening: 'Shaam',
  night: 'Raat',
  'late-night': 'Der raat',
};

function FactsTab({ ws, prefs, playerName }: { ws: WorldState | null; prefs: MemoryEntry[]; playerName: string }) {
  const { theme } = useApp();
  if (!ws) return <Empty text="Kahani shuru hone ke baad yahan pakki baatein dikhengi." />;

  const nameOf = (id: string | null | undefined) => {
    if (!id) return '—';
    if (id === 'player' || id === 'user') return playerName || 'Tum';
    return ws.characterStates?.[id]?.name ?? id;
  };
  const present = (ws.presentCharacters ?? []).map(nameOf);
  const objects = Object.values(ws.importantObjects ?? {});
  const bonds = Object.entries(ws.relationships ?? {});
  const threads = (ws.unresolvedThreads ?? []).filter((t) => t.status !== 'resolved');
  const when = [TIME_LABEL[ws.storyTime?.timeOfDay ?? ''] ?? null, ws.storyTime?.clockTime ?? null].filter(Boolean).join(', ');

  return (
    <>
      <Heading icon="location-outline" title="Abhi" />
      <Card>
        <FactLine label="Jagah" value={ws.currentLocation ?? '—'} />
        {when ? <FactLine label="Waqt" value={when} /> : null}
        <FactLine label="Saath mein" value={present.length ? present.join(', ') : '—'} />
        {ws.currentActivity ? <FactLine label="Ho raha hai" value={clean(ws.currentActivity)} /> : null}
      </Card>

      <Heading icon="key-outline" title="Cheezein kiske paas" count={objects.length} />
      {objects.length === 0 ? <Empty text="Abhi koi khaas cheez track nahi ho rahi." /> : null}
      {objects.map((o) => {
        const lastMove = o.holderLog?.[o.holderLog.length - 1];
        return (
          <Card key={o.id}>
            <View style={styles.factRow}>
              <Text style={[styles.factName, { color: theme.text }]} numberOfLines={1}>{o.name}</Text>
              <Text style={[styles.factValue, { color: theme.primary }]} numberOfLines={1}>{nameOf(o.holder) !== '—' ? nameOf(o.holder) : o.location ?? '—'}</Text>
            </View>
            {lastMove ? <Text style={[styles.factSub, { color: theme.textFaint }]}>{describeMove(lastMove, nameOf)}</Text> : null}
          </Card>
        );
      })}

      <Heading icon="heart-outline" title="Rishte" count={bonds.length} />
      {bonds.length === 0 ? <Empty text="Rishte kahani ke saath banenge." /> : null}
      {bonds.map(([id, r]) => {
        const bond = Math.round(r.affection * 0.6 + r.trust * 0.4);
        return (
          <Card key={id}>
            <View style={styles.factRow}>
              <Text style={[styles.factName, { color: theme.text }]}>{nameOf(id)}</Text>
              <Text style={[styles.factValue, { color: theme.text }]}>{bond}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: withAlpha(theme.text, 0.08) }]}>
              <View style={[styles.fill, { width: `${bond}%`, backgroundColor: theme.primary }]} />
            </View>
            <Text style={[styles.factSub, { color: theme.textFaint }]}>
              Bharosa {r.trust} · Lagaav {r.affection} · Tension {r.tension}
            </Text>
            {r.summary ? <Text style={[styles.factSub, { color: theme.textDim }]}>{clean(r.summary)}</Text> : null}
          </Card>
        );
      })}

      <Heading icon="flag-outline" title="Adhoori baatein" count={threads.length} />
      {threads.length === 0 ? <Empty text="Koi adhoora vaada ya sawaal nahi." /> : null}
      {threads.map((t) => (
        <Card key={t.id}>
          <Text style={[styles.factName, { color: theme.text }]}>{clean(t.title)}</Text>
          {t.description ? <Text style={[styles.factSub, { color: theme.textDim }]}>{clean(t.description)}</Text> : null}
        </Card>
      ))}

      {prefs.length > 0 ? (
        <>
          <Heading icon="person-outline" title="Tumhari pasand" count={prefs.length} />
          <Card>
            {prefs.map((p) => (
              <Text key={p.id} style={[styles.pref, { color: theme.textDim }]}>• {clean(p.text)}</Text>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

/** "player → mahi (turn 12)" → "Pehle Ankit ke paas tha · chat 12 mein badla" (ids become names, no arrow glyph). */
export function describeMove(entry: string, nameOf: (id: string) => string): string {
  const m = /^\s*(.+?)\s*(?:→|->)\s*(.+?)\s*(?:\(turn\s*(\d+)\))?\s*$/.exec(entry);
  if (!m) return clean(entry);
  const from = m[1] === 'none' || m[1] === 'null' ? null : nameOf(m[1]);
  const turn = m[3] ? ` · chat ${m[3]}` : '';
  return from ? `Pehle ${from} ke paas tha${turn}` : `Abhi mila${turn}`;
}

function FactLine({ label, value }: { label: string; value: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.factLine}>
      <Text style={[styles.factLabel, { color: theme.textFaint }]}>{label}</Text>
      <Text style={[styles.factLineValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- Chapters */

function ChaptersTab({ chapters }: { chapters: Chapter[] }) {
  const { theme } = useApp();
  if (!chapters.length) return <Empty text="Pehla chapter lagbhag 24 chats ke baad band hoga — tab yahan dikhega." />;
  return (
    <>
      {chapters.map((c, i) => (
        <Card key={`${c.atTurn}-${i}`}>
          <Text style={[styles.chapterKicker, { color: theme.primary }]}>CHAPTER {i + 1}</Text>
          <Text style={[styles.factName, { color: theme.text }]}>{clean(c.title)}</Text>
          <Text style={[styles.summary, { color: theme.textDim }]}>{clean(c.text)}</Text>
          <Text style={[styles.factSub, { color: theme.textFaint }]}>Chat {c.atTurn} tak · {timeAgo(c.createdAt)}</Text>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.page, paddingTop: 10 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  sub: { fontSize: SCALE.caption, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: SPACING.page, marginTop: SPACING.lg, borderWidth: 1, borderRadius: RADIUS.pill, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.pill },
  tabText: { fontSize: SCALE.caption, fontWeight: '500' },
  tabTextOn: { fontWeight: '700' },
  body: { paddingHorizontal: SPACING.page, paddingTop: 6 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: SPACING.lg, marginBottom: 10 },
  headingText: { fontSize: 16, fontWeight: '700' },
  headingCount: { fontSize: SCALE.caption, marginLeft: 2 },
  empty: { fontSize: SCALE.small, lineHeight: 20, marginBottom: 10 },
  summary: { fontSize: SCALE.small + 0.5, lineHeight: 22, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 10 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  smallBtnText: { fontSize: SCALE.caption, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: SCALE.small + 0.5, lineHeight: 21, minHeight: 64, textAlignVertical: 'top' },
  inputTall: { minHeight: 180 },
  foldToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  foldText: { fontSize: SCALE.caption, fontWeight: '600' },
  memMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  memMetaText: { fontSize: 11 },
  memText: { fontSize: SCALE.small + 0.5, lineHeight: 21 },
  pinTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pinTagText: { fontSize: 10, fontWeight: '700' },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  factName: { fontSize: SCALE.body - 0.5, fontWeight: '600', flexShrink: 1 },
  factValue: { fontSize: SCALE.small, fontWeight: '700', maxWidth: '50%' },
  factSub: { fontSize: SCALE.caption, lineHeight: 18, marginTop: 6 },
  factLine: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  factLabel: { width: 84, fontSize: SCALE.caption },
  factLineValue: { flex: 1, fontSize: SCALE.small, fontWeight: '500' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 9 },
  fill: { height: 4, borderRadius: 2 },
  pref: { fontSize: SCALE.small, lineHeight: 21 },
  chapterKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: SPACING.xl, paddingTop: 14 },
  noteText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
});
