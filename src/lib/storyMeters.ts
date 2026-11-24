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
 * Pure functions only — no React, no storage — so they are unit-testable and
 * shared by the chat header and any future story-profile card.
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
  const names = config.meters
    .slice(0, 2)
    .map((m) => (m.source === 'hate' ? `${m.label} (inverse of the bond — falls as they warm up)` : m.label))
    .join(' and ');
  return `VISIBLE METERS (the reader sees these on screen): ${names}. Move affection / trust / tension in small but REAL steps (-10..+10) whenever the exchange earns it; a beat that genuinely changes how they feel about the reader must show up here, or the meter silently disagrees with your story.`;
}
