/**
 * Round story-creator avatar: bundled owner art, a story-local avatar from
 * the story API, or the name's first letter on a gradient (also the fallback
 * when the image cannot load, e.g. offline).
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryCreator } from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { resolveCreatorAvatar } from '../lib/creatorAvatar';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const OWNER_AVATAR = require('../../assets/creators/ankit.jpg');

export function CreatorAvatar({
  creator,
  storyDir,
  apiBase,
  colors,
  size = 48,
  ringColor,
}: {
  creator: StoryCreator;
  storyDir: string;
  apiBase: string;
  colors: readonly [string, string];
  size?: number;
  ringColor: string;
}) {
  const src = resolveCreatorAvatar(creator, storyDir, apiBase);
  const [failed, setFailed] = useState(false);
  const key = src.kind === 'remote' ? src.uri : src.kind;
  useEffect(() => setFailed(false), [key]);
  const box = { width: size, height: size, borderRadius: size / 2 };
  const letter = ((creator?.name ?? '').trim() || KISSA_OWNER_CREATOR.name)[0]?.toUpperCase() ?? '?';

  if (src.kind !== 'initial' && !failed) {
    return (
      <View style={[styles.ring, box, { borderColor: ringColor }]}>
        <Image
          source={src.kind === 'owner' ? OWNER_AVATAR : { uri: src.uri }}
          style={styles.fill}
          onError={() => setFailed(true)}
          accessibilityLabel={`${creator?.name ?? KISSA_OWNER_CREATOR.name} avatar`}
        />
      </View>
    );
  }
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.center, box]}>
      <Text style={[styles.letter, { fontSize: size * 0.37 }]}>{letter}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: { overflow: 'hidden', borderWidth: 1.5 },
  fill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '800', color: '#FFFFFF' },
});
