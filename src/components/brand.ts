/**
 * KISSA v2.4.2 — Brand assets.
 * The official Kissa logo (golden storybook + chat-bubble mark on the
 * signature violet gradient). Single source of truth so every branded
 * surface (home header, splash, onboarding, about) uses the real asset
 * at the correct aspect ratio — never a placeholder mark.
 */
export const KISSA_LOGO = require('../../assets/icon.png');

/**
 * Front-door poster (v2.17.0).
 *
 * A bundled asset, not a remote URL: the first screen a reader ever sees must
 * paint instantly and work offline. 1120×2240 (2:1 of a phone), generated for
 * Kissa — dark top and bottom thirds so the headline and the form panel sit on
 * shadow, neon through the middle.
 */
export const LOGIN_POSTER = require('../../assets/login-poster.jpg');
