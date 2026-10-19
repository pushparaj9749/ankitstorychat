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

/* ---------------------------------------------------------------- reader role */

/**
 * Author instructions to the narrator that live inside `story.userRole`
 * ("controlled exclusively by the player", "never assign him a name…").
 * The AI still receives the full text; the READER only sees the description.
 */
const ROLE_INSTRUCTION =
  /\b(player|narrator|runtime|display name|never assign|never choose|controlled (?:exclusively|only)|illustrative|prescribed|is never assigned|are never assigned|is never)\b/i;

/** Reader-facing version of `story.userRole`: who you are, without narrator rules. */
export function readerRoleText(userRole: string): string {
  const text = (userRole ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // "…man aged 18–19, controlled exclusively by the player." → "…man aged 18–19."
  const cleaned = text.replace(/,?\s*controlled (?:exclusively |only )?by the player\b/gi, '');
  // Split into sentences (keep "18–19", "Dr.", "No. 9" intact: split only on ". " + capital/{{ ).
  const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z{"'(])/);
  const kept = sentences.filter((s, i) => i === 0 ? true : !ROLE_INSTRUCTION.test(s));
  // The first sentence can itself be an instruction tail-only case; strip a trailing rule clause.
  if (kept.length && ROLE_INSTRUCTION.test(kept[0])) {
    const head = kept[0].split(/[;:]\s+/)[0];
    kept[0] = ROLE_INSTRUCTION.test(head) ? '' : head;
  }
  const out = kept.filter(Boolean).join(' ').replace(/\s+([.,;])/g, '$1').trim();
  return out || text.split(/[.;]/)[0].trim();
}
