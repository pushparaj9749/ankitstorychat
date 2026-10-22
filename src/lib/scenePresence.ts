/**
 * v2.10.3 — scene presence: who is actually in the scene.
 *
 * Owner bug report: characters close to the reader kept barging into scenes.
 * Two causes are fixed with these helpers:
 *  - the reply guard (engine.checkAssistantReply) flags cast members who
 *    speak although they are not in the scene and nobody called them;
 *  - the memory write pipeline no longer marks a character "present" just
 *    because their NAME was mentioned (only speaking, arriving or being
 *    named by the record-keeper does).
 */
import { norm } from './utils';


const DIALOGUE_SPEAKER_RE = /^\s*\**\s*([A-Z][A-Za-z.'\- ]{0,30}?)\s*(?:\([^)]{0,40}\))?\s*:/;

function firstNameKey(name: string): string {
  return norm(name).split(' ')[0] ?? '';
}

/** Cast members who have a `Name:` dialogue line in `text` (plus `speaker`). */
export function castSpeakersIn(text: string, speaker: string | null, castNames: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const n of castNames) {
    byKey.set(norm(n), n);
    const f = firstNameKey(n);
    if (f.length >= 3 && !byKey.has(f)) byKey.set(f, n);
  }
  const out = new Set<string>();
  const consider = (raw: string | null | undefined) => {
    if (!raw) return;
    const k = norm(raw);
    const hit = byKey.get(k) ?? byKey.get(k.split(' ')[0] ?? '');
    if (hit) out.add(hit);
  };
  consider(speaker);
  for (const line of (text ?? '').split('\n')) {
    const m = line.match(DIALOGUE_SPEAKER_RE);
    if (m) consider(m[1]);
  }
  return [...out];
}

export interface PresenceCheckInput {
  text: string;
  speaker: string | null;
  castNames: string[];
  /** Names of the characters the world state says are in the scene. */
  presentNames: string[];
  /** What the reader just wrote (naming someone = calling them in). */
  readerText?: string;
  /** Characters who spoke in the recent conversation (evidently around). */
  recentSpeakers?: string[];
}

/**
 * Cast members who speak in this reply although they are not in the scene,
 * were not named by the reader and have not been part of the recent
 * conversation — i.e. they barged in. Empty when the roster is unknown.
 */
export function findUninvitedSpeakers(input: PresenceCheckInput): string[] {
  if (!input.presentNames.length) return [];
  const present = new Set(input.presentNames.map(norm));
  const presentFirst = new Set(input.presentNames.map(firstNameKey));
  const recent = new Set((input.recentSpeakers ?? []).map(norm));
  const recentFirst = new Set((input.recentSpeakers ?? []).map(firstNameKey));
  const reader = ` ${norm((input.readerText ?? '').replace(/[^\p{L}\p{N}]+/gu, ' '))} `;
  return castSpeakersIn(input.text, input.speaker, input.castNames).filter((name) => {
    const k = norm(name);
    const f = firstNameKey(name);
    if (present.has(k) || presentFirst.has(f)) return false;
    if (recent.has(k) || recentFirst.has(f)) return false;
    if (reader.includes(` ${k} `) || (f.length >= 3 && reader.includes(` ${f} `))) return false;
    return true;
  });
}

const ARRIVAL_RE = /\b(aaya|aayi|aaye|aa gaya|aa gayi|aa gaye|aa pahunch\w*|pahuncha|pahunchi|pahunche|andar aa\w*|walks? in|walked in|enters?|entered|arrives?|arrived|shows? up|showed up|darwaze par|darwaza khol\w*)\b/i;
const DEPARTURE_RE = /\b(chala gaya|chali gayi|chale gaye|nikal gaya|nikal gayi|nikal gaye|chala jaata|left|leaves|went away|walks? out|walked out|bahar chala|bahar chali|ghar chala|ghar chali)\b/i;

function sentencesOf(text: string): string[] {
  return (text || '').split(/(?<=[.!?\u0964])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
}

function mentions(sentence: string, name: string): boolean {
  const s = ` ${norm(sentence.replace(/[^\p{L}\p{N}]+/gu, ' '))} `;
  const full = norm(name);
  const first = full.split(' ')[0] ?? '';
  return s.includes(` ${full} `) || (first.length >= 3 && s.includes(` ${first} `));
}

/**
 * Evidence-based presence after one exchange, starting from who was present.
 * A character becomes present only by SPEAKING in the reply or by an arrival
 * phrase in the same sentence as their name; leaves on a departure phrase.
 * Mentions alone change nothing. Returns ids, or null when nothing changed.
 */
export function inferPresence(
  cast: { id: string; name: string }[],
  currentPresent: string[],
  assistantText: string,
  speaker: string | null = null,
): string[] | null {
  const present = new Set(currentPresent);
  const speakers = castSpeakersIn(assistantText, speaker, cast.map((c) => c.name));
  for (const c of cast) if (speakers.includes(c.name)) present.add(c.id);
  for (const sentence of sentencesOf(assistantText)) {
    for (const c of cast) {
      if (!mentions(sentence, c.name)) continue;
      if (DEPARTURE_RE.test(sentence)) present.delete(c.id);
      else if (ARRIVAL_RE.test(sentence)) present.add(c.id);
    }
  }
  const next = [...present];
  const same = next.length === currentPresent.length && next.every((id) => currentPresent.includes(id));
  return same ? null : next;
}

/** Map record-keeper ids OR names onto real character ids; drop the reader. */
export function normalizeCharacterRefs(refs: string[], cast: { id: string; name: string }[], readerName?: string): string[] {
  const byKey = new Map<string, string>();
  for (const c of cast) {
    byKey.set(norm(c.id), c.id);
    byKey.set(norm(c.name), c.id);
    const first = norm(c.name).split(' ')[0] ?? '';
    if (first.length >= 3 && !byKey.has(first)) byKey.set(first, c.id);
  }
  const reader = norm(readerName ?? '');
  const out: string[] = [];
  for (const r of refs) {
    const k = norm(r);
    if (!k || k === 'player' || k === 'reader' || k === 'user' || (reader && k === reader)) continue;
    const id = byKey.get(k) ?? byKey.get(k.split(' ')[0] ?? '') ?? r.trim();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** A single promise party: a character id, or "player". */
export function normalizePromiseParty(ref: string, cast: { id: string; name: string }[], readerName?: string): string {
  const k = norm(ref ?? '');
  const reader = norm(readerName ?? '');
  if (!k || k === 'player' || k === 'reader' || k === 'user' || k === 'you' || (reader && k === reader)) return 'player';
  return normalizeCharacterRefs([ref], cast, readerName)[0] ?? ref.trim();
}
