/**
 * Submit a Story / Suggest an Idea — Creator Studio Form.
 * Redesigned for Kissa v2.4.2.
 *
 * Two modes:
 *   - "idea" :  simple 5-field form (creator, title, concept, genre, characters, notes).
 *   - "story":  full submission (guided form / JSON editor) + Media Library uploader.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, StoryMediaKind } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { NaturalImage } from '../components/NaturalImage';
import { SectionHeader } from '../components/bits';
import { Icon } from '../components/icons';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import {
  SubmissionApiError,
  formatRemaining,
  getLimitStatus,
  submitIdea,
  submitStory,
  uploadMedia,
} from '../content/submissions';
import { validateIdeaSubmission, validateStorySubmission } from '../lib/validate';
import { effectiveContentApiBaseUrl } from '../content/api';
import {
  canAddGalleryImage,
  ImagePickError,
  pickImage,
  type PickedImage,
} from '../lib/imagePicker';

interface MediaDraft {
  uri: string;
  name: string;
  size: number;
  ref: string | null;
  uploading: boolean;
  error: string | null;
  kind?: StoryMediaKind;
}

const KIND_CYCLE: StoryMediaKind[] = ['character-portrait', 'scene', 'other'];
const KIND_LABEL: Record<StoryMediaKind, string> = {
  cover: 'Cover',
  'character-portrait': 'Portrait',
  scene: 'Scene',
  other: 'Other',
};

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

  const [creatorName, setCreatorName] = useState(profile?.nickname ?? '');
  const [title, setTitle] = useState('');
  const [concept, setConcept] = useState('');
  const [genre, setGenre] = useState('Romance');
  const [characters, setCharacters] = useState('');
  const [notes, setNotes] = useState('');

  const [storyDescription, setStoryDescription] = useState('');
  const [storyAgeRating, setStoryAgeRating] = useState<'12-17' | '18+'>('12-17');
  const [storyId, setStoryId] = useState('');
  const [storyContent, setStoryContent] = useState('');

  const [jsonText, setJsonText] = useState('');

  const [cover, setCover] = useState<MediaDraft | null>(null);
  const [gallery, setGallery] = useState<MediaDraft[]>([]);
  const [preview, setPreview] = useState<{ uri: string; label: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<{ remaining: number; resetsAt: number } | null>(null);

  const uploadPicked = useCallback(
    async (picked: PickedImage, slot: 'cover' | number): Promise<void> => {
      if (slot === 'cover') {
        setCover({ uri: picked.uri, name: picked.name, size: picked.size, ref: null, uploading: true, error: null });
      }
      try {
        const kind = slot === 'cover' ? 'cover' : 'gallery';
        const res = await uploadMedia(kind, picked.base64, apiBase);
        if (slot === 'cover') {
          setCover({ uri: picked.uri, name: picked.name, size: picked.size, ref: res.ref, uploading: false, error: null });
        } else {
          setGallery((g) => g.map((it, i) => (i === slot ? { ...it, ref: res.ref, uploading: false, error: null } : it)));
        }
      } catch (e) {
        const msg = e instanceof SubmissionApiError ? e.message : 'Upload failed. Try again.';
        if (slot === 'cover') setCover({ uri: picked.uri, name: picked.name, size: picked.size, ref: null, uploading: false, error: msg });
        else setGallery((g) => g.map((it, i) => (i === slot ? { ...it, ref: null, uploading: false, error: msg } : it)));
      }
    },
    [apiBase],
  );

  async function pickCover() {
    let picked: PickedImage;
    try {
      picked = await pickImage();
    } catch (e) {
      if (e instanceof ImagePickError && e.code !== 'cancelled') Alert.alert('Cover image', e.message);
      return;
    }
    void uploadPicked(picked, 'cover');
  }

  async function addGalleryImage() {
    const totalBytes = gallery.reduce((a, g) => a + g.size, 0);
    const gate = canAddGalleryImage(gallery.length, totalBytes);
    if (!gate.ok) {
      Alert.alert('Media gallery', gate.reason ?? 'Limit reached.');
      return;
    }
    let picked: PickedImage;
    try {
      picked = await pickImage();
    } catch (e) {
      if (e instanceof ImagePickError && e.code !== 'cancelled') Alert.alert('Gallery image', e.message);
      return;
    }
    const slot = gallery.length;
    setGallery((g) => [
      ...g,
      { uri: picked.uri, name: picked.name, size: picked.size, ref: null, uploading: true, error: null },
    ]);
    void uploadPicked(picked, slot);
  }

  function replaceGalleryImage(slot: number) {
    void (async () => {
      let picked: PickedImage;
      try {
        picked = await pickImage();
      } catch (e) {
        if (e instanceof ImagePickError && e.code !== 'cancelled') Alert.alert('Gallery image', e.message);
        return;
      }
      setGallery((g) => g.map((it, i) => (i === slot ? { uri: picked.uri, name: picked.name, size: picked.size, ref: null, uploading: true, error: null } : it)));
      void uploadPicked(picked, slot);
    })();
  }

  function removeGalleryImage(slot: number) {
    setGallery((g) => g.filter((_, i) => i !== slot));
  }

  function cycleGalleryKind(slot: number) {
    setGallery((g) =>
      g.map((it, i) => {
        if (i !== slot) return it;
        const cur = it.kind ?? 'character-portrait';
        const idx = KIND_CYCLE.indexOf(cur);
        const next = KIND_CYCLE[(idx + 1) % KIND_CYCLE.length];
        return { ...it, kind: next };
      }),
    );
  }

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
        backgroundColor: withAlpha(theme.surface, 0.94),
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
      Alert.alert('Story validation failed', v.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      return;
    }
    setLoading(true);
    try {
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
        await recordLocalSubmission({
          id: res.id,
          type: 'story',
          creatorName: v.cleaned.creatorName,
          title: v.cleaned.title,
        });
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
    }
  }

  async function handleSubmitStoryForm() {
    if (!cover) {
      Alert.alert('Cover image required', 'Pick a cover image for your story before submitting.');
      return;
    }
    if (cover.uploading || !cover.ref) {
      Alert.alert('Cover still uploading', 'Wait for the cover image upload to complete.');
      return;
    }
    const stillUploading = gallery.some((g) => g.uploading || !g.ref);
    if (stillUploading) {
      Alert.alert('Gallery images uploading', 'Wait for all gallery images to finish uploading.');
      return;
    }

    let parsedContent: { scenes?: unknown[]; characters?: unknown; world?: unknown; memory?: unknown } = {};
    if (storyContent.trim()) {
      try {
        parsedContent = JSON.parse(storyContent);
      } catch {
        Alert.alert('Invalid Story Content JSON', 'The story content JSON could not be parsed.');
        return;
      }
    }

    const mediaGallery = [
      { id: 'cover', file: cover.ref, kind: 'cover' as const, label: 'Cover' },
      ...gallery.map((g, i) => ({
        id: `img-${i + 1}`,
        file: g.ref!,
        kind: g.kind ?? ('character-portrait' as const),
        label: KIND_LABEL[g.kind ?? 'character-portrait'],
      })),
    ];

    const payload = {
      story: {
        id: storyId.trim(),
        title: title.trim(),
        description: storyDescription.trim(),
        genres: [genre],
        tags: [],
        ageRating: storyAgeRating,
        contentLevel: (storyAgeRating === '18+' ? 'mature' : 'teen') as 'mature' | 'teen',
        language: 'hinglish' as const,
        version: 1,
        openingSceneId: 's1',
        setting: '',
        userRole: '',
        tone: '',
        safetyNotes: [],
        media: {
          cover: cover.ref,
          gallery: mediaGallery,
        },
      },
      creator: { name: creatorName.trim() },
      characters: parsedContent.characters ?? { storyId: storyId.trim(), version: 1, characters: [] },
      world: parsedContent.world ?? { storyId: storyId.trim(), version: 1, premise: '', locations: [], factions: [], lore: [], rules: [], importantObjects: [], timeline: [] },
      scenes: parsedContent.scenes ?? { storyId: storyId.trim(), version: 1, scenes: [{ id: 's1', title: 'Start', narration: ['Story begins…'], choices: [] }], endings: [] },
      memory: parsedContent.memory ?? { storyId: storyId.trim(), version: 1, shortTermWindow: 12, seedMemories: [], extractionHints: [], neverRemember: [] },
    };

    const v = validateStorySubmission(payload);
    if (!v.ok || !v.cleaned) {
      Alert.alert('Story validation failed', v.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      return;
    }
    setLoading(true);
    try {
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
    }
  }

  const mediaSection = (
    <>
      <SectionHeader title="Media Library (Cover & Gallery)" kicker="Artworks" />
      <Text style={[styles.hint, { color: theme.textFaint }]}>
        Cover is required (PNG/JPEG/WebP, ≤ 5 MB). Gallery is optional (up to 8 images).
      </Text>

      {label('Cover Image *')}
      <View style={[styles.mediaCard, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }]}>
        {cover ? (
          <View style={styles.coverBox}>
            <NaturalImage source={{ uri: cover.uri }} style={styles.coverPreview} />
            {cover.uploading ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.uploadOverlayText, { color: '#fff' }]}>Uploading cover…</Text>
              </View>
            ) : null}
            <View style={styles.mediaMeta}>
              <Text style={[styles.mediaMetaText, { color: theme.textDim }]} numberOfLines={1}>
                {cover.name} ({Math.round(cover.size / 1024)} KB)
              </Text>
              <Text style={{ color: cover.ref ? theme.success : theme.danger, fontSize: FONTS.tiny, fontWeight: '800' }}>
                {cover.ref ? 'Uploaded' : cover.error ?? 'Upload failed'}
              </Text>
            </View>
            <View style={styles.mediaActions}>
              <Pressable onPress={pickCover} style={[styles.mediaBtn, { borderColor: theme.border }]}>
                <Text style={[styles.mediaBtnText, { color: theme.text }]}>Replace</Text>
              </Pressable>
              <Pressable onPress={() => setPreview({ uri: cover.uri, label: 'Cover' })} style={[styles.mediaBtn, { borderColor: theme.border }]}>
                <Text style={[styles.mediaBtnText, { color: theme.text }]}>Preview</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={pickCover} style={styles.coverEmpty}>
            <Icon name="image-outline" size={26} color={theme.textFaint} />
            <Text style={[styles.coverEmptyTitle, { color: theme.text }]}>Pick Cover Image</Text>
            <Text style={[styles.coverEmptySub, { color: theme.textFaint }]}>PNG, JPEG, WebP (up to 5 MB)</Text>
          </Pressable>
        )}
      </View>

      {label(`Gallery (${gallery.length}/8 images)`)}
      <View style={styles.galleryGrid}>
        {gallery.map((g, slot) => (
          <View key={g.uri + slot} style={[styles.galleryTile, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}>
            <NaturalImage source={{ uri: g.uri }} style={styles.galleryThumb} />
            {g.uploading ? (
              <View style={styles.galleryOverlay}>
                <ActivityIndicator size="small" color={theme.accent} />
              </View>
            ) : null}
            <Pressable onPress={() => cycleGalleryKind(slot)} style={[styles.kindChip, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
              <Text style={[styles.kindChipText, { color: theme.accent }]}>{KIND_LABEL[g.kind ?? 'character-portrait']}</Text>
            </Pressable>
            <Pressable onPress={() => removeGalleryImage(slot)} style={[styles.removeChip, { backgroundColor: 'rgba(0,0,0,0.78)' }]}>
              <Icon name="close" size={12} color={theme.danger} />
            </Pressable>
          </View>
        ))}

        {gallery.length < 8 ? (
          <Pressable onPress={addGalleryImage} style={[styles.galleryAdd, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface, 0.6) }]}>
            <Icon name="add" size={18} color={theme.accent} />
            <Text style={[styles.galleryAddText, { color: theme.textDim }]}>Add image</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Icon name="chevron-back" size={16} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={[styles.kicker, { color: theme.accent }]}>CREATOR STUDIO</Text>
            <Text style={[styles.heading, { color: theme.text }]}>
              {mode === 'idea' ? 'Suggest an Idea' : 'Submit a Story'}
            </Text>
          </View>

          <Text style={[styles.subheading, { color: theme.textDim }]}>
            {mode === 'idea'
              ? 'Have a compelling concept for an interactive story? Send your idea to the Kissa curation team.'
              : 'Submit a complete interactive story package. Review within 24 hours.'}
          </Text>

          <View style={[styles.limitBox, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }]}>
            <Text style={[styles.limitText, { color: theme.accent }]}>{limitLabel}</Text>
          </View>

          {/* Mode Selector */}
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setMode('idea')}
              style={[styles.tab, { backgroundColor: mode === 'idea' ? theme.primary : 'transparent', borderColor: theme.border }]}
            >
              <Text style={{ color: mode === 'idea' ? '#fff' : theme.textDim, fontWeight: '800' }}>Suggest an Idea</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('story')}
              style={[styles.tab, { backgroundColor: mode === 'story' ? theme.primary : 'transparent', borderColor: theme.border }]}
            >
              <Text style={{ color: mode === 'story' ? '#fff' : theme.textDim, fontWeight: '800' }}>Full Story</Text>
            </Pressable>
          </View>

          {label('Your creator name *')}
          <TextInput style={fieldStyle()} placeholder="Name / Pen Name" placeholderTextColor={theme.textFaint} value={creatorName} onChangeText={setCreatorName} />

          {mode === 'idea' ? (
            <>
              {label('Story title *')}
              <TextInput style={fieldStyle()} placeholder="Title of your story concept" placeholderTextColor={theme.textFaint} value={title} onChangeText={setTitle} />
              {label('Genre *')}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {GENRES.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGenre(g)}
                    style={[styles.pill, { backgroundColor: genre === g ? theme.primary : withAlpha(theme.surface, 0.9), borderColor: theme.border }]}
                  >
                    <Text style={{ color: genre === g ? '#fff' : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>{g}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {label('Concept / Plot hook *')}
              <TextInput style={fieldStyle(true)} placeholder="What is the story premise? What role does the player have?" placeholderTextColor={theme.textFaint} value={concept} onChangeText={setConcept} multiline />
              {label('Main Characters (optional)')}
              <TextInput style={fieldStyle()} placeholder="Names and personalities" placeholderTextColor={theme.textFaint} value={characters} onChangeText={setCharacters} />
              {label('Additional notes (optional)')}
              <TextInput style={fieldStyle()} placeholder="Tones, endings, branch ideas…" placeholderTextColor={theme.textFaint} value={notes} onChangeText={setNotes} />
              <View style={{ height: SPACING.xl }} />
              <GradientButton title={loading ? 'Submitting…' : 'Send Idea'} onPress={handleSubmitIdea} disabled={loading} loading={loading} />
            </>
          ) : (
            <>
              {/* Story mode sub-tabs: Form vs JSON */}
              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => setStoryMode('form')}
                  style={[styles.subTab, { borderColor: storyMode === 'form' ? theme.accent : theme.border, backgroundColor: storyMode === 'form' ? theme.primarySoft : 'transparent' }]}
                >
                  <Text style={{ color: storyMode === 'form' ? theme.accent : theme.textDim, fontSize: FONTS.small, fontWeight: '800' }}>Guided Form</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStoryMode('json')}
                  style={[styles.subTab, { borderColor: storyMode === 'json' ? theme.accent : theme.border, backgroundColor: storyMode === 'json' ? theme.primarySoft : 'transparent' }]}
                >
                  <Text style={{ color: storyMode === 'json' ? theme.accent : theme.textDim, fontSize: FONTS.small, fontWeight: '800' }}>JSON Editor</Text>
                </Pressable>
              </View>

              {storyMode === 'form' ? (
                <>
                  <SectionHeader title="Story Details" kicker="Form" />
                  {label('Story ID (slug, e.g. mumbai-nights)')}
                  <TextInput style={fieldStyle()} placeholder="mumbai-nights" placeholderTextColor={theme.textFaint} value={storyId} onChangeText={(t) => setStoryId(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
                  {label('Title *')}
                  <TextInput style={fieldStyle()} placeholder="Title" placeholderTextColor={theme.textFaint} value={title} onChangeText={setTitle} />
                  {label('Description *')}
                  <TextInput style={fieldStyle(true)} placeholder="Short intriguing hook and synopsis" placeholderTextColor={theme.textFaint} value={storyDescription} onChangeText={setStoryDescription} multiline />
                  {label('Genre *')}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {GENRES.map((g) => (
                      <Pressable key={g} onPress={() => setGenre(g)} style={[styles.pill, { backgroundColor: genre === g ? theme.primary : withAlpha(theme.surface, 0.9), borderColor: theme.border }]}>
                        <Text style={{ color: genre === g ? '#fff' : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>{g}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {label('Age Rating')}
                  <View style={styles.tabRow}>
                    <Pressable onPress={() => setStoryAgeRating('12-17')} style={[styles.subTab, { borderColor: storyAgeRating === '12-17' ? theme.accent : theme.border }]}>
                      <Text style={{ color: storyAgeRating === '12-17' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>12–17</Text>
                    </Pressable>
                    <Pressable onPress={() => setStoryAgeRating('18+')} style={[styles.subTab, { borderColor: storyAgeRating === '18+' ? theme.accent : theme.border }]}>
                      <Text style={{ color: storyAgeRating === '18+' ? theme.text : theme.textDim, fontSize: FONTS.small, fontWeight: '700' }}>18+</Text>
                    </Pressable>
                  </View>
                  {label('Story Content (JSON: scenes, characters, world, memory)')}
                  <TextInput style={[fieldStyle(true), { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} placeholder='{"scenes": [...], "characters": {...}}' placeholderTextColor={theme.textFaint} value={storyContent} onChangeText={setStoryContent} multiline autoCapitalize="none" autoCorrect={false} />
                  {mediaSection}
                  <View style={{ height: SPACING.xl }} />
                  <GradientButton title={loading ? 'Submitting…' : 'Submit Story Package'} onPress={handleSubmitStoryForm} disabled={loading} loading={loading} />
                </>
              ) : (
                <>
                  <SectionHeader title="JSON Editor" kicker="Full Schema" />
                  <Text style={[styles.hint, { color: theme.textFaint }]}>
                    Paste complete Kissa story JSON. Required keys: story (with id, title, ageRating, contentLevel, openingSceneId), characters, world, scenes, memory, creator.name.
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
                  {mediaSection}
                  <View style={{ height: SPACING.xl }} />
                  <GradientButton title={loading ? 'Validating & submitting…' : 'Submit JSON Story'} onPress={handleSubmitStoryJson} disabled={loading} loading={loading} />
                </>
              )}
            </>
          )}

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)} accessibilityLabel="Close preview">
          {preview ? <NaturalImage source={{ uri: preview.uri }} style={styles.previewImage} /> : null}
          {preview ? <Text style={[styles.previewLabel, { color: '#fff' }]}>{preview.label}</Text> : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  back: { paddingVertical: 8, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 17, fontWeight: '700' },
  header: { paddingTop: 2, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 2 },
  heading: { ...TYPE.title, marginTop: 2 },
  subheading: { fontSize: FONTS.body, lineHeight: 21, marginTop: 6 },
  limitBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 14 },
  limitText: { fontSize: FONTS.small, fontWeight: '800', textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md, marginBottom: SPACING.sm },
  tab: { flex: 1, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 10, alignItems: 'center' },
  subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FONTS.body,
    marginBottom: 10,
  },
  label: { fontSize: FONTS.small, fontWeight: '700', marginBottom: 6, marginTop: 6 },
  hint: { fontSize: FONTS.small, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  pill: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  mediaCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, marginTop: 4 },
  coverBox: { borderRadius: RADIUS.md, overflow: 'hidden' },
  coverPreview: { width: '100%' },
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  uploadOverlayText: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  coverEmpty: { alignItems: 'center', paddingVertical: 28, borderRadius: RADIUS.md },

  coverEmptyTitle: { fontSize: FONTS.body, fontWeight: '800', marginTop: 8 },
  coverEmptySub: { fontSize: FONTS.tiny, marginTop: 4 },
  mediaMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  mediaMetaText: { fontSize: FONTS.tiny, flex: 1 },
  mediaActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  mediaBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 9, alignItems: 'center' },
  mediaBtnText: { fontSize: FONTS.small, fontWeight: '800' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  galleryTile: { width: '31%', borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1 },
  galleryThumb: { width: '100%' },
  kindChip: { position: 'absolute', top: 6, left: 6, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  kindChipText: { fontSize: 10, fontWeight: '800' },
  removeChip: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  galleryOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  galleryAdd: { width: '31%', minHeight: 108, borderRadius: RADIUS.md, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  galleryAddText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', maxHeight: '82%' },
  previewLabel: { fontSize: FONTS.body, fontWeight: '700', marginTop: 10 },
});
