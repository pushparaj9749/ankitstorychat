/**
 * "My Submissions" screen.
 *
 * Because submissions are anonymous on the server (no user accounts), we do
 * not persist the full list server-side keyed by user — the app stores the
 * ids of locally-submitted items in the local KV so the user can see the
 * status of their own recent submissions until they expire. After 24h they
 * disappear from the device as well.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS, SPACING } from '../theme';
import { formatRemaining } from '../content/submissions';
import { kvGet, kvSet } from '../lib/db';

type Props = NativeStackScreenProps<RootStackParamList, 'MySubmissions'>;

interface LocalSub {
  id: string;
  type: 'idea' | 'story';
  creatorName: string;
  title: string;
  submittedAt: string;
  /** Pending submissions self-destruct after 24h; accepted/rejected are removed earlier. */
  knownStatus: 'pending' | 'accepted' | 'rejected' | 'expired';
}

const LOCAL_KEY = 'my_submissions_v1';

export function MySubmissions({ navigation }: Props) {
  const { theme } = useApp();
  const [subs, setSubs] = useState<LocalSub[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const raw = await kvGet(LOCAL_KEY);
    if (!raw) {
      setSubs([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as LocalSub[];
      const now = Date.now();
      const kept = parsed.filter((s) => {
        if (s.knownStatus === 'pending' && now - new Date(s.submittedAt).getTime() > 24 * 3600 * 1000) return false;
        return true;
      });
      setSubs(kept.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
      if (kept.length !== parsed.length) await kvSet(LOCAL_KEY, JSON.stringify(kept));
    } catch {
      setSubs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function statusColor(s: LocalSub['knownStatus']) {
    if (s === 'accepted') return theme.success;
    if (s === 'rejected') return theme.danger;
    return theme.accent;
  }
  function statusLabel(s: LocalSub['knownStatus']) {
    if (s === 'accepted') return 'Accepted';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>‹ Back</Text>
        </Pressable>

        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', marginTop: 4 }}>My Submissions</Text>
        <Text style={{ color: theme.textDim, fontSize: FONTS.small, marginTop: 6, lineHeight: 20 }}>
          Tracking the submissions you sent from this device. Pending items are reviewed within 24 hours.
        </Text>

        <View style={{ height: SPACING.md }} />
        <GradientButton title="💡 Suggest an Idea" variant="gold" onPress={() => navigation.navigate('SubmitStory', { mode: 'idea' })} />
        <View style={{ height: SPACING.sm }} />
        <GradientButton title="📖 Submit a Story" variant="ghost" onPress={() => navigation.navigate('SubmitStory', { mode: 'story' })} />

        <SectionHeader title="Recent" />
        {subs.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textDim, textAlign: 'center' }}>
              You have not submitted anything from this device yet.
            </Text>
          </View>
        ) : (
          subs.map((s) => {
            const expiresAt = new Date(s.submittedAt).getTime() + 24 * 3600 * 1000;
            const remaining = Math.max(0, expiresAt - Date.now());
            return (
              <View key={s.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.text, fontWeight: '800', flex: 1, marginRight: 8 }} numberOfLines={1}>
                    {s.type === 'idea' ? '💡' : '📖'} {s.title || '(untitled)'}
                  </Text>
                  <Text style={{ color: statusColor(s.knownStatus), fontSize: FONTS.tiny, fontWeight: '900' }}>
                    {statusLabel(s.knownStatus)}
                  </Text>
                </View>
                <Text style={{ color: theme.textDim, fontSize: FONTS.small, marginTop: 4 }}>
                  by {s.creatorName}
                </Text>
                {s.knownStatus === 'pending' ? (
                  <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 4 }}>
                    Expires in {formatRemaining(remaining)}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginBottom: 10 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RADIUS.md, padding: 24, alignItems: 'center' },
});

// Helper for the Submit flow to persist a local record of what the user sent.
export async function recordLocalSubmission(
  sub: { id: string; type: 'idea' | 'story'; creatorName: string; title: string },
): Promise<void> {
  const raw = await kvGet(LOCAL_KEY);
  const list: LocalSub[] = raw ? (JSON.parse(raw) as LocalSub[]) : [];
  list.unshift({
    ...sub,
    submittedAt: new Date().toISOString(),
    knownStatus: 'pending',
  });
  await kvSet(LOCAL_KEY, JSON.stringify(list.slice(0, 50)));
}
