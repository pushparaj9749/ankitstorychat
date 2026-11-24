/**
 * Notifications — the feed behind the Home bell icon.
 *
 * Two kinds of messages land here:
 *   - automatic: a submission was accepted ("agli 3 ghante me live") or
 *     rejected;
 *   - personal: a message the Kissa team sent to this account.
 *
 * Everything is created on the server and read with the account token, so a
 * new phone shows the same feed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/states';
import { Icon } from '../components/icons';
import { LAYOUT, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { markAllNotificationsRead, notificationsFeed, type NotificationItem } from '../lib/account';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const ICONS: Record<string, 'checkmark-circle-outline' | 'close-circle-outline' | 'notifications-outline'> = {
  story_accepted: 'checkmark-circle-outline',
  story_rejected: 'close-circle-outline',
  system: 'notifications-outline',
};

export function Notifications({ navigation }: Props) {
  const { theme, account, settings, refreshUnread } = useApp();
  const apiBase = settings?.contentApiBaseUrl;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (asRefresh = false) => {
      if (!account) {
        setLoading(false);
        return;
      }
      if (asRefresh) setRefreshing(true);
      try {
        const res = await notificationsFeed(apiBase);
        setItems(res.items);
        setError(null);
        if (res.unread > 0) {
          await markAllNotificationsRead(apiBase).catch(() => undefined);
          await refreshUnread();
        }
      } catch {
        setError('Notifications load nahi hui — connection check karo.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, apiBase],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!account) {
    return (
      <Screen>
        <View style={styles.page}>
          <Text style={[styles.title, { color: theme.text }]}>Login karo</Text>
          <Text style={[styles.body, { color: theme.textDim }]}>Notifications dekhne ke liye account zaroori hai.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.kicker, { color: theme.gold }]}>UPDATES</Text>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>

        {error ? <Text style={[styles.body, { color: theme.danger, marginBottom: SPACING.md }]}>{error}</Text> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Abhi kuch naya nahi"
            subtitle="Story accept hote hi hum yahan batayenge — agli 3 ghante me app me live."
          />
        ) : null}

        {items.map((n) => (
          <View
            key={n.id}
            style={[
              styles.card,
              {
                backgroundColor: withAlpha(theme.surface, 0.9),
                borderColor: n.readAt ? theme.border : withAlpha(theme.primary, 0.45),
              },
              n.readAt ? null : SHADOWS.soft,
            ]}
          >
            <View style={styles.cardHead}>
              <Icon
                name={ICONS[n.kind] ?? 'notifications-outline'}
                size={18}
                color={n.kind === 'story_accepted' ? theme.success : n.kind === 'story_rejected' ? theme.textDim : theme.accent}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>{n.title}</Text>
            </View>
            <Text style={[styles.body, { color: theme.textDim }]}>{n.body}</Text>
            <View style={styles.cardFoot}>
              <Text style={[styles.time, { color: theme.textFaint }]}>
                {new Date(n.createdAt).toLocaleString()}
              </Text>
              {n.submissionId ? (
                <Text
                  onPress={() => navigation.navigate('MySubmissions')}
                  style={[styles.link, { color: theme.accent }]}
                  accessibilityRole="link"
                >
                  Submissions dekho
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.page, paddingTop: SPACING.xxl },
  kicker: { ...TYPE.overline, marginBottom: 6 },
  title: { ...TYPE.display, marginBottom: SPACING.lg },
  body: { ...TYPE.body, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...TYPE.subheading, flex: 1 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  time: { ...TYPE.tiny },
  link: { ...TYPE.caption, fontWeight: '700' },
});
