/**
 * KISSA v2.4.2 — Icon System
 * One coherent icon family (Ionicons) across the entire app:
 * consistent stroke treatment, corner rounding, visual weight and sizing.
 * All icons render through this wrapper so size + color stay uniform and
 * theme-aware (clean on dark surfaces, no stray emoji or text glyphs).
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';
import { useApp } from '../state/AppContext';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Canonical icon sizes — use these everywhere for consistent weight/alignment. */
export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 30,
} as const;

export function Icon({
  name,
  size = ICON_SIZE.md,
  color,
  style,
  testID,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const { theme } = useApp();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? theme.textDim}
      style={style}
      testID={testID}
    />
  );
}
