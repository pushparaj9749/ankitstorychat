/**
 * Story text markup — dependency-free so it can be unit-tested in Node
 * and reused by the chat UI, the offline storyteller and notifications.
 *
 * Kissa's story format (what writers put in scenes.json / what the AI is asked for):
 *
 *   *Beena ke honton par halki si muskaan ubharti hai.*   <- action / narration
 *   Beena: "Achchha. Zubaan mein dum toh hai tumhare."    <- character dialogue
 *
 * Anything wrapped in single asterisks is ACTION text: the chat UI renders it
 * FADED + italic so the reader's eye lands on the spoken dialogue first.
 * Everything else is spoken dialogue and renders at full strength.
 */

export interface StorySpan {
  text: string;
  /** True when this span came from *asterisks* — render faded + italic. */
  faded: boolean;
}

/**
 * Split a story line into plain / faded spans.
 *
 * Rules (deliberately conservative so maths like "3 * 4" stays literal):
 *  - an opening `*` must be followed by a non-space, non-`*` character
 *  - the matching closing `*` must exist on the SAME line, and the span
 *    must not be empty, must not contain another `*`, and must not end in a space
 *  - an unmatched `*` is kept as a normal character
 */
export function parseStoryMarkup(input: string): StorySpan[] {
  const src = input ?? '';
  const spans: StorySpan[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      spans.push({ text: buf, faded: false });
      buf = '';
    }
  };

  while (i < src.length) {
    if (src[i] === '*') {
      // "**bold**" is emphasis too — consume both markers so none survive.
      if (src[i + 1] === '*') {
        const dStart = i + 2;
        const dEnd = src.indexOf('**', dStart);
        const dInner = dEnd > dStart ? src.slice(dStart, dEnd) : '';
        if (dEnd > dStart && dInner.length > 0 && !/\n/.test(dInner) && !/\s$/.test(dInner)) {
          flush();
          spans.push({ text: dInner, faded: true });
          i = dEnd + 2;
          continue;
        }
      }
      const start = i + 1;
      const next = src[start];
      if (next && next !== ' ' && next !== '\n' && next !== '\t' && next !== '*') {
        const end = src.indexOf('*', start);
        const inner = end > start ? src.slice(start, end) : '';
        const usable =
          end > start &&
          inner.length > 0 &&
          !/[\n*]/.test(inner) &&
          !/\s$/.test(inner);
        if (usable) {
          flush();
          spans.push({ text: inner, faded: true });
          i = end + 1;
          continue;
        }
      }
    }
    buf += src[i];
    i += 1;
  }
  flush();
  return spans;
}

/** Does this text contain any faded (*action*) span? */
export function hasFadedMarkup(input: string): boolean {
  return parseStoryMarkup(input).some((s) => s.faded);
}

/**
 * Is the WHOLE line a single *action* span (optionally surrounded by whitespace)?
 * Used to decide whether an offline line is pure narration or dialogue.
 */
export function isFullyFadedLine(input: string): boolean {
  const spans = parseStoryMarkup((input ?? '').trim());
  return spans.length === 1 && spans[0].faded;
}

/** Plain text with the asterisk markers removed (chips, search, notifications, TTS). */
export function stripStoryMarkup(input: string): string {
  return parseStoryMarkup(input)
    .map((s) => s.text)
    .join('');
}

/* ------------------------------------------------------------------ */
/* Speaker prefixes:  Name: "dialogue"                                 */
/* ------------------------------------------------------------------ */

const SPEAKER_RE = /^\s*([A-Z][A-Za-z0-9.'_\- ]{0,23}?)\s*:\s*/;

export interface SpeakerSplit {
  speaker: string | null;
  text: string;
}

/** Leading `Name: ` prefix of a single line, or null. */
export function matchSpeakerPrefix(line: string): { name: string; rest: string } | null {
  const m = (line ?? '').match(SPEAKER_RE);
  if (!m) return null;
  const name = m[1].trim();
  if (!name) return null;
  return { name, rest: (line ?? '').slice(m[0].length).trim() };
}

/**
 * Peel a leading `Name:` prefix off a story line.
 *
 * When `knownNames` is given the prefix must match one of them (case-insensitive)
 * — that stops ordinary narration such as "Problem: sab kuch bigad gaya" from
 * inventing a character called "Problem".
 */
export function splitSpeakerLine(line: string, knownNames?: string[]): SpeakerSplit {
  const raw = line ?? '';
  const hit = matchSpeakerPrefix(raw);
  if (!hit) return { speaker: null, text: raw };

  if (knownNames && knownNames.length) {
    const lookup = new Map(knownNames.map((n) => [n.toLowerCase().trim(), n]));
    const match = lookup.get(hit.name.toLowerCase());
    if (!match) return { speaker: null, text: raw };
    return { speaker: match, text: hit.rest };
  }
  return { speaker: hit.name, text: hit.rest };
}
