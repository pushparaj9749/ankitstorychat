/**
 * Jest stub for react-native-svg (wired via jest.config.js moduleNameMapper).
 * Icons are visual-only; node-environment tests render plain host elements.
 */
import React from 'react';

const el = (tag: string) => (props: any) => React.createElement(tag, props, props.children);

const Svg = el('Svg');
export default Svg;
export { Svg };
export const Path = el('Path');
export const Circle = el('Circle');
export const Rect = el('Rect');
export const G = el('G');
export const Defs = el('Defs');
export const LinearGradient = el('LinearGradient');
export const RadialGradient = el('RadialGradient');
export const Stop = el('Stop');
