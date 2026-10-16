/**
 * ArtBackdrop — fills an art frame with an ambient, heavily blurred wash of
 * the SAME artwork, so the space around a contain-fitted cover is never an
 * empty band.
 *
 * Copyright/artwork rule still holds: the real cover is rendered on top by
 * NaturalImage/CoverImage — whole, uncropped, undistorted, at its own ratio.
 * This layer is decoration only: an out-of-focus colour field (blurRadius +
 * dim scrim), never a readable version of the art.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { withAlpha } from '../theme';

export function ArtBackdrop({
  source,
  accentColor,
  blur = 28,
  dim = 0.32,
}: {
  source: ImageSourcePropType | null | undefined;
  accentColor?: string;
  /** Blur radius of the ambient wash. */
  blur?: number;
  /** Strength of the dark scrim over the wash (keeps the real art in focus). */
  dim?: number;
}) {
  const accent = accentColor ?? '#A855F7';
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(accent, 0.22) }]} />
      {source ? (
        <Image
          source={source}
          blurRadius={blur}
          // Stretched + blurred into a soft colour field (decoration, not art).
          resizeMode="stretch"
          style={styles.wash}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(11, 8, 20, ${dim})` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Clip here so the oversized, blurred wash can never bleed onto neighbours.
  clip: { overflow: 'hidden' },
  // Oversized so the blur's soft edge never shows inside the frame.
  wash: {
    position: 'absolute',
    top: '-12%',
    left: '-12%',
    width: '124%',
    height: '124%',
    opacity: 0.95,
  },
});
