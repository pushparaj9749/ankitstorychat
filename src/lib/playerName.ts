/**
 * Runtime player-name interpolation.
 *
 * Story content refers to the reader with the `{{playerName}}` placeholder so
 * the locally stored nickname appears wherever the PLAYER is referenced —
 * never a hardcoded name.
 *
 * Legacy safety net: packages downloaded before this system existed hardcode
 * real names ("Ankit", "Kabir", …) for the player. Those names are swapped for
 * the player's actual name at render time — but ONLY when the name is not a
 * CHARACTER in that story, so a character genuinely called "Ankit" keeps the
 * name. New content must use the placeholder; the legacy path exists purely so
 * stale cached packages do not show the wrong name.
 */

/** The placeholder story authors use for the player's name. */
export const PLAYER_NAME_PLACEHOLDER = '{{playerName}}';

const PLACEHOLDER_RE = /\{\{\s*playerName\s*\}\}/g;

/**
 * Names that legacy (pre-placeholder) story packages hardcoded for the player.
 * Kept in one place so every render path treats them identically.
 */
export const LEGACY_PLAYER_NAMES: readonly string[] = ['Ankit', 'Kabir', 'Aarav', 'Arjun'];

/** Fallback when no profile nickname exists (onboarding gates this in practice). */
export const FALLBACK_PLAYER_NAME = 'Traveller';

export interface PlayerNameOptions {
  /** Story CHARACTER names — never replaced, even if they equal a legacy name. */
  protectedNames?: readonly string[];
  /** Legacy hardcoded player names to replace (defaults to LEGACY_PLAYER_NAMES). */
  legacyNames?: readonly string[];
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve `{{playerName}}` and legacy hardcoded player names to the player's
 * actual name. Character names are preserved.
 */
export function interpolatePlayerName(
  text: string,
  playerName: string | null | undefined,
  options: PlayerNameOptions = {},
): string {
  if (!text) return text;
  const name = (playerName ?? '').trim() || FALLBACK_PLAYER_NAME;

  // 1. The placeholder system — always active.
  let out = text.replace(PLACEHOLDER_RE, name);

  // 2. Legacy packages that hardcode the player's name. A name that is a
  //    character in this story is protected and never touched.
  const legacy = options.legacyNames ?? LEGACY_PLAYER_NAMES;
  const protectedNames = new Set(
    (options.protectedNames ?? [])
      .map((n) => (n ?? '').trim())
      .filter(Boolean),
  );
  for (const legacyName of legacy) {
    if (!legacyName || protectedNames.has(legacyName)) continue;
    out = out.replace(new RegExp(`\\b${escapeRegExp(legacyName)}\\b`, 'g'), name);
  }
  return out;
}

/** Character names of a bundle (or partial bundle / manifest meta). */
export function characterNamesOf(
  source:
    | { characters?: { characters?: { name?: unknown }[] } }
    | { characters?: readonly unknown[] }
    | null
    | undefined,
): string[] {
  if (!source) return [];
  const list = (source as { characters?: { characters?: { name?: unknown }[] } }).characters;
  if (Array.isArray(list?.characters)) {
    return list!.characters!
      .map((c) => (typeof (c as { name?: unknown })?.name === 'string' ? (c as { name: string }).name : ''))
      .filter(Boolean);
  }
  // Manifest `meta.characters` is a plain string array.
  if (Array.isArray(list)) return list.filter((n): n is string => typeof n === 'string');
  return [];
}

/**
 * Interpolation options for a story: its character names are protected.
 * Accepts a full bundle, a characters file, or manifest meta (which carries a
 * plain `characters: string[]` list).
 */
export function playerNameOptionsFor(
  source: Parameters<typeof characterNamesOf>[0],
): PlayerNameOptions {
  return { protectedNames: characterNamesOf(source) };
}

/**
 * Build a per-story text interpolator (components with a bundle/meta + the
 * profile nickname). Returns identity when no player name is known yet.
 */
export function makePlayerTextFn(
  source: Parameters<typeof characterNamesOf>[0],
  playerName: string | null | undefined,
): (text: string) => string {
  const name = (playerName ?? '').trim();
  if (!name) return (text) => text;
  const options = playerNameOptionsFor(source);
  return (text) => interpolatePlayerName(text, name, options);
}
