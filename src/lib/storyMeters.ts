/**
 * Story meters — the "Love Meter / Hate Meter" an author asks for when they
 * submit a story (v2.15.1).
 *
 * WHY THIS LIVES HERE: the numbers are never invented per turn and never typed
 * by the author. They are read from the same relationship ledger the narrator
 * already maintains (`worldState.relationships[<id>]`), so the bar on screen can
 * never contradict the story. The author only chooses the LABEL and which slice
 * of the ledger it shows.
 *
 * v2.16.1: the reader sees the numbers as a one-line summary ABOVE the reply
 * bubble — no bars, no separate meter card. The narrator writes that line at the
 * top of every reply (see `meterPromptLine`), the app parses it out of the text
 * (`parseMeterLine`) so it can be styled, and strips it from the story body.
 * The ledger values below stay as the authoritative fallback for stories whose
 * reply does not carry the line yet.
 *
 * Pure functions only — no React, no storage — so they are unit-testable and
 * shared by the bubble, the intro and the prompt builder.
 */
import type { StoryMeter, StoryMeterConfig } from '../types';
import { clamp } from './utils';

/** The slice of `RelationshipDetail` this module needs. */
export interface MeterSource {
  affection?: number;
  trust?: number;
  tension?: number;
}

export interface MeterView {
  id: string;
  label: string;
  /** 0-100, rounded. */
  value: number;
  /** What the bar should look like (0-100), already direction-correct. */
  fill: number;
  /** True when nothing has been recorded yet, so the UI can show it as fresh. */
  isInitial: boolean;
}

const DEFAULT_START = 0;

/**
 * Turn one configured meter into a display value.
 *
 * `hate` is deliberately NOT a copy of love: it is the inverse of the bond the
 * ledger already tracks (affection weighted over trust), which is exactly how
 * enemies-to-lovers stories actually move — nafrat girti hai to pyaar uthta hai,
 * but the two never both read 100.
 */
export function meterValue(meter: StoryMeter, rel: MeterSource | undefined): number {
  const affection = clamp(rel?.affection ?? 0, 0, 100);
  const trust = clamp(rel?.trust ?? 0, 0, 100);
  const tension = clamp(rel?.tension ?? 0, 0, 100);
  switch (meter.source) {
    case 'affection':
      return affection;
    case 'trust':
      return trust;
    case 'tension':
      return tension;
    case 'hate':
      return clamp(100 - (affection * 0.6 + trust * 0.4), 0, 100);
    default:
      return 0;
  }
}

/**
 * Build the meters to render for a story.
 *
 * Returns [] when the story has no meters configured OR the ledger has no entry
 * for the character yet AND the meter has no `start` — so a story that never
 * mentions the lead's bond does not show a fake "0" bar.
 */
export function resolveMeters(
  config: StoryMeterConfig | undefined,
  relationships: Record<string, MeterSource> | undefined,
  fallbackCharacterId?: string,
): MeterView[] {
  if (!config?.meters?.length) return [];
  const characterId = config.characterId ?? fallbackCharacterId;
  const rel = characterId ? relationships?.[characterId] : undefined;
  const seen = new Set<string>();
  const out: MeterView[] = [];
  // Dedupe FIRST: capping before dedupe lets a repeated id swallow a bar.
  for (const meter of config.meters) {
    if (out.length >= 2) break;
    if (!meter?.id || seen.has(meter.id)) continue;
    seen.add(meter.id);
    const recorded = rel !== undefined;
    const raw = recorded ? meterValue(meter, rel) : clamp(meter.start ?? DEFAULT_START, 0, 100);
    const value = Math.round(raw);
    out.push({
      id: meter.id,
      label: meter.label,
      value,
      fill: clamp(value, 0, 100),
      // Showing the authored start (or a bare 0) before anything happened is
      // still "initial" — the story has not moved it yet.
      isInitial: !recorded,
    });
  }
  return out;
}

/**
 * Does the narrator need to be told about this story's meters?
 *
 * The record-keeper already tracks affection/trust/tension, but it does not know
 * the author promised the reader a visible meter — so it tends to move the
 * numbers far too slowly for a 0 → 100 enemies-to-lovers arc to ever be visible.
 * This line tells it what the reader is actually watching.
 */
export function meterPromptLine(config: StoryMeterConfig | undefined): string {
  if (!config?.meters?.length) return '';
  const shown = config.meters.slice(0, 2);
  const shape = shown
    .map((m) => `${meterIcon(m)} {value}/100`)
    .join(' · ');
  const names = shown
    .map((m) => (m.source === 'hate' ? `${m.label} (inverse of the bond — falls as they warm up)` : m.label))
    .join(' and ');
  return `VISIBLE METERS — the reader sees ${names} as a single line at the TOP of every reply:
${shape}

Move affection / trust / tension in small but REAL steps (-10..+10) whenever the exchange earns it; a beat that genuinely changes how they feel about the reader must show up here, or the meter silently disagrees with your story.

HOW TO WRITE IT (mandatory on EVERY reply for this story):
- Line 1 of the reply is exactly that line and NOTHING else — e.g. "${exampleLine(shown)}".
- Then one empty line, then the story (narration/dialogue) as usual.
- Whole numbers 0-100, no decimals, no spaces inside the brackets, no extra words, no bold, no bullets.
- It must MATCH the story beat you are writing: if the scene warms them up, love rises and hate falls; if it goes cold, the opposite. Never move a meter by more than 10 in one turn unless the scene is genuinely dramatic.
- Love and Hate are inverses: they never both read high.
- If nothing in this turn changes how they feel, carry the same numbers forward.`;
}

/** Emoji shown before a meter value — Love uses a heart, everything else scales with the bond. */
export function meterIcon(meter: Pick<StoryMeter, 'source'>): string {
  return meter.source === 'hate' ? '💔' : '❤️';
}

/** "❤️ 0/100 · 💔 100/100" — the exact line the narrator is told to write. */
export function formatMeterLine(
  meters: Array<Pick<StoryMeter, 'source' | 'label'>>,
  values: number[],
): string {
  return meters
    .slice(0, 2)
    .map((m, i) => `${meterIcon(m)} ${Math.round(clamp(values[i] ?? 0, 0, 100))}/100`)
    .join(' · ');
}

function exampleLine(meters: StoryMeter[]): string {
  return formatMeterLine(meters, meters.map((m) => clamp(m.start ?? DEFAULT_START, 0, 100)));
}

/** One meter line as the narrator may have written it: emoji, number, /100. */
const METER_TOKEN_RE = /(❤️|❤|💔|🖤)\s*([+-]?\d{1,4})\s*\/\s*100/g;

/**
 * Pull the narrator's meter line off the top of a reply.
 *
 * Deliberately strict about POSITION (the line must be the first thing in the
 * reply, at most a blank line before it) so that a story which happens to
 * mention "100/100" in prose never loses a paragraph. Returns `null` when the
 * reply has no line — then the caller falls back to the ledger values.
 */
export function parseMeterLine(text: string): { values: number[]; icons: string[]; rest: string } | null {
  const src = text ?? '';
  const lead = src.match(/^\s*/)?.[0] ?? '';
  const body = src.slice(lead.length);
  // Find the end of the first non-empty line.
  const nl = body.indexOf('\n');
  const firstLine = (nl === -1 ? body : body.slice(0, nl)).trim();
  if (!firstLine) return null;
  const tokens = [...firstLine.matchAll(METER_TOKEN_RE)];
  if (!tokens.length) return null;
  // The line must be ONLY meter tokens and separators — not a sentence.
  const leftovers = firstLine
    .replace(METER_TOKEN_RE, '')
    .replace(/[\s·|,–—-]/g, '');
  if (leftovers.length > 0) return null;
  const values = tokens.map((t) => Math.round(clamp(Number(t[2]), 0, 100)));
  // Keep the emoji the narrator used, so the reader sees exactly what was written.
  const icons = tokens.map((t) => t[1]);
  const rest = nl === -1 ? '' : body.slice(nl + 1).replace(/^\n+/, '');
  return { values, icons, rest };
}

/**
 * Emoji for a meter the narrator did NOT write a line for (older turns): the
 * author's label decides it, so "Hate" still reads 💔 and "Love" reads ❤️.
 */
export function meterIconForLabel(label: string): string {
  return /hate|nafrat|dushmani/i.test(label ?? '') ? '💔' : '❤️';
}

/**
 * Resolve what to show above a bubble: parsed line values when present, else the
 * ledger. Returns [] when the story has no meters at all (nothing is rendered).
 */
export function meterViewsForReply(
  config: StoryMeterConfig | undefined,
  relationships: Record<string, MeterSource> | undefined,
  fallbackCharacterId?: string,
  parsed?: number[] | null,
): MeterView[] {
  const base = resolveMeters(config, relationships, fallbackCharacterId);
  if (!base.length || !parsed?.length) return base;
  return base.map((m, i) => {
    const value = parsed[i] ?? m.value;
    return { ...m, value, fill: clamp(value, 0, 100), isInitial: false };
  });
}
