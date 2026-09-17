/**
 * Story cover — cached, placeholder, failure fallback.
 *
 * Renders at the artwork's OWN aspect ratio (see NaturalImage): covers ship as
 * 16:9, 3:2, 3:4, 2:3, 9:16 and more, so no fixed ratio is forced anywhere.
 * IMAGE RATIO = SOURCE IMAGE RATIO.
 */
import React from 'react';
import { StyleSheet, Text, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';
import type { CoverSource } from '../content/loader';
import { NaturalImage } from './NaturalImage';

export function CoverImage({
  source,
  accentColor,
  style,
  fallbackLetter,
  maxHeight,
  placeholderMinHeight,
}: {
  source: CoverSource | null;
  accentColor?: string;
  style?: StyleProp<ImageStyle>;
  fallbackLetter?: string;
  /**
   * Optional upper bound for bounded layouts. Contain-sized — the cover keeps
   * its own ratio and letterboxes; it is never cropped.
   */
  maxHeight?: number | `${number}%`;
  /** Letter/skeleton placeholder height when no artwork is available. Chrome only. */
  placeholderMinHeight?: number;
}) {
  const letter = (fallbackLetter ?? '?').slice(0, 1).toUpperCase();
  const accent = accentColor ?? '#8B5CF6';

  return (
    <NaturalImage
      source={source as ImageSourcePropType | null}
      style={style}
      maxHeight={maxHeight}
      placeholderMinHeight={placeholderMinHeight}
      tint={`${accent}33`}
      fallback={<Text style={[styles.fallback, { color: accent }]}>{letter}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { fontSize: 52, fontWeight: '900' },
});
