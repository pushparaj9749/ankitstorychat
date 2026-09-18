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
import { NaturalImage } from '../components/NaturalImage';
import { SectionHeader } from '../components/bits';
import { Icon } from '../components/icons';
import { FONTS, RADIUS, SPACING } from '../theme';
import {
  acceptIdeaAdmin,
  acceptStoryAdmin,
  clearAdminToken,
  fetchAdminMediaAsDataUri,
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
            const err = e as SubmissionApiError;
            const details = err.issues?.map((i) => `• ${i.path}: ${i.message}`).join('\n');
            Alert.alert('Publish failed', details ? `${err.message}\n\n${details}` : err.message);
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
          <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="chevron-back" size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Back</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Icon name="lock-closed-outline" size={22} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900' }}>Admin Access</Text>
          </View>
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
          <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="chevron-back" size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Back</Text>
          </Pressable>
          <Pressable onPress={onLogout}>
            <Text style={{ color: theme.danger, fontSize: FONTS.small, fontWeight: '800' }}>Log out</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="shield-outline" size={24} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900' }}>Admin Panel</Text>
        </View>
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
              Ideas ({ideas.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('stories')}
            style={[styles.tab, { backgroundColor: tab === 'stories' ? theme.primary : 'transparent', borderColor: theme.border }]}
          >
            <Text style={{ color: tab === 'stories' ? '#fff' : theme.textDim, fontWeight: '800' }}>
              Stories ({stories.length})
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 6 }}>
                  <Icon name={s.type === 'idea' ? 'bulb-outline' : 'book-outline'} size={16} color={theme.textDim} />
                  <Text style={{ color: theme.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                    {s.title || '(untitled)'}
                  </Text>
                </View>
                <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>
                  PENDING
                </Text>
              </View>
              <Text style={{ color: theme.textDim, fontSize: FONTS.small, marginTop: 4 }}>
                by {s.creator.name}
                {s.creator.verified ? ' · Verified' : ''}
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
              <Pressable onPress={() => setViewing(null)} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="chevron-back" size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Close</Text>
              </Pressable>
              {viewing ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Icon name={viewing.type === 'idea' ? 'bulb-outline' : 'book-outline'} size={22} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900' }} numberOfLines={2}>
                      {viewing.title}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textDim, marginTop: 6 }}>
                    Creator: <Text style={{ color: theme.text, fontWeight: '700' }}>{viewing.creator.name}</Text>
                    {viewing.creator.verified ? ' · Verified' : ''}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 4 }}>
                    Submitted {new Date(viewing.submittedAt).toLocaleString()} • Expires{' '}
                    {formatRemaining(Math.max(0, new Date(viewing.expiresAt).getTime() - Date.now()))}
                  </Text>

                  {viewing.type === 'story' ? (
                    <>
                      <SectionHeader title="Cover & Media Gallery" />
                      <StoryMediaPreview payload={viewing.payload} apiBase={apiBase} />
                    </>
                  ) : null}

                  <SectionHeader title={viewing.type === 'idea' ? 'Idea' : 'Story content'} />
                  {viewing.type === 'idea' ? (
                    <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <IdeaPreview sub={viewing} />
                    </View>
                  ) : (
                    <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <StoryContentPreview payload={viewing.payload} />
                    </View>
                  )}

                  <SectionHeader title="Validation" />
                  <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={{ color: theme.textDim, fontSize: FONTS.small }}>
                      Structure, schema, age rating and media were validated at submission time.
                      Final content checks run again at Accept &amp; Publish — if they fail, the
                      story stays pending and the issues are shown here.
                    </Text>
                  </View>

                  <View style={{ height: SPACING.lg }} />
                  {viewing.type === 'idea' ? (
                    <>
                      <GradientButton title="Accept Idea" variant="gold" onPress={() => acceptIdea(viewing.id)} />
                      <View style={{ height: SPACING.sm }} />
                      <GradientButton title="Reject" variant="ghost" onPress={() => rejectIdea(viewing.id)} />
                    </>
                  ) : (
                    <>
                      <GradientButton title="Accept & Publish" variant="gold" onPress={() => acceptStory(viewing.id)} />
                      <View style={{ height: SPACING.sm }} />
                      <GradientButton title="Reject" variant="ghost" onPress={() => rejectStory(viewing.id)} />
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

/**
 * Admin preview of a PENDING story's uploaded media. Images are fetched with
 * the admin token (they are private until accepted) and shown as data URIs.
 */
function StoryMediaPreview({ payload, apiBase }: { payload: unknown; apiBase: string }) {
  const { theme } = useApp();
  const p = (payload as { story?: Record<string, unknown>; characters?: { characters?: { id?: string; name?: string }[] } }) ?? {};
  const media = p.story?.media as
    | { cover?: string; gallery?: { id?: string; file?: string; kind?: string; label?: string; characterId?: string }[] }
    | undefined;
  const charName = (id?: string) =>
    id ? p.characters?.characters?.find((c) => c.id === id)?.name : undefined;

  const refs = React.useMemo(() => {
    if (!media || !Array.isArray(media.gallery)) return [];
    const out: { ref: string; kind: string; label: string }[] = [];
    if (typeof media.cover === 'string') {
      out.push({ ref: media.cover, kind: 'cover', label: 'Cover' });
    }
    for (const g of media.gallery) {
      if (!g || typeof g.file !== 'string') continue;
      if (g.file === media.cover) continue; // already shown as the cover
      const label =
        g.kind === 'character-portrait'
          ? charName(g.characterId) ?? 'Portrait'
          : g.kind === 'scene'
            ? 'Scene'
            : g.label || 'Media';
      out.push({ ref: g.file, kind: g.kind ?? 'other', label });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  const [images, setImages] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string | null> = {};
      await Promise.all(
        refs.map(async (r) => {
          const id = r.ref.replace(/^media\//, '');
          const uri = await fetchAdminMediaAsDataUri(id, apiBase);
          next[r.ref] = uri;
        }),
      );
      if (alive) {
        setImages(next);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refs, apiBase]);

  if (!media) {
    return (
      <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="warning-outline" size={14} color={theme.danger} />
          <Text style={{ color: theme.danger, fontSize: FONTS.small }}>
            No media block found — this story has no cover.
          </Text>
        </View>
      </View>
    );
  }

  if (refs.length === 0) {
    return (
      <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.textDim, fontSize: FONTS.small }}>No gallery images.</Text>
      </View>
    );
  }

  return (
    <View>
      {loading ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 8 }}>
            Loading uploaded media…
          </Text>
        </View>
      ) : (
        <View style={styles.mediaGrid}>
          {refs.map((r) => {
            const uri = images[r.ref];
            return (
              <View
                key={r.ref}
                style={[styles.mediaTile, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}
              >
                {uri ? (
                  // Admin media preview at the image's OWN aspect ratio.
                  <NaturalImage
                    source={{ uri }}
                    style={styles.mediaTileImg}
                    tint={theme.surface}
                    fallback={
                      <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, textAlign: 'center' }}>
                        unavailable
                        {'\n'}(expired?)
                      </Text>
                    }
                  />
                ) : (
                  <View style={[styles.mediaTileUnavailable, { backgroundColor: theme.surface }]}>
                    <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, textAlign: 'center' }}>
                      unavailable
                      {'\n'}(expired?)
                    </Text>
                  </View>
                )}
                <View style={[styles.mediaTileBadge, { backgroundColor: 'rgba(0,0,0,0.66)' }]}>
                  <Text style={[styles.mediaTileBadgeText, { color: theme.accent }]}>
                    {(r.kind ?? 'other').replace('-', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[styles.mediaTileLabel, { color: '#fff' }]}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={{ color: theme.textFaint, fontSize: FONTS.tiny, marginTop: 8 }}>
        {refs.length} image(s) • served privately — only visible to admins until published.
      </Text>
    </View>
  );
}

/** Structured read-only preview of the submitted story content. */
function StoryContentPreview({ payload }: { payload: unknown }) {
  const { theme } = useApp();
  const p = payload as {
    story?: Record<string, unknown>;
    characters?: { characters?: { id?: string; name?: string; role?: string }[] };
    scenes?: { scenes?: { id?: string; title?: string; narration?: string[] }[] };
    world?: { premise?: string };
    memory?: { seedMemories?: string[] };
  };
  const s = p.story ?? {};
  const chars = Array.isArray(p.characters?.characters) ? p.characters!.characters! : [];
  const scenes = Array.isArray(p.scenes?.scenes) ? p.scenes!.scenes! : [];
  const opening = scenes.find((sc) => sc.id === s.openingSceneId) ?? scenes[0];

  return (
    <View>
      <PreviewRow label="Story id" value={typeof s.id === 'string' ? s.id : '—'} />
      <PreviewRow label="Age rating" value={typeof s.ageRating === 'string' ? s.ageRating : '—'} />
      <PreviewRow label="Content level" value={typeof s.contentLevel === 'string' ? s.contentLevel : '—'} />
      <PreviewRow
        label="Genres"
        value={Array.isArray(s.genres) ? (s.genres as string[]).join(', ') : '—'}
      />
      <PreviewRow label="Scenes" value={String(scenes.length)} />
      <PreviewRow label="Characters" value={chars.map((c) => c.name).join(', ') || '—'} />
      {p.world?.premise ? (
        <PreviewRow label="Premise" value={String(p.world.premise).slice(0, 220)} />
      ) : null}
      {opening && Array.isArray(opening.narration) && opening.narration.length > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: theme.accent, fontSize: FONTS.tiny, fontWeight: '900' }}>
            OPENING NARRATION
          </Text>
          <Text style={{ color: theme.text, fontSize: FONTS.small, lineHeight: 20, marginTop: 4 }} selectable>
            {opening.narration.join('\n').slice(0, 500)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      <Text style={{ color: theme.textFaint, fontSize: FONTS.small, width: 92, fontWeight: '700' }}>
        {label}
      </Text>
      <Text style={{ color: theme.text, fontSize: FONTS.small, flex: 1 }} numberOfLines={2} selectable>
        {value}
      </Text>
    </View>
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
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Admin preview tiles: fixed width, height follows each image's own ratio.
  mediaTile: {
    width: '31%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaTileImg: { width: '100%' },
  // Placeholder box for refs whose upload already expired — no artwork to size.
  mediaTileUnavailable: {
    width: '100%',
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  mediaTileBadge: { position: 'absolute', top: 6, left: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  mediaTileBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  mediaTileLabel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
