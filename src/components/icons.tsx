/**
 * KISSA v2.6 — Icon (theme-aware wrapper over the custom SVG set).
 *
 * All glyphs are drawn in ./iconGlyph ("Kissa Line": 24×24, rounded strokes,
 * `-outline` = line, plain name = duotone/solid). The public API (`Icon`,
 * `IconName`, `ICON_SIZE`) is unchanged, so every call site keeps working;
 * `IconName` is the exact set of drawn glyphs, so the type checker rejects any
 * icon the set does not contain.
 */
import React from 'react';
import { useApp } from '../state/AppContext';
import { IconGlyph, type IconProps } from './iconGlyph';

export { ICON_SIZE, IconGlyph, resolveIcon } from './iconGlyph';
export type { IconName, IconProps } from './iconGlyph';

/** Theme-aware icon (defaults to the theme's dim text colour). */
export function Icon(props: IconProps) {
  const { theme } = useApp();
  return <IconGlyph {...props} color={props.color ?? theme.textDim} />;
}
