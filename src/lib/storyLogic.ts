/**
 * KISSA v2.13.0 — deterministic, invisible reply-logic guards.
 *
 * The narrator still makes only one normal story call. These checks run on its
 * draft; an existing single rewrite pass is used only for a high-confidence
 * contradiction. They deliberately ignore ambiguous/teasing/flashback wording:
 * a false continuity correction is worse than leaving creative freedom intact.
 */
import type { RelationshipStateRecord } from '../types';
import type { WorldState } from './worldState';
import { trigramSimilarity } from './storyMemoryCore';

export interface LogicGuardInput {
  recentAssistant?: string[];
  relationships?: RelationshipStateRecord[];
  worldState?: WorldState | null;
  readerName?: string;
  /** Include the reader's latest move so a valid hand-over is not rejected. */
  readerText?: string;
}

export interface ObjectOwnerContradiction {
  objectName: string;
  expectedHolder: string;
  claimedHolder: string;
}

function comparable(text: string): string {
  return text.toLocaleLowerCase().normalize('NFKC').replace(/[*_~`]/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(text: string): Set<string> {
  return new Set(comparable(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? []);
}

/** Similarity for catching a rephrased duplicate, not just a byte-for-byte one. */
export function replySimilarity(a: string, b: string): number {
  const aw = words(a);
  const bw = words(b);
  if (!aw.size || !bw.size) return 0;
  let shared = 0;
  for (const token of aw) if (bw.has(token)) shared++;
  const dice = (2 * shared) / (aw.size + bw.size);
  return Math.max(dice, trigramSimilarity(a, b));
}

/** Only long, near-identical drafts are stopped; short natural replies may repeat. */
export function findRepeatedReply(text: string, recentAssistant: string[] = []): boolean {
  if (comparable(text).length < 48) return false;
  return recentAssistant.slice(-4).some((previous) => comparable(previous).length >= 48 && replySimilarity(text, previous) >= 0.86);
}

const RESET_PATTERNS = [
  /\b(?:hum|hum\s+dono|we)\b[^.\n!?]{0,45}\b(?:abhi(?:\s*-\s*abhi|\s+abhi)?|just)\s+(?:mile|mili|mila|met)\b/i,
  /\b(?:tumse|tujhse|aapse)\b[^.\n!?]{0,35}\b(?:pehli|pahli)\s+baar\s+mil/i,
  /\b(?:tumse|tujhse|aapse)\b[^.\n!?]{0,35}\bfirst\s+time\s+meet/i,
];
const RESET_CONTEXT_EXEMPTION = /(?:yaad|flashback|\bjab\b|pehle|pahle|remember|pretend|mazak|mazaak|joke|acting|kaho\s+to|aisa\s+lag)/i;

/** A bonded couple/friend pair must not be told they have only just met. */
export function findRelationshipReset(
  text: string,
  relationships: RelationshipStateRecord[] = [],
): RelationshipStateRecord | null {
  const established = relationships
    .filter((relationship) => relationship.tier >= 2)
    .sort((a, b) => b.tier - a.tier);
  if (!established.length) return null;
  for (const rawLine of text.split(/\n|(?<=[.!?])\s+/)) {
    const line = rawLine.trim();
    if (!line || RESET_CONTEXT_EXEMPTION.test(line)) continue;
    if (!RESET_PATTERNS.some((pattern) => pattern.test(line))) continue;
    const speaker = line.match(/^\s*["'*]*([\p{L}][\p{L}\p{M} ]{0,50}?)\s*:/u)?.[1]?.trim();
    if (speaker) {
      const speakerMatches = established.filter((relationship) => [relationship.a, relationship.b]
        .some((party) => comparable(party.name) === comparable(speaker)));
      // A different named speaker cannot reset this pair's relationship.
      if (!speakerMatches.length) continue;
      return speakerMatches[0];
    }
    const named = established.filter((relationship) => [relationship.a, relationship.b]
      .filter((party) => party.id !== 'player')
      .some((party) => party.name && comparable(line).includes(comparable(party.name))));
    if (named.length) return named[0];
    // With several bonded people in scope and no speaker/name, the target of
    // "we just met" is ambiguous; never force a continuity rewrite.
    if (established.length === 1) return established[0];
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TRANSFER_RE = /(?:de\s+(?:diya|di|deta|dete|deti|dena|do|raha|rahi)|lauta\s+(?:diya|di|dete|deti)|saump\s+(?:diya|di)|utha\s*(?:ya|li|liya|le|lete|leti)|handed(?:\s+over)?|gave|give\s+(?:it|them)|pass(?:ed)?\s+(?:it|them)|picked\s+up|took)/i;
const NEGATION_RE = /(?:\bnahi\b|\bnahin\b|\bnot\b|\bno\s+longer\b|\bdoesn['’]t\b|\bdon['’]t\b)/i;

/**
 * Catch only an explicit "X has Y" contradiction. Pronouns, questions and
 * ambiguous possession are ignored. If either the reader or the draft performs
 * a hand-over, the old holder is allowed to change during this turn.
 */
export function findObjectOwnerContradiction(
  text: string,
  state: WorldState | null | undefined,
  readerName = 'Player',
  readerText = '',
): ObjectOwnerContradiction | null {
  if (!state?.importantObjects) return null;
  const names = new Map<string, string>();
  for (const character of Object.values(state.characterStates ?? {})) {
    if (character?.name?.trim()) names.set(comparable(character.name), character.name.trim());
  }
  if (readerName.trim()) names.set(comparable(readerName), readerName.trim());
  names.set('player', readerName.trim() || 'Player');

  for (const object of Object.values(state.importantObjects)) {
    if (!object?.holder || !object.name || object.name.trim().length < 4) continue;
    const holderKey = comparable(object.holder);
    const holderState = state.characterStates?.[object.holder];
    const expectedHolder = holderState?.name ?? names.get(holderKey) ?? object.holder;
    const objectName = object.name.trim();
    const objectPattern = escapeRegExp(objectName).replace(/\s+/g, '\\s+');
    const allowsTransfer = (TRANSFER_RE.test(readerText) && comparable(readerText).includes(comparable(objectName)))
      || (TRANSFER_RE.test(text) && comparable(text).includes(comparable(objectName)));
    if (allowsTransfer) continue;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.includes('?') || NEGATION_RE.test(line)) continue;
      if (TRANSFER_RE.test(line) && comparable(line).includes(comparable(objectName))) continue;
      for (const [candidateKey, candidateName] of names) {
        if (candidateKey === holderKey || candidateKey === comparable(expectedHolder)) continue;
        const namePattern = escapeRegExp(candidateName).replace(/\s+/g, '\\s+');
        const patterns = [
          new RegExp(`\\b${namePattern}\\s+(?:ke|ki)\\s+paas\\b[^.\\n!?]{0,50}\\b${objectPattern}\\b`, 'iu'),
          new RegExp(`\\b${objectPattern}\\b[^.\\n!?]{0,40}\\b${namePattern}\\s+(?:ke|ki)\\s+paas\\b`, 'iu'),
          new RegExp(`\\b${namePattern}\\s+(?:has|holds|is\\s+holding)\\s+(?:the\\s+)?${objectPattern}\\b`, 'iu'),
        ];
        if (patterns.some((pattern) => pattern.test(line))) {
          return { objectName, expectedHolder, claimedHolder: candidateName };
        }
      }
    }
  }
  return null;
}
