/**
 * Story intro block that sits ABOVE the first story message in Chat.
 *
 * Why it exists: it is the "cover" of the story at the point where the chat
 * starts. Order, as the reader asked:
 *
 *   1. media carousel  — the author's gallery, swipeable
 *   2. play guide      — how the stage works
 *   3. intro           — title, tagline, who you are, what you decide
 *
 * v2.16.1: the Love/Hate meters used to open this block as a bar card. They are
 * gone from here — the narrator now writes one line ("❤️ 12/100 · 💔 88/100") at
 * the top of every reply and the bubble renders it just above itself (see
 * components/chat.tsx). So the images the author shipped are the first thing the
 * reader meets, and there is no second meter UI.
 */
import React, { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryBundle } from '../types';
import { ArtBackdrop } from './ArtBackdrop';
import { Icon, ICON_SIZE } from './icons';
import { withAlpha } from '../theme';

export type StoryIntroProps = {
  bundle: StoryBundle;
  /** Resolved media URI for a gallery item (already handles bundled vs remote). */
  imageUri: (file: string) => string | null;
  /** Player-facing text: player name interpolated, never the raw {{playerName}}. */
  forPlayer: (text: string) => string;
  /** Who the reader is in this story (story.userRole, already shortened). */
  roleText: string;
  theme: { text: string; textDim: string; textFaint: string; accent: string; primary: string; border: string; surface: string; gold: string };
  accentColor: string;
  onOpenMedia?: (file: string) => void;
};

const ASPECT = 0.72; // 4:3-ish portrait carousel card

export function StoryIntro({ bundle, imageUri, forPlayer, roleText, theme, accentColor, onOpenMedia }: StoryIntroProps) {
  // Module-level Dimensions (not a hook): the chat screen is already rendered
  // by suites that stub react-native with a minimal surface, so fall back.
  const width = Dimensions?.get?.('window')?.width ?? 390;
  const [mediaFailed, setMediaFailed] = useState<string | null>(null);

  const gallery = (bundle.story.media?.gallery ?? []).filter((g) => g.kind !== 'cover' && g.file);
  const cardW = Math.min(width * 0.62, 260);
  const cardH = Math.round(cardW / ASPECT);

  const guide = [
    { icon: 'chatbubble' as const, title: 'Aap likhte ho', body: 'Har message jaise chaaho — koi menu nahi, koi fixed jawab nahi.' },
    { icon: 'sparkles' as const, title: 'Kahani badalti hai', body: 'Aapke choices se rishta, mood aur mahaul badalte hain. Koi ending pehle se tay nahi.' },
    { icon: 'refresh' as const, title: 'Galti ho jaye to', body: 'Bubble ke ... se pichla turn wapas ja sakte ho, ya regenerate kar sakte ho.' },
  ];

  return (
    <View style={styles.wrap} testID="story-intro">
      {/* ------------------------------------------------ 1. media carousel */}
      {gallery.length > 0 ? (
        <View style={styles.mediaBlock} testID="story-media">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + 10}
            decelerationRate="fast"
            contentContainerStyle={styles.mediaRow}
          >
            {gallery.map((item) => {
              const uri = imageUri(item.file);
              const failed = mediaFailed === item.file || !uri;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onOpenMedia?.(item.file)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={item.label || 'Story artwork'}
                  style={[styles.mediaCard, { width: cardW, height: cardH, borderColor: theme.border, backgroundColor: withAlpha(accentColor, 0.14) }]}
                >
                  {!failed ? (
                    <ArtBackdrop source={{ uri: uri! }} accentColor={accentColor} blur={14} dim={0.25} />
                  ) : null}
                  {!failed ? (
                    <Image
                      source={{ uri: uri! }}
                      style={styles.mediaImg}
                      resizeMode="contain"
                      onError={() => setMediaFailed(item.file)}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.mediaFallback}>
                      <Icon name="image-outline" size={22} color={theme.textFaint} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.72)']}
                    style={styles.mediaFade}
                    pointerEvents="none"
                  />
                  {item.label ? (
                    <Text style={styles.mediaLabel} numberOfLines={1}>
                      {forPlayer(item.label)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.mediaHint, { color: theme.textFaint }]}>
            {`${gallery.length} tasveerein — side mein swipe karo`}
          </Text>
        </View>
      ) : null}

      {/* ------------------------------------------------ 2. play guide */}
      <View style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: theme.border }]} testID="story-guide">
        <View style={styles.guideHead}>
          <View style={[styles.guideIcon, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
            <Icon name="play" size={13} color={theme.primary} />
          </View>
          <Text style={[styles.guideTitle, { color: theme.text }]}>Kaise khelna hai</Text>
        </View>
        {guide.map((g) => (
          <View key={g.title} style={styles.guideRow}>
            <Icon name={g.icon} size={ICON_SIZE.sm} color={theme.accent} />
            <View style={styles.guideBody}>
              <Text style={[styles.guideRowTitle, { color: theme.text }]}>{g.title}</Text>
              <Text style={[styles.guideRowBody, { color: theme.textDim }]}>{g.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ------------------------------------------------ 4. intro */}
      <View style={styles.introBlock} testID="story-intro-text">
        <Text style={[styles.kicker, { color: theme.accent }]}>STORY SHURU</Text>
        <Text style={[styles.title, { color: theme.text }]}>{forPlayer(bundle.meta.title)}</Text>
        {bundle.meta.tagline ? (
          <Text style={[styles.tagline, { color: theme.textDim }]}>{forPlayer(bundle.meta.tagline)}</Text>
        ) : null}
        {roleText ? (
          <View style={styles.roleRow}>
            <Text style={[styles.roleKicker, { color: theme.textFaint }]}>AAP HO</Text>
            <Text style={[styles.roleText, { color: theme.textDim }]} numberOfLines={4}>
              {roleText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.ruleRow}>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        <Text style={[styles.ruleText, { color: theme.textFaint }]}>pehla mod</Text>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 2 },
  mediaBlock: { marginBottom: 14 },
  mediaRow: { gap: 10, paddingRight: 4 },
  mediaCard: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  mediaImg: { width: '100%', height: '100%' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  mediaFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  mediaLabel: { position: 'absolute', left: 10, right: 10, bottom: 9, color: '#F4F5F8', fontSize: 11.5, fontWeight: '600' },
  mediaHint: { marginTop: 7, fontSize: 10.5, letterSpacing: 0.2 },
  guideCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 9, marginBottom: 16 },
  guideHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 },
  guideIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  guideBody: { flex: 1, minWidth: 0 },
  guideRowTitle: { fontSize: 12, fontWeight: '700' },
  guideRowBody: { fontSize: 11.5, lineHeight: 16 },
  introBlock: { gap: 6, marginBottom: 12 },
  kicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  tagline: { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  roleRow: { gap: 2, marginTop: 2 },
  roleKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  roleText: { fontSize: 12, lineHeight: 17 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  ruleText: { fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
});
