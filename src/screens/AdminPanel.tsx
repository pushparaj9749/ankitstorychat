/**
 * Admin Panel — pending Ideas / pending Stories.
 *
 * Protected by a Bearer token stored in SecureStore (same pattern as AI API
 * keys). The server independently enforces the same token; nothing on the
 * client is trusted.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, StorySubmission } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS, SPACING } from '../theme';
import {
  acceptIdeaAdmin,
  acceptStoryAdmin,
  clearAdminToken,
  formatRemaining,
  getAdminToken,
  hasAdminToken,
  listPendingAdmin,
  rejectIdeaAdmin,
  rejectStoryAdmin,
  saveAdminToken,
  SubmissionApiError,
} from '../content/submissions';
import { effectiveContentApiBaseUrl } from '../content/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPanel'>;

type Tab = 'ideas' | 'stories';

export function AdminPanel({ navigation }: Props) {
  const { theme, settings } = useApp();
  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tab, setTab] = useState<Tab>('ideas');
  const [ideas, setIdeas] = useState<StorySubmission[]>([]);
  const [stories, setStories] = useState<StorySubmission[]>([]);
  const [remaining, setRemaining] = useState(50);
  const [resetsAt, setResetsAt] = useState(Date.now() + 24 * 3600 * 1000);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<StorySubmission | null>(null);

  const checkAuth = useCallback(async () => {
    setAuthed(await hasAdminToken());
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const load = useCallback(async () => {
    try {
      const res = await listPendingAdmin(apiBase);
      setIdeas(res.ideas);
      setStories(res.stories);
      setRemaining(res.remaining);
      setResetsAt(res.resetsAt);
    } catch (e) {
      const err = e as SubmissionApiError;
      if (err.status === 401) {
        await clearAdminToken();
        setAuthed(false);
      } else {
        Alert.alert('Could not load submissions', err.message);
      }
    }
  }, [apiBase]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  async function onSaveToken() {
    const t = tokenInput.trim();
    if (!t) {
      Alert.alert('Enter the admin token.');
      return;
    }
    await saveAdminToken(t);
    setTokenInput('');
    setAuthed(true);
  }

  async function onLogout() {
    await clearAdminToken();
    setAuthed(false);
  }

  async function acceptIdea(id: string) {
    try {
      await acceptIdeaAdmin(id, apiBase);
      setViewing(null);
      await load();
    } catch (e) {
      Alert.alert('Accept failed', (e as Error).message);
    }
  }
  async function rejectIdea(id: string) {
    try {
      await rejectIdeaAdmin(id, apiBase);
      setViewing(null);
      await load();
    } catch (e) {
      Alert.alert('Reject failed', (e as Error).message);
    }
  }
  async function acceptStory(id: string) {
    Alert.alert('Accept & Publish?', 'This will move the story out of the pending queue and queue it for inclusion in the catalog.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept & Publish',
        onPress: async () => {
          try {
            await acceptStoryAdmin(id, apiBase);
            setViewing(null);
            await load();
          } catch (e) {
            Alert.alert('Publish failed', (e as Error).message);
          }
        },
      },
    ]);
  }
  async function rejectStory(id: string) {
    try {
      await rejectStoryAdmin(id, apiBase);
      setViewing(null);
      await load();
    } catch (e) {
      Alert.alert('Reject failed', (e as Error).message);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (authed === null) {
    return (
      <Screen>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (!authed) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>‹ Back</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 4 }}>🔒 Admin Access</Text>
          <Text style={{ color: theme.textDim, marginTop: 8, lineHeight: 22 }}>
            Enter the admin token to review submissions. Users do not see this screen by default.
          </Text>
          <View style={{ height: SPACING.lg }} />
          <TextInput
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
              borderWidth: 1,
              borderRadius: RADIUS.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: FONTS.body,
              fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
            }}
            placeholder="Admin token"
            placeholderTextColor={theme.textFaint}
            value={tokenInput}
            onChangeText={setTokenInput}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ height: SPACING.md }} />
          <GradientButton title="Unlock admin panel" onPress={onSaveToken} />
        </ScrollView>
      </Screen>
    );
  }

  const data = tab === 'ideas' ? ideas : stories;
  const now = Date.now();

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>‹ Back</Text>
          </Pressable>
          <Pressable onPress={onLogout}>
            <Text style={{ color: theme.danger, fontSize: FONTS.small, fontWeight: '800' }}>Log out</Text>
          </Pressable>
        </View>

        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900' }}>🛡 Admin Panel</Text>
        <Text style={{ color: theme.textDim, fontSize: FONTS.small, marginTop: 6 }}>
          Pending submissions — review before anything goes live.
        </Text>

        <View style={[styles.limitBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontSize: FONTS.small, fontWeight: '800' }}>
            Global 24h limit: {remaining}/50 slots left
          </Text>
          <Text style={{ color: theme.textDim, fontSize: FONTS.tiny, marginTop: 2 }}>
            Window resets in {formatRemaining(Math.max(0, resetsAt - now))}
          </Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setTab('ideas')}
            style={[styles.tab, { backgroundColor: tab === 'ideas' ? theme.primary : 'transparent', borderColor: theme.border }]}
          >
            <Text style={{ color: tab === 'ideas' ? '#fff' : theme.textDim, fontWeight: '800' }}>
              💡 Ideas ({ideas.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('stories')}
            style={[styles.tab, { backgroundColor: tab === 'stories' ? theme.primary : 'transparent', borderColor: theme.border }]}
          >
            <Text style={{ color: tab === 'stories' ? '#fff' : theme.textDim, fontWeight: '800' }}>
              📖 Stories ({stories.length})
            </Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} /> : null}

        {data.length === 0 && !loading ? (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textDim, textAlign: 'center' }}>
              No pending {tab === 'ideas' ? 'ideas' : 'stories'}.
            </Text>
          </View>
        ) : null}

        {data.map((s) => {
          const exp = Math.max(0, new Date(s.expiresAt).getTime() - now);
          return (
            <Pressable
              key={s.id}
              onPress={() => setViewing(s)}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.text, fontWeight: '800', flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {s.type === 'idea' ? '💡' : '📖'} {s.title || '(untitled)'}
                </Text>
                <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>
                  PENDING
                </Text>
              </View>
              <Text style={{ color: theme.textDim, fontSize: FONTS.small, marginTop: 4 }}>
                by {s.creator.name}
                {s.creator.verified ? ' ✓' : ''}
                {s.genre ? ` • ${s.genre}` : ''}
              </Text>
              <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 4 }}>
                Expires in {formatRemaining(exp)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <Screen>
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
              <Pressable onPress={() => setViewing(null)} style={{ paddingVertical: 8 }}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>‹ Close</Text>
              </Pressable>
              {viewing ? (
                <>
                  <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                    {viewing.type === 'idea' ? '💡' : '📖'} {viewing.title}
                  </Text>
                  <Text style={{ color: theme.textDim, marginTop: 6 }}>
                    Creator: <Text style={{ color: theme.text, fontWeight: '700' }}>{viewing.creator.name}</Text>
                    {viewing.creator.verified ? ' ✓' : ''}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 4 }}>
                    Submitted {new Date(viewing.submittedAt).toLocaleString()} • Expires{' '}
                    {formatRemaining(Math.max(0, new Date(viewing.expiresAt).getTime() - Date.now()))}
                  </Text>

                  <SectionHeader title="Content" />
                  {viewing.type === 'idea' ? (
                    <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <IdeaPreview sub={viewing} />
                    </View>
                  ) : (
                    <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={{ color: theme.textDim, fontSize: FONTS.small }} selectable>
                        {JSON.stringify(viewing.payload, null, 2)}
                      </Text>
                    </View>
                  )}

                  <View style={{ height: SPACING.lg }} />
                  {viewing.type === 'idea' ? (
                    <>
                      <GradientButton title="✅ Accept Idea" variant="gold" onPress={() => acceptIdea(viewing.id)} />
                      <View style={{ height: SPACING.sm }} />
                      <GradientButton title="❌ Reject" variant="ghost" onPress={() => rejectIdea(viewing.id)} />
                    </>
                  ) : (
                    <>
                      <GradientButton title="✅ Accept & Publish" variant="gold" onPress={() => acceptStory(viewing.id)} />
                      <View style={{ height: SPACING.sm }} />
                      <GradientButton title="❌ Reject" variant="ghost" onPress={() => rejectStory(viewing.id)} />
                    </>
                  )}
                </>
              ) : null}
            </ScrollView>
          </Screen>
        </View>
      </Modal>
    </Screen>
  );
}

function IdeaPreview({ sub }: { sub: StorySubmission }) {
  const { theme } = useApp();
  const p = sub.payload as { concept?: string; genre?: string; characters?: string; notes?: string };
  return (
    <View>
      <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>GENRE</Text>
      <Text style={{ color: theme.text, fontSize: FONTS.body, marginBottom: 10 }}>{p.genre}</Text>
      <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>CONCEPT</Text>
      <Text style={{ color: theme.text, fontSize: FONTS.small, lineHeight: 22, marginBottom: 10 }}>{p.concept}</Text>
      {p.characters ? (
        <>
          <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>CHARACTERS</Text>
          <Text style={{ color: theme.text, fontSize: FONTS.small, lineHeight: 22, marginBottom: 10 }}>{p.characters}</Text>
        </>
      ) : null}
      {p.notes ? (
        <>
          <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>NOTES</Text>
          <Text style={{ color: theme.text, fontSize: FONTS.small, lineHeight: 22 }}>{p.notes}</Text>
        </>
      ) : null}
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  limitBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: SPACING.md },
  tabRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md, marginBottom: SPACING.sm },
  tab: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginBottom: 10 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RADIUS.md, padding: 24, marginTop: 20 },
  preview: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginTop: 8 },
});
