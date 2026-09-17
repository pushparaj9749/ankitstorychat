/**
 * Submit a Story / Suggest an Idea — user-facing form.
 *
 * Two modes:
 *   - "idea" :  simple 5-field form (creator, title, concept, genre, characters, notes).
 *   - "story":  full submission. Users can toggle between a guided form and a
 *               JSON editor. Both modes POST to the same Worker endpoint after
 *               client-side validation.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS, SPACING } from '../theme';
import {
  SubmissionApiError,
  formatRemaining,
  getLimitStatus,
  submitIdea,
  submitStory,
} from '../content/submissions';
import { validateIdeaSubmission, validateStorySubmission } from '../lib/validate';
import { effectiveContentApiBaseUrl } from '../content/api';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmitStory'>;

type Mode = 'idea' | 'story';
type StoryInputMode = 'form' | 'json';

const GENRES = [
  'Romance',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Drama',
  'Comedy',
  'Horror',
  'Sci-Fi',
  'Adventure',
  'Mythology',
  'Supernatural',
  'Other',
];

export function SubmitStory({ navigation, route }: Props) {
  const { theme, profile, settings } = useApp();
  const initialMode: Mode = route.params?.mode ?? 'idea';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [storyMode, setStoryMode] = useState<StoryInputMode>('form');

  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);

  // Form state
  const [creatorName, setCreatorName] = useState(profile?.nickname ?? '');
  const [title, setTitle] = useState('');
  const [concept, setConcept] = useState('');
  const [genre, setGenre] = useState('Romance');
  const [characters, setCharacters] = useState('');
  const [notes, setNotes] = useState('');

  // Complete story form state
  const [storyDescription, setStoryDescription] = useState('');
  const [storyAgeRating, setStoryAgeRating] = useState<'12-17' | '18+'>('12-17');
  const [storyId, setStoryId] = useState('');
  const [storyContent, setStoryContent] = useState('');

  // JSON mode
  const [jsonText, setJsonText] = useState('');

  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<{ remaining: number; resetsAt: number } | null>(null);

  React.useEffect(() => {
    let alive = true;
    getLimitStatus(apiBase)
      .then((r) => alive && setLimit({ remaining: r.remaining, resetsAt: r.resetsAt }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [apiBase]);

  const limitLabel = useMemo(() => {
    if (!limit) return '…';
    const ms = Math.max(0, limit.resetsAt - Date.now());
    return `${limit.remaining}/50 slots left • resets in ${formatRemaining(ms)}`;
  }, [limit]);

  function fieldStyle(multiline = false) {
    return StyleSheet.flatten([
      styles.input,
      {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        color: theme.text,
        minHeight: multiline ? 120 : 48,
        textAlignVertical: (multiline ? 'top' : 'center') as 'top' | 'center',
      },
    ]);
  }

  function label(text: string) {
    return <Text style={[styles.label, { color: theme.textDim }]}>{text}</Text>;
  }

  async function handleSubmitIdea() {
    const v = validateIdeaSubmission({
      creatorName,
      title,
      concept,
      genre,
      characters,
      notes,
    });
    if (!v.ok || !v.cleaned) {
      Alert.alert('Please check the form', v.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      return;
    }
    setLoading(true);
    try {
      const res = await submitIdea(
        {
          creatorName: v.cleaned.creatorName,
          title: v.cleaned.title,
          concept: v.cleaned.concept,
          genre: v.cleaned.genre,
          characters: v.cleaned.characters,
          notes: v.cleaned.notes,
        },
        apiBase,
      );
      if (res.id) {
        const { recordLocalSubmission } = await import('./MySubmissions');
        await recordLocalSubmission({ id: res.id, type: 'idea', creatorName: v.cleaned.creatorName, title: v.cleaned.title });
        navigation.replace('SubmissionSuccess', {
          id: res.id,
          type: 'idea',
          creatorName: v.cleaned.creatorName,
          resetsAt: res.resetsAt ?? Date.now() + 24 * 3600 * 1000,
        });
      }
    } catch (e) {
      const err = e as SubmissionApiError;
      Alert.alert('Could not submit', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitStoryJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      Alert.alert('Invalid JSON', 'The JSON could not be parsed. Check for syntax errors.');
      return;
    }
    const v = validateStorySubmission(parsed);
    if (!v.ok || !v.cleaned) {
      Alert.alert('Story validation failed', v.issues.slice(0, 8).map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      return;
    }
    setLoading(true);
    try {
      // Force verified=false, enforce sanitised creator.
      const payload = parsed as Record<string, unknown>;
      const res = await submitStory(
        {
          creatorName: v.cleaned.creatorName,
          bundle: {
            story: { ...(v.cleaned.bundle.story as unknown as Record<string, unknown>), id: v.cleaned.storyId },
            characters: v.cleaned.bundle.characters as unknown as Record<string, unknown>,
            world: v.cleaned.bundle.world as unknown as Record<string, unknown>,
            scenes: v.cleaned.bundle.scenes as unknown as Record<string, unknown>,
            memory: v.cleaned.bundle.memory as unknown as Record<string, unknown>,
          },
        },
        apiBase,
      );
      if (res.id) {
        const { recordLocalSubmission } = await import('./MySubmissions');
        await recordLocalSubmission({ id: res.id, type: 'story', creatorName: v.cleaned.creatorName, title: v.cleaned.title });
        navigation.replace('SubmissionSuccess', {
          id: res.id,
          type: 'story',
          creatorName: v.cleaned.creatorName,
          resetsAt: res.resetsAt ?? Date.now() + 24 * 3600 * 1000,
        });
      }
    } catch (e) {
      const err = e as SubmissionApiError;
      Alert.alert('Could not submit', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      void getLimitStatus(apiBase).then((r) => setLimit({ remaining: r.remaining, resetsAt: r.resetsAt })).catch(() => undefined);
    }
  }

  async function handleSubmitStoryForm() {
    // Convert form fields into the standard JSON bundle shape then submit.
    if (!title.trim() || !storyDescription.trim() || !storyId.trim()) {
      Alert.alert('Missing fields', 'Please fill in title, description and story id.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(storyId.trim())) {
      Alert.alert('Invalid story id', 'Use lowercase letters, numbers and hyphens only (e.g. my-story).');
      return;
    }
    let contentJson: unknown = {};
    if (storyContent.trim()) {
      try {
        contentJson = JSON.parse(storyContent);
      } catch {
        Alert.alert('Invalid story content JSON', 'The "Story content" field must be valid JSON (scenes, etc.).');
        return;
      }
    }
    const payload: Record<string, unknown> = {
      creator: { name: creatorName.trim(), avatar: null, verified: false },
      story: {
        id: storyId.trim(),
        title: title.trim(),
        description: storyDescription.trim(),
        version: 1,
        language: 'hinglish',
        ageRating: storyAgeRating,
        contentLevel: storyAgeRating === '18+' ? 'mature' : 'teen',
        genres: [genre],
        tags: [],
        userRole: '{{playerName}}',
        setting: '',
        openingSceneId: 'start',
        tone: '',
        safetyNotes: [],
        creator: { name: creatorName.trim(), avatar: null, verified: false },
        ...(typeof contentJson === 'object' && contentJson ? contentJson : {}),
      },
    };
    const v = validateStorySubmission(payload);
    if (!v.ok || !v.cleaned) {
      Alert.alert('Please complete the story', v.issues.slice(0, 8).map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      return;
    }
    setLoading(true);
    try {
      const res = await submitStory(
        {
          creatorName: v.cleaned.creatorName,
          bundle: { story: payload.story as Record<string, unknown> },
        },
        apiBase,
      );
      if (res.id) {
        const { recordLocalSubmission } = await import('./MySubmissions');
        await recordLocalSubmission({ id: res.id, type: 'story', creatorName: v.cleaned.creatorName, title: title.trim() });
        navigation.replace('SubmissionSuccess', {
          id: res.id,
          type: 'story',
          creatorName: v.cleaned.creatorName,
          resetsAt: res.resetsAt ?? Date.now() + 24 * 3600 * 1000,
        });
      }
    } catch (e) {
      const err = e as SubmissionApiError;
      Alert.alert('Could not submit', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      void getLimitStatus(apiBase).then((r) => setLimit({ remaining: r.remaining, resetsAt: r.resetsAt })).catch(() => undefined);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={[styles.backText, { color: theme.text }]}>‹ Back</Text>
          </Pressable>

          <Text style={[styles.heading, { color: theme.text }]}>
            {mode === 'idea' ? '💡 Suggest an Idea' : '📖 Submit a Story'}
          </Text>
          <Text style={[styles.subheading, { color: theme.textDim }]}>
            Every submission is reviewed by the Kissa team before it goes live. You will see a
            confirmation within 24 hours.
          </Text>

          <View style={[styles.limitBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.limitText, { color: theme.textDim }]}>⏳ {limitLabel}</Text>
          </View>

          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setMode('idea')}
              style={[
                styles.tab,
                {
                  backgroundColor: mode === 'idea' ? theme.primary : 'transparent',
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: mode === 'idea' ? '#fff' : theme.textDim }]}>💡 Idea</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('story')}
              style={[
                styles.tab,
                {
                  backgroundColor: mode === 'story' ? theme.primary : 'transparent',
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: mode === 'story' ? '#fff' : theme.textDim }]}>📖 Story</Text>
            </Pressable>
          </View>

          <SectionHeader title="Creator" />
          {label('Your name (shown as Story Creator after approval)')}
          <TextInput
            style={fieldStyle()}
            placeholder="Creator name"
            placeholderTextColor={theme.textFaint}
            value={creatorName}
            onChangeText={setCreatorName}
            maxLength={60}
            autoCapitalize="words"
          />
          <Text style={[styles.hint, { color: theme.textFaint }]}>
            Tip: Kissa owner stories are credited to "{KISSA_OWNER_CREATOR.name}". Leave your own name here.
          </Text>

          {mode === 'idea' ? (
            <>
              <SectionHeader title="Idea" />
              {label('Title *')}
              <TextInput style={fieldStyle()} placeholder="Story title" placeholderTextColor={theme.textFaint} value={title} onChangeText={setTitle} maxLength={120} />
              {label('Idea / Concept *')}
              <TextInput style={fieldStyle(true)} placeholder="Describe your idea in a few lines…" placeholderTextColor={theme.textFaint} value={concept} onChangeText={setConcept} multiline maxLength={20000} />
              {label('Genre *')}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {GENRES.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGenre(g)}
                    style={[
                      styles.pill,
                      { backgroundColor: genre === g ? theme.primary : theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={{ color: genre === g ? '#fff' : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>{g}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {label('Characters (optional)')}
              <TextInput style={fieldStyle()} placeholder="Main characters" placeholderTextColor={theme.textFaint} value={characters} onChangeText={setCharacters} maxLength={2000} />
              {label('Special notes (optional)')}
              <TextInput style={fieldStyle(true)} placeholder="Anything else?" placeholderTextColor={theme.textFaint} value={notes} onChangeText={setNotes} multiline maxLength={20000} />

              <View style={{ height: SPACING.xl }} />
              <GradientButton title={loading ? 'Submitting…' : '💡 Submit Idea'} onPress={handleSubmitIdea} disabled={loading} loading={loading} />
            </>
          ) : (
            <>
              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => setStoryMode('form')}
                  style={[styles.subTab, { borderColor: storyMode === 'form' ? theme.primary : theme.border }]}
                >
                  <Text style={{ color: storyMode === 'form' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>Form</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStoryMode('json')}
                  style={[styles.subTab, { borderColor: storyMode === 'json' ? theme.primary : theme.border }]}
                >
                  <Text style={{ color: storyMode === 'json' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>JSON</Text>
                </Pressable>
              </View>

              {storyMode === 'form' ? (
                <>
                  <SectionHeader title="Story details" />
                  {label('Story id (lowercase slug, e.g. my-story)')}
                  <TextInput style={fieldStyle()} placeholder="my-story" placeholderTextColor={theme.textFaint} value={storyId} onChangeText={(t) => setStoryId(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
                  {label('Title *')}
                  <TextInput style={fieldStyle()} placeholder="Title" placeholderTextColor={theme.textFaint} value={title} onChangeText={setTitle} />
                  {label('Description *')}
                  <TextInput style={fieldStyle(true)} placeholder="Short description" placeholderTextColor={theme.textFaint} value={storyDescription} onChangeText={setStoryDescription} multiline />
                  {label('Genre *')}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {GENRES.map((g) => (
                      <Pressable key={g} onPress={() => setGenre(g)} style={[styles.pill, { backgroundColor: genre === g ? theme.primary : theme.surface, borderColor: theme.border }]}>
                        <Text style={{ color: genre === g ? '#fff' : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>{g}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {label('Age rating')}
                  <View style={styles.tabRow}>
                    <Pressable onPress={() => setStoryAgeRating('12-17')} style={[styles.subTab, { borderColor: storyAgeRating === '12-17' ? theme.primary : theme.border }]}>
                      <Text style={{ color: storyAgeRating === '12-17' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>12-17</Text>
                    </Pressable>
                    <Pressable onPress={() => setStoryAgeRating('18+')} style={[styles.subTab, { borderColor: storyAgeRating === '18+' ? theme.primary : theme.border }]}>
                      <Text style={{ color: storyAgeRating === '18+' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>18+</Text>
                    </Pressable>
                  </View>
                  {label('Story content (JSON — scenes, characters, world, memory)')}
                  <TextInput style={[fieldStyle(true), { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} placeholder='{"scenes": [...], "characters": {...}}' placeholderTextColor={theme.textFaint} value={storyContent} onChangeText={setStoryContent} multiline autoCapitalize="none" autoCorrect={false} />
                  <View style={{ height: SPACING.xl }} />
                  <GradientButton title={loading ? 'Submitting…' : '📖 Submit Story'} onPress={handleSubmitStoryForm} disabled={loading} loading={loading} />
                </>
              ) : (
                <>
                  <SectionHeader title="JSON editor" />
                  <Text style={[styles.hint, { color: theme.textFaint }]}>
                    Paste a complete Kissa story JSON. Required keys: story (with id, title, ageRating, contentLevel, openingSceneId), characters, world, scenes, memory. creator.name is required.
                  </Text>
                  <TextInput
                    style={[fieldStyle(true), { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.small }]}
                    placeholder={'{\n  "story": { "id": "my-story", ... },\n  "creator": { "name": "Your Name" },\n  ...\n}'}
                    placeholderTextColor={theme.textFaint}
                    value={jsonText}
                    onChangeText={setJsonText}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                  <View style={{ height: SPACING.xl }} />
                  <GradientButton title={loading ? 'Validating & submitting…' : '📖 Submit JSON Story'} onPress={handleSubmitStoryJson} disabled={loading} loading={loading} />
                </>
              )}
            </>
          )}

          <View style={{ height: SPACING.xxl }} />
          {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { fontSize: 17, fontWeight: '700' },
  heading: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  subheading: { fontSize: FONTS.body, lineHeight: 22, marginTop: 8 },
  limitBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 16 },
  limitText: { fontSize: FONTS.small, fontWeight: '700', textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md, marginBottom: SPACING.sm },
  tab: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: FONTS.body, fontWeight: '800' },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FONTS.body,
    marginBottom: 10,
  },
  label: { fontSize: FONTS.small, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  hint: { fontSize: FONTS.small, marginTop: 4, marginBottom: 6 },
  pill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
});
