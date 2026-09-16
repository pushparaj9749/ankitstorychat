/** Story cover: 3:4 portrait, cached, placeholder, failure fallback. */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { CoverSource } from '../content/loader';
import { RADIUS } from '../theme';

export const COVER_ASPECT = 3 / 4;

export function CoverImage({
  source,
  accentColor,
  style,
  fallbackLetter,
  wide,
}: {
  source: CoverSource | null;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  fallbackLetter?: string;
  /** Featured/hero only — keep the existing wide presentation. */
  wide?: boolean;
}) {
  const bundled = typeof source === 'number';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(bundled);

  useEffect(() => {
    setFailed(false);
    setLoaded(typeof source === 'number');
  }, [source]);

  const showImage = !!source && !failed;
  const letter = (fallbackLetter ?? '?').slice(0, 1).toUpperCase();

  return (
    <View
      style={[
        styles.wrap,
        wide ? undefined : { aspectRatio: COVER_ASPECT },
        { backgroundColor: `${accentColor ?? '#8B5CF6'}33` },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={source}
          style={styles.img}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      ) : (
        <Text style={[styles.fallback, { color: accentColor ?? '#8B5CF6' }]}>{letter}</Text>
      )}
      {showImage && !loaded ? <View style={styles.skeleton} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  img: { width: '100%', height: '100%' },
  fallback: { fontSize: 52, fontWeight: '900' },
  skeleton: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
