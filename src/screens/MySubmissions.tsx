/**
 * "My Submissions" Screen — the submissions sent from this device.
 *
 * v2.10.1: statuses are synced from the server (GET /api/submit/status, status
 * words only) on open and on pull-to-refresh, so an accepted idea shows
 * "Accepted" instead of staying "Pending" forever. Pending items are no longer
 * silently dropped after 24h.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { Icon } from '../components/icons';
import { RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { fetchSubmissionStatuses, formatRemaining } from '../content/submissions';
import { kvGet, kvSet } from '../lib/db';
import { applyServerStatuses, idsToCheck, pruneSubmissions } from '../lib/submissionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'MySubmissions'>;

interface LocalSub {
  id: string;
  type: 'idea' | 'story';
  creatorName: string;
  title: string;
  submittedAt: string;
  knownStatus: 'pending' | 'accepted' | 'rejected' | 'expired';
}

const LOCAL_KEY = 'my_submissions_v1';

export function MySubmissions({ navigation }: Props) {
  const { theme, settings } = useApp();
  const [subs, setSubs] = useState<LocalSub[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const apiBase = settings?.contentApiBaseUrl;

  const load = useCallback(async () => {
    const raw = await kvGet(LOCAL_KEY);
    if (!raw) {
      setSubs([]);
      return;
    }
    let list: LocalSub[];
    try {
      list = JSON.parse(raw) as LocalSub[];
    } catch {
      setSubs([]);
      return;
    }
    const sortNewest = (l: LocalSub[]) => [...l].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const pruned = pruneSubmissions(list);
    setSubs(sortNewest(pruned));
    let next = pruned;
    // Ask the server what happened to anything still pending.
    const ids = idsToCheck(pruned);
    if (ids.length > 0) {
      try {
        const statuses = await fetchSubmissionStatuses(ids, apiBase);
        const res = applyServerStatuses(pruned, statuses);
        next = res.list;
        if (res.changed) setSubs(sortNewest(next));
      } catch {
        // Offline / server busy: keep what we know; pull to refresh retries.
      }
    }
    if (next !== list) await kvSet(LOCAL_KEY, JSON.stringify(next));
  }, [apiBase]);

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
    if (s === 'expired') return theme.textFaint;
    return theme.accent;
  }
  function statusLabel(s: LocalSub['knownStatus']) {
    if (s === 'accepted') return 'Accepted';
    if (s === 'rejected') return 'Rejected';
    if (s === 'expired') return 'Expired';
    return 'Pending';
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-back" size={16} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>CREATOR STUDIO</Text>
          <Text style={[styles.title, { color: theme.text }]}>My Submissions</Text>
        </View>

        <Text style={[styles.sub, { color: theme.textDim }]}>
          Tracking the submissions you sent from this device. Pending items are reviewed within 24 hours — pull down to refresh their status.
        </Text>

        <View style={{ height: SPACING.md }} />
        <GradientButton
          title="Suggest an Idea"
          variant="gold"
          onPress={() => navigation.navigate('SubmitStory', { mode: 'idea' })}
        />
        <View style={{ height: SPACING.sm }} />
        <GradientButton
          title="Submit a Story"
          variant="ghost"
          onPress={() => navigation.navigate('SubmitStory', { mode: 'story' })}
        />

        <SectionHeader title="Recent Submissions" kicker={`${subs.length} items`} />
        {subs.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface, 0.6) }]}>
            <Text style={{ color: theme.textDim, textAlign: 'center', lineHeight: 20 }}>
              You have not submitted any ideas or stories from this device yet.
            </Text>
          </View>
        ) : (
          subs.map((s) => {
            const expiresAt = new Date(s.submittedAt).getTime() + 24 * 3600 * 1000;
            const remaining = Math.max(0, expiresAt - Date.now());
            return (
              <View
                key={s.id}
                style={[
                  styles.card,
                  { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
                  SHADOWS.card,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 6 }}>
                    <Icon name={s.type === 'idea' ? 'bulb-outline' : 'book-outline'} size={16} color={theme.textDim} />
                    <Text
                      style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}
                      numberOfLines={1}
                    >
                      {s.title || '(untitled)'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: withAlpha(statusColor(s.knownStatus), 0.14) }]}>
                    <Text style={{ color: statusColor(s.knownStatus), fontSize: SCALE.micro, fontWeight: '800' }}>
                      {statusLabel(s.knownStatus)}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: theme.textDim, fontSize: SCALE.small, marginTop: 6 }}>
                  by {s.creatorName} • {new Date(s.submittedAt).toLocaleDateString()}
                </Text>
                {s.knownStatus === 'pending' && remaining > 0 ? (
                  <Text style={{ color: theme.textFaint, fontSize: SCALE.micro, marginTop: 4 }}>
                    Expires in {formatRemaining(remaining)}
                  </Text>
                ) : s.knownStatus === 'accepted' ? (
                  <Text style={{ color: theme.textFaint, fontSize: SCALE.micro, marginTop: 4 }}>
                    {s.type === 'idea' ? 'Accepted by the Kissa team — thank you!' : 'Accepted and published — thank you!'}
                  </Text>
                ) : s.knownStatus === 'expired' ? (
                  <Text style={{ color: theme.textFaint, fontSize: SCALE.micro, marginTop: 4 }}>
                    Not reviewed within 24 hours.
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
  header: { paddingTop: 4, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.displaySmall, marginTop: 4 },
  sub: { fontSize: SCALE.small, marginTop: 6, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', marginTop: 8 },
});

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
