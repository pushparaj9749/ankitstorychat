/**
 * Jest stub for @expo/vector-icons (wired via jest.config.js moduleNameMapper,
 * because the icon-font package ships as ESM and is visual-only).
 * Renders a plain element so component tests can run without font loading.
 */
import React from 'react';

export const Ionicons = (props: any) => React.createElement('Ionicons', props, null);
