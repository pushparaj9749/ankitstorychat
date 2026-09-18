/**
 * Memory core — pure retrieval logic (no SQLite, no React Native).
 * Split out of memory.ts so ranking stays unit-testable.
 *
 * Recall model:
 *  - importance weight (1..9, reinforced each time a memory proves useful)
 *  - keyword overlap with the RECENT conversation (not just the last line)
 *  - recency boost with exponential decay
 *  - pinned kinds (summary / preference) always ride along
 *  - selection by CHARACTER BUDGET, not a fixed count, so short stories and
 *    500-turn sagas both fill the prompt without blowing it up
 */
import type { MemoryEntry, MemoryKind } from '../types';

/** Story-level preferences are shared across every playthrough of every story. */
export const GLOBAL_SCOPE = '*';

export const MEMORY_CHAR_BUDGET = 3800;
export const MEMORY_MAX_ITEMS = 28;
export const MEMORY_MAX_CHARS = 500;
export const EPISODE_MAX_CHARS = 260;
export const SUMMARY_MAX_CHARS = 1800;

/** English + Hinglish filler that must never drive relevance. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'was', 'are', 'not', 'that', 'this', 'with', 'have', 'has',
  'but', 'her', 'his', 'our', 'out', 'get', 'got', 'just', 'like', 'now', 'then', 'them', 'they',
  'there', 'here', 'what', 'when', 'where', 'who', 'why', 'how', 'all', 'any', 'some', 'more',
  'most', 'much', 'very', 'too', 'yet', 'still', 'will', 'would', 'could', 'should', 'can', 'cant',
  'did', 'does', 'done', 'into', 'from', 'about', 'after', 'before', 'because', 'so', 'if', 'or',
  'hai', 'hain', 'tha', 'thi', 'the', 'ho', 'hota', 'hoti', 'hone', 'hoke', 'raha', 'rahi', 'rahe',
  'gaya', 'gayi', 'jata', 'jati', 'diya', 'diyi', 'mila', 'mili', 'bola', 'boli', 'bola', 'kaha',
  'ke', 'ka', 'ki', 'ko', 'se', 'tak', 'par', 'mein', 'me', 'main', 'tu', 'tum', 'tuma', 'aap',
  'apka', 'apni', 'mera', 'meri', 'tere', 'tera', 'teri', 'uska', 'uski', 'hamara', 'ek', 'do',
  'teen', 'bahut', 'thoda', 'thodi', 'bhi', 'hi', 'to', 'aur', 'ya', 'nahi', 'nhi', 'haa', 'han',
  'kyon', 'kyu', 'kya', 'kab', 'kahan', 'kaun', 'aise', 'waise', 'acha', 'accha', 'acchi', 'sahi',
  'haan', 'nahin', 'dvara', 'dwaara', 'wala', 'wali', 'wale', 'dijiye', 'karo', 'karta', 'karti',
  'kiya', 'ki_ji', 'sahab', 'ji', 'please', 'thanks', 'thank', 'sorry', 'okay', 'ok', 'um', 'hmm',
  'kar', 'karen', 'karta', 'karke', 'karne', 'karungi', 'karunga', 'baat', 'bate', 'abhi', 'kal',
  'aaj', 'woh', 'yeh', 'voh', 'bas', 'bhai', 'kuch', 'hoga', 'hogi', 'honge', 'hoon', 'hun', 'hai',
  'ho', 'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'bola', 'boli', 'bol', 'chahiye', 'chahe', 'liye',
  'saath', 'sang', 'tab', 'phir', 'fir', 'kyunki', 'kyonki', 'agar', 'yar', 'yaar', 'sahi', 'galat',
]);

/** Memory notes the narrator may emit per reply (hidden state block). */
export const MAX_MEMORY_NOTES = 8;

/* ---------------- tokenizing ---------------- */

/** Hinglish↔English alias table: canonical form on the right. */
const ALIAS_MAP: Record<string, string> = {
  tasveer: 'photograph', photo: 'photograph', picture: 'photograph',
  gaadi: 'car', gadi: 'car',
  maafi: 'apology', mafi: 'apology',
  dushman: 'enemy', dost: 'friend', yaar: 'friend',
  shaadi: 'wedding', vivah: 'wedding',
  raaz: 'secret', bhed: 'secret',
  khat: 'letter', patra: 'letter',
  chitthi: 'letter',
  khoj: 'discovery', talash: 'discovery',
  waada: 'promise', wada: 'promise', kasam: 'promise', vachan: 'promise',
  pyaar: 'love', mohabbat: 'love', ishq: 'love',
  nafrat: 'hate', gussa: 'anger',
  haveli: 'mansion', mahal: 'palace',
  zindagi: 'life', maut: 'death',
  sach: 'truth', jhooth: 'lie',
  aansu: 'tears', muskaan: 'smile',
  darr: 'fear', khauf: 'fear',
  sapna: 'dream', khwaab: 'dream',
  dhokha: 'betrayal', bewafai: 'betrayal',
  scarf: 'scarf',
  diary: 'diary',
  chabi: 'key', kunci: 'key',
};

/** Doubled vowels are Hinglish spelling noise: "waada"/"wada", "Myraa"/"myra". */
function foldVowels(word: string): string {
  return word.replace(/([aeiou])\1+/g, '$1');
}

/**
 * Unicode-aware tokens (Devanagari included), stopwords + short words dropped and
 * vowel folding applied, so free-form romanised Hindi still matches.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of (text || '').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (raw.length < 3) continue;
    const t = foldVowels(raw);
    const canon = ALIAS_MAP[t] ?? ALIAS_MAP[raw];
    if (canon) {
      out.push(canon);
    } else if (t.length >= 3 && !STOPWORDS.has(t) && !STOPWORDS.has(raw)) {
      out.push(t);
    }
  }
  return out;
}

export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/**
 * Stable content key for dedupe. Deliberately NOT the tokenized form — "chapter 1"
 * and "chapter 2" are different facts, and short words can carry the whole meaning.
 * Only case, punctuation and whitespace are folded away, so the same sentence typed
 * twice still collapses into one row.
 */
export function hashText(text: string): string {
  const body = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) | 0;
  return `${body.slice(0, 220)}|${(h >>> 0).toString(36)}`;
}

/** Trim + hard-cap a memory line. */
export function sanitize(text: string, max = MEMORY_MAX_CHARS): string {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Privacy guard — never persist real-world personal data as a memory.
 * Shapes only (email, Indian/intl mobile, aadhaar, card, ID words), so story
 * numbers like dates, chapter counts or "4 taala" are not mistaken for PII.
 */
export function looksTooPrivate(text: string): boolean {
  const t = text || '';
  return (
    /[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(t) || // email
    /\+\d{1,3}[\s-]?[\d\s-]{8,}/.test(t) || // any +<countrycode> number
    /\b\d{10,11}\b/.test(t) || // bare Indian mobile
    /\b\d{5}[\s-]\d{5,6}\b/.test(t) || // mobile written in two groups
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(t) || // aadhaar / 12-digit
    /\b\d{13,19}\b/.test(t) || // card number
    /\b(passport|aadhaar|aadhar|pan\s?card|otp|password|pin\s?number|credit\s?card|debit\s?card|bank\s?account)\b[^\n]{0,24}\d/i.test(t)
  );
}

/* ---------------- scoring ---------------- */

const WEIGHTS = {
  importance: 2,
  overlap: 3,
  overlapFloor: 4,
  anyHit: 2,
  recency: 6,
  halfLifeDays: 12,
  hits: 1,
  hitsFloor: 6,
  pinSummary: 500,
  pinPreference: 10,
} as const;

/** Query side of scoring: exact tokens plus 4-char stems for fuzzy Hinglish spelling. */
export interface QueryProfile {
  tokens: Set<string>;
  stems: Set<string>;
}

/**
 * Hinglish is spelled freely ("waada"/"wada", "kyunki"/"kyonki", "Myraa"/"Myra"),
 * so an exact-token-only match loses real hits. Stems (first 4 chars of any word
 * 5+ long) catch the common cases without pulling in unrelated noise.
 */
export function buildQuery(text: string): QueryProfile {
  const tokens = tokenSet(text);
  const stems = new Set<string>();
  for (const t of tokens) if (t.length >= 4) stems.add(t.slice(0, 4));
  return { tokens, stems };
}

function profileOf(q: Set<string> | QueryProfile): QueryProfile {
  if (q instanceof Set) {
    const stems = new Set<string>();
    for (const t of q) if (t.length >= 4) stems.add(t.slice(0, 4));
    return { tokens: q, stems };
  }
  return q;
}

/**
 * Weighted keyword overlap. A hit on "chai" is worth less than a hit on "maafi
 * waada" — short generic words are common, long ones are specific. A stem-only
 * match counts half.
 */
export function overlapScore(text: string, query: Set<string> | QueryProfile): number {
  const q = profileOf(query);
  if (!q.tokens.size) return 0;
  let total = 0;
  const counted = new Set<string>();
  for (const t of tokenize(text)) {
    if (counted.has(t)) continue;
    if (q.tokens.has(t)) {
      counted.add(t);
      total += 1 + Math.min(1, Math.max(0, (t.length - 4) / 3));
    } else if (t.length >= 4 && q.stems.has(t.slice(0, 4))) {
      counted.add(t);
      total += 0.5;
    }
  }
  return total;
}

export function recencyBoost(createdAt: string, nowMs = Date.now(), halfLifeDays = WEIGHTS.halfLifeDays): number {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (nowMs - t) / 86_400_000);
  return WEIGHTS.recency * Math.pow(0.5, days / halfLifeDays);
}

/** One memory's relevance for the current turn. Higher = more worth injecting. */
export function scoreMemory(
  m: MemoryEntry,
  query: Set<string> | QueryProfile,
  nowMs = Date.now(),
): number {
  let score = m.importance * WEIGHTS.importance;
  const overlap = overlapScore(m.text, query);
  if (overlap > 0) {
    score += Math.min(overlap, WEIGHTS.overlapFloor) * WEIGHTS.overlap;
    score += WEIGHTS.anyHit * Math.min(1, overlap);
  }
  score += recencyBoost(m.createdAt, nowMs);
  score += Math.min(m.hits ?? 0, WEIGHTS.hitsFloor) * WEIGHTS.hits;
  if (m.kind === 'summary') score += WEIGHTS.pinSummary;
  else if (m.kind === 'preference') score += WEIGHTS.pinPreference;
  return score;
}

export interface SelectOptions {
  charBudget?: number;
  maxItems?: number;
  /** Curated facts pinned purely by importance (no keyword hit needed). */
  pinnedByImportance?: number;
  nowMs?: number;
}

/**
 * Pick what enters the prompt this turn.
 * Order: pinned (summary/preferences) → importance-pinned core facts → best matches.
 * Stops at the character budget so the prompt stays bounded whatever the story size.
 */
export interface SelectResult extends MemoryEntry {
  /** Set to true when an archived row was resurrected by strong keyword match. */
  resurrected?: boolean;
}

export function selectRelevant(
  all: MemoryEntry[],
  queryText: string,
  opts: SelectOptions = {},
): SelectResult[] {
  const {
    charBudget = MEMORY_CHAR_BUDGET,
    maxItems = MEMORY_MAX_ITEMS,
    pinnedByImportance = 6,
    nowMs = Date.now(),
  } = opts;
  const query = buildQuery(queryText);

  // Separate live and archived; archived may be resurrected on strong match
  const live = all.filter((m) => !m.archived);
  const archived = all.filter((m) => m.archived);
  const resurrected: SelectResult[] = [];
  for (const m of archived) {
    const score = overlapScore(m.text, query);
    if (score >= 3) {
      resurrected.push({ ...m, archived: false, resurrected: true });
    }
  }

  const scored = [...live, ...resurrected]
    .map((m) => ({ m: m as MemoryEntry & { resurrected?: boolean }, score: scoreMemory(m as MemoryEntry, query, nowMs), hit: hasOverlap(m, query) }));
  scored.sort((a, b) => b.score - a.score || (a.m.createdAt < b.m.createdAt ? 1 : -1));

  const chosen: SelectResult[] = [];
  const seen = new Set<string>();
  let used = 0;

  type Take = 'taken' | 'dup' | 'full';
  const take = (m: MemoryEntry & { resurrected?: boolean }, weight: number): Take => {
    if (seen.has(m.id)) return 'dup';
    if (used + m.text.length > charBudget && chosen.length >= 4) return 'full';
    seen.add(m.id);
    chosen.push(m);
    used += m.text.length + weight;
    return chosen.length >= maxItems ? 'full' : 'taken';
  };

  // 1) always along: the digest + what we know about the reader
  for (const s of scored) {
    if (s.m.kind !== 'summary' && s.m.kind !== 'preference') continue;
    if (take(s.m, 4) === 'full') break;
  }
  // 2) core curated facts, even with no keyword hit — these anchor continuity
  let pinned = 0;
  for (const s of scored) {
    if (pinned >= pinnedByImportance) break;
    if (s.m.kind === 'episode' || s.m.kind === 'summary') continue;
    const r = take(s.m, 3);
    if (r === 'full') break;
    if (r === 'taken') pinned++;
  }
  // 3) keyword matches from the recent turns, best first
  for (const s of scored) {
    if (chosen.length >= maxItems) break;
    if (!s.hit) continue;
    if (take(s.m, 2) === 'full') break;
  }
  // 4) still room? top leftovers by score, so short chats use the whole budget
  for (const s of scored) {
    if (chosen.length >= maxItems) break;
    if (take(s.m, 2) === 'full') break;
  }
  return chosen;
}

function hasOverlap(m: MemoryEntry, query: QueryProfile): boolean {
  return overlapScore(m.text, query) > 0;
}

/* ---------------- rendering into the prompt ---------------- */

/** How a memory line looks inside the system prompt. */
export function renderMemoryLine(m: MemoryEntry): string {
  const tag: string = m.kind === 'episode' ? 'log' : m.kind;
  return `- [${tag}] ${m.text}`;
}

/** Zero-AI digest: fold facts into a compact bullet block (fallback path). */
export function buildDigestFallback(facts: MemoryEntry[], budget = SUMMARY_MAX_CHARS): string {
  const lines: string[] = [];
  let used = 0;
  const sorted = [...facts].sort((a, b) => b.importance - a.importance);
  for (const f of sorted) {
    const line = `- ${sanitize(f.text, 200)}`;
    if (used + line.length > budget) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

/** One-line episodic log entry — guarantees *every* turn leaves a retrievable trace. */
export function episodeLine(userText: string, replyText: string): string {
  const u = sanitize(userText, 120);
  const a = sanitize(replyText.replace(/\*/g, ''), EPISODE_MAX_CHARS - u.length - 6);
  return `U: ${u}${a ? ` | ${a}` : ''}`;
}

/* ---------------- preference contradiction detection ---------------- */

/**
 * L9: When a new preference contradicts an existing one about the same object,
 * the superseded preference should be archived. Returns the texts of preferences
 * that should be archived (matched by object name overlap).
 */
export function preferenceSupersededTexts(newNote: string, existingPrefs: { text: string }[]): string[] {
  const superseded: string[] = [];
  const newLower = newNote.toLowerCase();

  // Detect like/dislike polarity
  const newLikes = /\b(likes?|love|enjoy|pasand)\b/i.test(newNote);
  const newDislikes = /\b(dislikes?|hate|nahi pasand|bilkul nahi)\b/i.test(newNote);

  if (!newLikes && !newDislikes) return superseded;

  // Extract the object from the new preference
  const objMatch = newNote.match(/(?:likes?|love|enjoy|dislikes?|hate|pasand)\s+(.+?)(?:\.|$)/i);
  if (!objMatch) return superseded;
  const newObj = objMatch[1].toLowerCase().trim();

  for (const pref of existingPrefs) {
    const existing = pref.text.toLowerCase();
    // Check if same object is mentioned
    if (existing.includes(newObj) || newObj.split(/\s+/).some(w => w.length >= 4 && existing.includes(w))) {
      // Check opposite polarity
      const existingLikes = /\b(likes?|love|enjoy|pasand)\b/i.test(existing);
      const existingDislikes = /\b(dislikes?|hate|nahi pasand|bilkul nahi)\b/i.test(existing);
      if ((newLikes && existingDislikes) || (newDislikes && existingLikes)) {
        superseded.push(pref.text);
      }
      // Also supersede same-polarity with different qualifier (updated info)
      if ((newLikes && existingLikes) || (newDislikes && existingDislikes)) {
        if (newObj !== existing.replace(/.*?(likes?|love|enjoy|dislikes?|hate|pasand)\s+/i, '').replace(/\.$/, '').trim()) {
          superseded.push(pref.text);
        }
      }
    }
  }
  return superseded;
}

/* ---------------- local (no-AI) fact extraction ---------------- */

/**
 * Cheap offline extraction: what the reader just told us about themselves.
 * Runs on every send, before the AI is called, so nothing is lost if the
 * provider fails mid-turn. Patterns run against the ORIGINAL text so names
 * keep their capitalisation.
 */
export function extractPreferenceNotes(userText: string): string[] {
  const raw = (userText || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const notes: string[] = [];
  const T = '[^.,!?;:"।]{3,60}';

  const called = raw.match(/(?:call me|mujhe)\s+([\p{L}]{2,20})\s*(?:kaho|bulao|bulo|call)/iu);
  if (called) notes.push(`User asked to be called "${called[1]}".`);

  const selfName = raw.match(/(?:mera naam|my name is)\s+([\p{L}]{2,24})/iu);
  if (selfName) notes.push(`User's name is ${selfName[1]}.`);

  const iAm = raw.match(/i(?:'m| am)\s+([A-Z][\p{L}]{1,20})/u);
  if (iAm && !called) notes.push(`User's name is ${iAm[1]}.`);

  if (!called) {
    const like = raw.match(new RegExp(`(?:mujhe|mere ko|muje|i (?:really )?(?:like|love|enjoy)|my favou?rite(?: is)?|meri pasand)\\s+(${T})`, 'iu'));
    if (like) {
      const obj = like[1].replace(/\s+(pasand hai|achi lagti|achhi lagti|lagti hai|bahut pasand)$/iu, '').trim();
      if (obj) notes.push(`User likes ${obj}.`);
    }
  }

  const dislike = raw.match(new RegExp(`(?:mujhe|mere ko|i (?:really )?don'?t like|i hate)\\s+(${T})\\s*(?:pasand nahi|nahi pasand|bilkul nahi)`, 'iu'));
  if (dislike) notes.push(`User dislikes ${dislike[1].trim()}.`);

  const fear = raw.match(/(?:mujhe|I)\s+(?:bahut\s+)?([\p{L}]{3,24})\s+se\s+(?:dar\s+lagta|darr|lagta hai\s+\w+\s+dar)/iu);
  if (fear) notes.push(`User is scared of ${fear[1]}.`);

  // L9: Require ≥2 meaningful tokens after hamesha/always/never to avoid "never mind" etc.
  const HABIT_FILLER = new Set(['mind', 'bas', 'kuch', 'the', 'and', 'but', 'that', 'this', 'koi']);
  const habitMatch = raw.match(/\b(hamesha|always|kabhi nahi|never)\b\s+(.{4,50})/iu);
  if (habitMatch) {
    const after = habitMatch[2].trim();
    // Require at least 2 meaningful words (3+ chars, not filler) after the keyword
    const meaningfulWords = after.split(/[\s,]+/).filter(w => w.length >= 3 && !HABIT_FILLER.has(w.toLowerCase()));
    if (meaningfulWords.length >= 2) {
      notes.push(`User preference: ${habitMatch[1].toLowerCase()} ${after}.`);
    }
  }

  return notes;
}
