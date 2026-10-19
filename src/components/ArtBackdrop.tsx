/**
 * ArtBackdrop — fills an art frame with an ambient, out-of-focus wash of
 * the SAME artwork, so the space around a contain-fitted cover is never an
 * empty band.
 *
 * Copyright/artwork rule still holds: the real cover is rendered on top by
 * NaturalImage/CoverImage — whole, uncropped, undistorted, at its own ratio.
 * This layer is decoration only: an out-of-focus colour field, never a
 * readable version of the art.
 *
 * v2.6.1 performance: the wash used to be a full-frame <Image blurRadius>.
 * On Android that decodes the full-size cover a second time and runs a CPU
 * blur on it — once per card, on every mount — which made scrolling janky.
 * The wash is now a MICRO image: a 16×24 view (decoded at that size via
 * `resizeMethod="resize"`; every cover is JPEG) with a tiny blur, scaled up
 * with a GPU transform. Upscaling a 16×24 bitmap is itself a smooth blur, so
 * the look is the same at a small fraction of the decode/blur/memory cost.
 * It is memoised, so parent re-renders never touch it.
 */
import React, { memo } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { withAlpha } from '../theme';

/** Micro bitmap size (dp). Tiny on purpose — see header. */
const MICRO_W = 16;
const MICRO_H = 24;
/** 16×24 × 40 = 640×960 dp: covers the largest frame (hero) with margin. */
const MICRO_SCALE = 40;

function ArtBackdropImpl({
  source,
  accentColor,
  blur = 28,
  dim = 0.32,
}: {
  source: ImageSourcePropType | null | undefined;
  accentColor?: string;
  /**
   * Softness of the wash (kept for API compatibility). Scaled down to the
   * micro bitmap, where any radius is cheap.
   */
  blur?: number;
  /** Strength of the dark scrim over the wash (keeps the real art in focus). */
  dim?: number;
}) {
  const accent = accentColor ?? '#9A9CC4';
  // A radius of 1–2px on the 16×24 bitmap ≈ 40–80px at full size.
  const microBlur = Math.max(1, Math.min(2, Math.round(blur / 18)));
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(accent, 0.22) }]} />
      {source ? (
        <Image
          source={source}
          blurRadius={microBlur}
          // Stretched + blurred into a soft colour field (decoration, not art).
          resizeMode="stretch"
          resizeMethod="resize"
          fadeDuration={0}
          style={styles.wash}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(10,11,16, ${dim})` }]} />
    </View>
  );
}

export const ArtBackdrop = memo(ArtBackdropImpl, (a, b) => {
  const ka = a.source && typeof a.source === 'object' && 'uri' in a.source ? a.source.uri : a.source;
  const kb = b.source && typeof b.source === 'object' && 'uri' in b.source ? b.source.uri : b.source;
  return ka === kb && a.accentColor === b.accentColor && a.blur === b.blur && a.dim === b.dim;
});

const styles = StyleSheet.create({
  // Clip here so the scaled-up wash can never bleed onto neighbours.
  clip: { overflow: 'hidden' },
  // Centred micro bitmap, scaled up on the GPU to cover the whole frame.
  wash: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: MICRO_W,
    height: MICRO_H,
    marginLeft: -MICRO_W / 2,
    marginTop: -MICRO_H / 2,
    opacity: 0.95,
    transform: [{ scale: MICRO_SCALE }],
  },
});
