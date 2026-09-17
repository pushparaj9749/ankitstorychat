/**
 * Submit a Story / Suggest an Idea — user-facing form.
 *
 * Two modes:
 *   - "idea" :  simple 5-field form (creator, title, concept, genre, characters, notes).
 *   - "story":  full submission. Users can toggle between a guided form and a
 *               JSON editor. Both modes POST to the same Worker endpoint after
 *               client-side validation.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  uploadMedia,
} from '../content/submissions';
import { validateIdeaSubmission, validateStorySubmission } from '../lib/validate';
import { effectiveContentApiBaseUrl } from '../content/api';
import {
  canAddGalleryImage,
  ImagePickError,
  MAX_GALLERY_IMAGES,
  pickImage,
  type PickedImage,
} from '../lib/imagePicker';

/** A locally-prepared media upload: picked file + server ref once uploaded. */
interface MediaDraft {
  /** Local preview URI. */
  uri: string;
  name: string;
  size: number;
  /** Server-issued safe ref (`media/<id>`); null while uploading. */
  ref: string | null;
  uploading: boolean;
  error: string | null;
  /** Gallery only — what this image depicts (display metadata). */
  kind?: StoryMediaKind;
}

const KIND_CYCLE: StoryMediaKind[] = ['character-portrait', 'scene', 'other'];
const KIND_LABEL: Record<StoryMediaKind, string> = {
  cover: 'Cover',
  'character-portrait': '👤 Portrait',
  scene: '🎬 Scene',
  other: '✨ Other',
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

  // Media (cover + gallery) — story mode only
  const [cover, setCover] = useState<MediaDraft | null>(null);
  const [gallery, setGallery] = useState<MediaDraft[]>([]);
  const [preview, setPreview] = useState<{ uri: string; label: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState<{ remaining: number; resetsAt: number } | null>(null);

  /* ---------------- media upload flow ---------------- */

  /**
   * Upload a picked image. For the cover slot this also seeds the draft;
   * gallery drafts are seeded by the caller (which knows the slot index).
   */
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

  /** Cycle a gallery image's display kind (portrait → scene → other). */
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
      // The cleaned bundle already carries the sanitised creator (verified=false).
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
    // Cover is mandatory for complete stories.
    if (!cover?.ref) {
      Alert.alert('Cover required', 'Add a cover image first — it is required for every complete story.', [
        { text: 'OK' },
        { text: 'Choose cover', onPress: () => void pickCover() },
      ]);
      return;
    }
    if (cover.uploading || gallery.some((g) => g.uploading)) {
      Alert.alert('Almost there', 'Your images are still uploading — one moment…');
      return;
    }
    if (cover.error || gallery.some((g) => g.error)) {
      Alert.alert('Image problem', 'One of your images failed to upload. Replace or remove it and try again.');
      return;
    }
    let content: Record<string, unknown> = {};
    if (storyContent.trim()) {
      try {
        const parsed: unknown = JSON.parse(storyContent);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        content = parsed as Record<string, unknown>;
      } catch {
        Alert.alert('Invalid story content JSON', 'The "Story content" field must be a JSON object (scenes, characters, world, memory).');
        return;
      }
    }
    // The content JSON may hold story-level details under `story` and the
    // remaining bundle files at the top level (scenes/characters/world/memory).
    const storyContentOver = (content.story ?? {}) as Record<string, unknown>;
    // Media Library: cover first, then the gallery (safe server refs only).
    const media = {
      cover: cover.ref,
      gallery: [
        { id: 'cover', file: cover.ref, kind: 'cover' as const, label: 'Cover' },
        ...gallery.map((g, i) => ({
          id: `img-${i + 1}`,
          file: g.ref as string,
          kind: (g.kind ?? 'other') as StoryMediaKind,
        })),
      ],
    };
    // Free-form "story content" may fill scene/character/world/memory details
    // but must NOT override media / creator / age — those are assembled here
    // and are authoritative (the server re-validates everything).
    const storyFields: Record<string, unknown> = {
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
    };
    Object.assign(storyFields, storyContentOver);
    // Authoritative fields last so the free-form JSON cannot weaken them.
    storyFields.ageRating = storyAgeRating;
    storyFields.contentLevel = storyAgeRating === '18+' ? 'mature' : 'teen';
    storyFields.media = media;
    storyFields.creator = { name: creatorName.trim(), avatar: null, verified: false };

    const payload: Record<string, unknown> = {
      creator: { name: creatorName.trim(), avatar: null, verified: false },
      story: storyFields,
      ...(typeof content.characters === 'object' && content.characters ? { characters: content.characters } : {}),
      ...(typeof content.world === 'object' && content.world ? { world: content.world } : {}),
      ...(typeof content.scenes === 'object' && content.scenes ? { scenes: content.scenes } : {}),
      ...(typeof content.memory === 'object' && content.memory ? { memory: content.memory } : {}),
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
          bundle: {
            story: payload.story as Record<string, unknown>,
            ...(typeof payload.characters === 'object' && payload.characters ? { characters: payload.characters as Record<string, unknown> } : {}),
            ...(typeof payload.world === 'object' && payload.world ? { world: payload.world as Record<string, unknown> } : {}),
            ...(typeof payload.scenes === 'object' && payload.scenes ? { scenes: payload.scenes as Record<string, unknown> } : {}),
            ...(typeof payload.memory === 'object' && payload.memory ? { memory: payload.memory as Record<string, unknown> } : {}),
          },
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

  /* ---------------- media section (cover + gallery) ---------------- */

  const uploadedRefs = [
    ...(cover?.ref ? [{ label: 'Cover', ref: cover.ref }] : []),
    ...gallery.map((g, i) => ({ label: `Gallery ${i + 1}`, ref: g.ref })),
  ].filter((x) => !!x.ref);

  const mediaSection = (
    <>
      <SectionHeader title="Cover Image" action="required" />
      <View style={[styles.mediaCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {cover ? (
          <View>
            <View style={styles.coverBox}>
              <Image source={{ uri: cover.uri }} style={styles.coverPreview} resizeMode="cover" />
              {cover.uploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={[styles.uploadOverlayText, { color: '#fff', marginTop: 6 }]}>Uploading…</Text>
                </View>
              ) : null}
              {cover.error && !cover.uploading ? (
                <View style={[styles.uploadOverlay, { backgroundColor: 'rgba(127,29,29,0.88)' }]}>
                  <Text style={[styles.uploadOverlayText, { color: '#FECACA' }]} numberOfLines={3}>
                    ⚠ {cover.error}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.mediaMeta}>
              <Text style={[styles.mediaMetaText, { color: theme.textDim }]} numberOfLines={1}>
                {cover.name} • {(cover.size / 1024 / 1024).toFixed(1)} MB
              </Text>
              <Text style={[styles.mediaMetaText, { color: cover.ref ? theme.success : theme.textFaint }]}>
                {cover.uploading ? 'uploading…' : cover.ref ? `✓ ${cover.ref}` : 'not uploaded'}
              </Text>
            </View>
            <View style={styles.mediaActions}>
              <Pressable onPress={() => void pickCover()} style={[styles.mediaBtn, { borderColor: theme.border }]}>
                <Text style={[styles.mediaBtnText, { color: theme.text }]}>Replace</Text>
              </Pressable>
              <Pressable onPress={() => setCover(null)} style={[styles.mediaBtn, { borderColor: theme.border }]}>
                <Text style={[styles.mediaBtnText, { color: theme.danger }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => void pickCover()} style={[styles.coverEmpty, { borderColor: theme.border, borderStyle: 'dashed' }]}>
            <Text style={styles.coverEmptyEmoji}>🖼️</Text>
            <Text style={[styles.coverEmptyTitle, { color: theme.text }]}>Choose cover image</Text>
            <Text style={[styles.coverEmptySub, { color: theme.textFaint }]}>JPG, PNG or WebP • max 3 MB</Text>
          </Pressable>
        )}
      </View>

      <SectionHeader title={`Media Gallery (${gallery.length}/${MAX_GALLERY_IMAGES})`} />
      <Text style={[styles.hint, { color: theme.textFaint, marginBottom: 8 }]}>
        Character portraits, scene stills, other story images. Up to {MAX_GALLERY_IMAGES} images • 3 MB each.
        Tap to preview • tap the chip to change type • long-press to replace.
      </Text>
      <View style={styles.galleryGrid}>
        {gallery.map((it, i) => (
          <Pressable
            key={`${it.uri}-${i}`}
            style={[styles.galleryTile, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}
            onPress={() => setPreview({ uri: it.uri, label: `${KIND_LABEL[it.kind ?? 'other']} • image ${i + 1}` })}
            onLongPress={() => replaceGalleryImage(i)}
            accessibilityLabel={`Gallery image ${i + 1}`}
          >
            <Image source={{ uri: it.uri }} style={styles.galleryThumb} resizeMode="cover" />
            <Pressable
              onPress={() => cycleGalleryKind(i)}
              style={[styles.kindChip, { backgroundColor: 'rgba(0,0,0,0.66)' }]}
              hitSlop={8}
            >
              <Text style={[styles.kindChipText, { color: theme.accent }]}>{KIND_LABEL[it.kind ?? 'character-portrait']}</Text>
            </Pressable>
            <Pressable
              onPress={() => removeGalleryImage(i)}
              style={[styles.removeChip, { backgroundColor: 'rgba(127,29,29,0.8)' }]}
              hitSlop={8}
            >
              <Text style={[styles.removeChipText, { color: '#fff' }]}>✕</Text>
            </Pressable>
            {it.uploading ? (
              <View style={styles.galleryOverlay}>
                <ActivityIndicator size="small" color={theme.accent} />
              </View>
            ) : null}
            {it.error && !it.uploading ? (
              <View style={[styles.galleryOverlay, { backgroundColor: 'rgba(127,29,29,0.85)' }]}>
                <Text style={{ color: '#FECACA', fontSize: 10, fontWeight: '800' }} numberOfLines={2}>⚠ failed — long-press to retry</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
        {gallery.length < MAX_GALLERY_IMAGES ? (
          <Pressable
            onPress={() => void addGalleryImage()}
            style={[styles.galleryAdd, { borderColor: theme.border, borderStyle: 'dashed' }]}
            accessibilityLabel="Add gallery image"
          >
            <Text style={[styles.galleryAddPlus, { color: theme.textFaint }]}>＋</Text>
            <Text style={[styles.galleryAddText, { color: theme.textFaint }]}>Add image</Text>
          </Pressable>
        ) : null}
      </View>

      {uploadedRefs.length > 0 ? (
        <View style={[styles.refsBox, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}>
          <Text style={[styles.refsTitle, { color: theme.textDim }]}>Uploaded media refs (for JSON mode)</Text>
          {uploadedRefs.map((r) => (
            <Text key={r.ref} style={[styles.refsLine, { color: theme.textDim }]}>
              <Text style={{ color: theme.textFaint }}>{r.label}: </Text>
              <Text style={{ color: theme.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{r.ref}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );

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
                  {mediaSection}
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
                  <Text style={[styles.hint, { color: theme.textFaint }]}>
                    story.media is required: upload images below, then reference them as
                    {" "}<Text style={{ color: theme.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>media/&lt;id&gt;</Text>
                    {" "}in your JSON (e.g. story.media.cover and story.media.gallery[].file).
                  </Text>
                  {mediaSection}
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

      {/* Fullscreen image preview (cover + gallery). */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)} accessibilityLabel="Close preview">
          {preview ? (
            <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
          {preview ? (
            <Text style={[styles.previewLabel, { color: '#fff' }]}>{preview.label}</Text>
          ) : null}
        </Pressable>
      </Modal>
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
  /* ---------------- media (cover + gallery) ---------------- */
  mediaCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, marginTop: 2 },
  coverBox: { borderRadius: RADIUS.md, overflow: 'hidden', aspectRatio: 3 / 4, maxHeight: 320 },
  coverPreview: { width: '100%', height: '100%' },
  uploadOverlay: { ...{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  uploadOverlayText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  coverEmpty: { alignItems: 'center', paddingVertical: 28, borderRadius: RADIUS.md },
  coverEmptyEmoji: { fontSize: 34 },
  coverEmptyTitle: { fontSize: FONTS.body, fontWeight: '800', marginTop: 8 },
  coverEmptySub: { fontSize: FONTS.tiny, marginTop: 4 },
  mediaMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  mediaMetaText: { fontSize: FONTS.tiny, flex: 1 },
  mediaActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  mediaBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  mediaBtnText: { fontSize: FONTS.small, fontWeight: '800' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryTile: { width: '31%', aspectRatio: 3 / 4, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1 },
  galleryThumb: { width: '100%', height: '100%' },
  kindChip: { position: 'absolute', top: 6, left: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  kindChipText: { fontSize: 10, fontWeight: '800' },
  removeChip: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  removeChipText: { fontSize: 11, fontWeight: '900' },
  galleryOverlay: { ...{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  galleryAdd: { width: '31%', aspectRatio: 3 / 4, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  galleryAddPlus: { fontSize: 26, fontWeight: '300' },
  galleryAddText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  refsBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 12 },
  refsTitle: { fontSize: FONTS.tiny, fontWeight: '800', marginBottom: 6 },
  refsLine: { fontSize: FONTS.tiny, marginTop: 3 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '82%' },
  previewLabel: { fontSize: FONTS.body, fontWeight: '700', marginTop: 10 },
});
