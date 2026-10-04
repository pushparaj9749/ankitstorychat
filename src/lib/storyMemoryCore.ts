/**
 * KISSA v2.5.1 — UNIVERSAL STORY MEMORY CORE (pure logic, no I/O).
 *
 * This module is the brain of the memory architecture. Everything here is
 * deterministic and story-agnostic: the same vocabulary, transition rules,
 * ranking and multi-hop planner are used for EVERY story (romance, crime,
 * fantasy, thriller, teen or mature). Nothing is hard-coded for a specific
 * story, character, or playthrough.
 *
 * Responsibilities
 *  - concept tokens + Hinglish aliases  → local, free semantic retrieval
 *  - event detection & importance       → what is worth remembering at all
 *  - relationship ladder + transitions  → validated, non-reverting state
 *  - character knowledge extraction     → who knows what, and why not more
 *  - retrieval ranking & multi-hop plan → which memories reach this prompt
 *  - timeline ordering, consolidation   → chronological, lossless folding
 *  - prompt rendering                   → bounded, source-tagged context
 */
import type {
  CharacterKnowledgeRecord,
  MemoryConfidence,
  MemoryImportanceLabel,
  RelationshipStateRecord,
  StoryEventRecord,
  StoryEventType,
} from '../types';
import { MEMORY_IMPORTANCE_SCORE, importanceLabel } from '../types';
import { hashText, looksTooPrivate, sanitize, tokenize } from './memoryCore';

/* ------------------------------------------------------------------ */
/* 1. Concept lexicon — meaning-based matching, no external service    */
/* ------------------------------------------------------------------ */

/**
 * Canonical concepts. Hinglish is spelled freely and stories use synonyms, so
 * plain keyword matching misses real recall ("shaadi" vs "marriage" vs "vivah").
 * Every hinge word maps to one canonical concept token (`c:wedding`) which is
 * stitched onto the record's keyword set at write time — that is the local
 * semantic index. Adding a language means extending this table, never the
 * ranking logic.
 */
export const CONCEPT_LEXICON: Record<string, string> = {
  // love / relationships
  pyaar: 'c:romance', pyar: 'c:romance', mohabbat: 'c:romance', ishq: 'c:romance', love: 'c:romance',
  romance: 'c:romance', romantic: 'c:romance', crush: 'c:romance', propose: 'c:romance',
  proposal: 'c:romance', dating: 'c:romance', date: 'c:romance', flirt: 'c:romance', ishq_2: 'c:romance',
  shaadi: 'c:wedding', shadi: 'c:wedding', vivah: 'c:wedding', marriage: 'c:wedding', married: 'c:wedding',
  marry: 'c:wedding', nikah: 'c:wedding', dulhan: 'c:wedding', dulha: 'c:wedding', biwi: 'c:wedding',
  wife: 'c:wedding', husband: 'c:wedding', pati: 'c:wedding', patni: 'c:wedding', mangalsutra: 'c:wedding',
  sagaai: 'c:engagement', sagai: 'c:engagement', engagement: 'c:engagement', engaged: 'c:engagement',
  roka: 'c:engagement', mangni: 'c:engagement', betrothal: 'c:engagement',
  dost: 'c:friendship', dostii: 'c:friendship', dosti: 'c:friendship', friend: 'c:friendship',
  friendship: 'c:friendship', yaar: 'c:friendship', yaari: 'c:friendship',
  dushman: 'c:enmity', dushmani: 'c:enmity', enemy: 'c:enmity', rival: 'c:enmity', nafrat: 'c:enmity',
  hate: 'c:enmity', breakup: 'c:separation', alag: 'c:separation', juda: 'c:separation',
  talaq: 'c:separation', divorce: 'c:separation', separated: 'c:separation', vitt: 'c:separation',
  // promises / decisions
  waada: 'c:promise', wada: 'c:promise', promise: 'c:promise', promised: 'c:promise', kasam: 'c:promise',
  vachan: 'c:promise', oath: 'c:promise', swear: 'c:promise', bharosa: 'c:trust', vishwas: 'c:trust',
  trust: 'c:trust', believe: 'c:trust', faith: 'c:trust',
  faisla: 'c:decision', fesla: 'c:decision', decide: 'c:decision', decided: 'c:decision',
  decision: 'c:decision', choose: 'c:decision', chose: 'c:decision', agreed: 'c:decision',
  agreement: 'c:decision', refuse: 'c:decision', refused: 'c:decision', manzar: 'c:decision',
  // secrets / truth / discovery
  raaz: 'c:secret', secret: 'c:secret', chhupaya: 'c:secret', chupaya: 'c:secret', hidden: 'c:secret',
  hide: 'c:secret', hiding: 'c:secret', gupt: 'c:secret', confidential: 'c:secret',
  jhoot: 'c:deception', jhuth: 'c:deception', lie: 'c:deception', lied: 'c:deception', lying: 'c:deception',
  dhokha: 'c:betrayal', dhoka: 'c:betrayal', betrayal: 'c:betrayal', betrayed: 'c:betrayal',
  cheat: 'c:betrayal', cheating: 'c:betrayal', bewafai: 'c:betrayal', ghaddar: 'c:betrayal',
  sach: 'c:truth', truth: 'c:truth', sachhai: 'c:truth',
  mila: 'c:discovery', mili: 'c:discovery', mile: 'c:discovery', found: 'c:discovery',
  discover: 'c:discovery', discovered: 'c:discovery', pata: 'c:discovery', clue: 'c:discovery',
  saboot: 'c:evidence', evidence: 'c:evidence', proof: 'c:evidence', khoj: 'c:evidence',
  reveal: 'c:revelation', revealed: 'c:revelation', raaz_khula: 'c:revelation', exposed: 'c:revelation',
  // conflict / emotion
  ladai: 'c:conflict', ladaai: 'c:conflict', jhagda: 'c:conflict', jhagdaa: 'c:conflict',
  fight: 'c:conflict', fought: 'c:conflict', argument: 'c:conflict', argu: 'c:conflict',
  gussa: 'c:anger', angry: 'c:anger', naraz: 'c:anger', anger: 'c:anger',
  maafi: 'c:apology', mafi: 'c:apology', sorry: 'c:apology', apology: 'c:apology',
  forgive: 'c:apology', forgiveness: 'c:apology', maaf: 'c:apology',
  roya: 'c:tears', roi: 'c:tears', aansu: 'c:tears', tears: 'c:tears', cried: 'c:tears', cry: 'c:tears',
  muskaan: 'c:smile', muskuraya: 'c:smile', smile: 'c:smile', smiled: 'c:smile', hasi: 'c:smile',
  dar: 'c:fear', darr: 'c:fear', darra: 'c:fear', fear: 'c:fear', afraid: 'c:fear', scared: 'c:fear',
  khushi: 'c:joy', happy: 'c:joy', joy: 'c:joy', khush: 'c:joy',
  dukh: 'c:sorrow', sad: 'c:sorrow', sorrow: 'c:sorrow', gham: 'c:sorrow', hurt: 'c:sorrow',
  maut: 'c:death', death: 'c:death', died: 'c:death', dead: 'c:death', qatl: 'c:death', murder: 'c:death',
  chot: 'c:injury', injury: 'c:injury', injured: 'c:injury', accident: 'c:injury', bimaar: 'c:illness',
  ill: 'c:illness', illness: 'c:illness', hospital: 'c:illness', dawai: 'c:illness',
  // family / social roles
  bhabhi: 'c:family', bhabi: 'c:family', bhaujai: 'c:family', devar: 'c:family', devrani: 'c:family',
  saas: 'c:family', sasur: 'c:family', sasural: 'c:family', maayka: 'c:family', bhai: 'c:family',
  behan: 'c:family', behen: 'c:family', maa: 'c:family', baap: 'c:family', papa: 'c:family',
  mummy: 'c:family', family: 'c:family', parivaar: 'c:family', pariwar: 'c:family', ghar: 'c:family',
  beti: 'c:family', beta: 'c:family', chacha: 'c:family', chachi: 'c:family', bua: 'c:family',
  // places / travel
  gaya: 'c:travel', gayi: 'c:travel', pahuncha: 'c:travel', pahunchi: 'c:travel', reached: 'c:travel',
  travel: 'c:travel', travelled: 'c:travel', returned: 'c:travel', wapas: 'c:travel', laut: 'c:travel',
  nikla: 'c:travel', chala: 'c:travel', station: 'c:travel', bazaar: 'c:travel', mandir: 'c:travel',
  // objects (high-signal props are generic storytelling vocabulary)
  tasveer: 'c:photograph', photo: 'c:photograph', photograph: 'c:photograph', picture: 'c:photograph',
  chitthi: 'c:letter', khat: 'c:letter', letter: 'c:letter', note: 'c:letter', diary: 'c:letter',
  anguthi: 'c:ring', ring: 'c:ring', haar: 'c:jewel', necklace: 'c:jewel', locket: 'c:jewel',
  chabi: 'c:key', key: 'c:key', taala: 'c:key', taalaa: 'c:key',
  paisa: 'c:money', money: 'c:money', peso: 'c:money', cash: 'c:money', karz: 'c:money', debt: 'c:money',
  // story mechanics
  kaam: 'c:task', task: 'c:task', mission: 'c:task', plan: 'c:task', planning: 'c:task',
  khoon: 'c:crime', crime: 'c:crime', chor: 'c:crime', thief: 'c:crime', police: 'c:crime',
  inspector: 'c:crime', case: 'c:crime', investigation: 'c:crime', jaanch: 'c:crime',
};

/** Concept tags for hinge words (multi-word phrases handled separately). */
const PHRASE_CONCEPTS: [RegExp, string][] = [
  [/\bchali gayi\b|\bchala gaya\b|\bnikal gaya\b/i, 'c:separation'],
  [/\bshaadi kar(?:i|li|na|ni)\b|\bmarry kar/i, 'c:wedding'],
  [/\bmaafi maang|\bmaafi di|\bmaafi mil/i, 'c:apology'],
  [/\bwaada kiya\b|\bwaada toda\b|\bpromise kiya\b|\bpromise toda\b/i, 'c:promise'],
  [/\bpata chal(?:a|i)\b|\bpata laga\b/i, 'c:discovery'],
  [/\bmaar diya\b|\bmar gaya\b|\bmar gayi\b|\bqatl kar/i, 'c:death'],
  [/\braaz khola\b|\braaz khul(?:a|i)\b|\bsach bata(?:ya|di)\b/i, 'c:revelation'],
];

/** Adds canonical concept tokens to a text's keyword list. */
export function conceptTokens(text: string): string[] {
  const out = new Set<string>();
  for (const tok of tokenize(text)) {
    const concept = CONCEPT_LEXICON[tok];
    if (concept) out.add(concept);
  }
  const raw = text.toLowerCase();
  for (const [re, concept] of PHRASE_CONCEPTS) {
    if (re.test(raw)) out.add(concept);
  }
  return [...out];
}

/** Keyword row stored on a record: literal tokens + concept tokens. */
export function keywordSet(text: string): string[] {
  const out = new Set<string>(tokenize(text).slice(0, 60));
  for (const c of conceptTokens(text)) out.add(c);
  return [...out];
}

/** Char trigram similarity — catches Hinglish spelling drift ("bhabhi"/"bhabi"). */
export function trigramSimilarity(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const t = ` ${(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
    const set = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
    return set;
  };
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / Math.max(A.size, B.size);
}

/* ------------------------------------------------------------------ */
/* 2. Sentences + trivial filters                                      */
/* ------------------------------------------------------------------ */

const NOISE_LINE = /^\s*(?:[*_~`#>|]|\s)*$/;

/**
 * Split a story turn into sentence-ish units so importance can be judged
 * per statement instead of per reply. Keeps Hinglish punctuation (।) in play.
 */
export function splitStatements(text: string): string[] {
  const cleaned = (text || '')
    .replace(/\r/g, '')
    .replace(/\*+/g, '') // narration markers are formatting, not meaning
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !NOISE_LINE.test(l))
    .join('. ');
  return cleaned
    .split(/(?<=[.!?।])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

const TRIVIAL_RE = /^(hi+|hello+|hey+|namaste|hmm+|ok(?:ay)?|haan|nahi|acha|accha|theek hai|thanks|thank you|bye|good night|good morning|kya haal|kaise ho|kaisa hai|😂+|❤️+|😊+)[.!?]*$/i;

export function isTrivialStatement(text: string): boolean {
  const t = (text || '').trim();
  if (t.length < 6) return true;
  if (TRIVIAL_RE.test(t)) return true;
  if (/^[\p{Emoji}\p{P}\s]+$/u.test(t)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* 3. Event detection                                                  */
/* ------------------------------------------------------------------ */

export interface EventSignals {
  /** Canonical concept tokens found in the statement. */
  concepts: string[];
  /** Characters named in the statement (bundle ids). */
  participants: string[];
  /** Does the statement change a relationship status? */
  relationship?: RelationshipSignal | null;
  /** Knowledge claims carried by the statement. */
  knowledge?: KnowledgeSignal[];
  /** Object names mentioned (bundle world objects or prop nouns). */
  objects: string[];
}

export interface DetectedEvent {
  type: StoryEventType;
  summary: string;
  detail?: string | null;
  importance: number;
  importanceLabel: MemoryImportanceLabel;
  confidence: MemoryConfidence;
  participants: string[];
  pairKeys: string[];
  objectNames: string[];
  keywords: string[];
  relationship?: RelationshipSignal | null;
  knowledge?: KnowledgeSignal[];
}

export interface MemoryContextRef {
  /** Player is always the first party of player-involving pairs. */
  playerId: string;
  playerName: string;
  /** Bundle characters, used for name → id resolution. */
  characters: { id: string; name: string; aliases?: string[] }[];
  /** Known locations (bundle world), used for location-change events. */
  locations?: string[];
  /** Known object names (world + bundle lore), used for object events. */
  objects?: string[];
  /** Current location for "left/returned" statements. */
  currentLocation?: string | null;
}

const TYPE_BY_CONCEPT: Record<string, { type: StoryEventType; importance: number }> = {
  'c:wedding': { type: 'marriage', importance: 4 },
  'c:engagement': { type: 'engagement', importance: 4 },
  'c:promise': { type: 'promise', importance: 4 },
  'c:betrayal': { type: 'conflict', importance: 4 },
  'c:death': { type: 'other', importance: 4 },
  'c:revelation': { type: 'discovery', importance: 4 },
  'c:separation': { type: 'relationship_change', importance: 3 },
  'c:romance': { type: 'relationship_change', importance: 3 },
  'c:friendship': { type: 'relationship_change', importance: 3 },
  'c:enmity': { type: 'conflict', importance: 3 },
  'c:conflict': { type: 'conflict', importance: 3 },
  'c:anger': { type: 'conflict', importance: 3 },
  'c:apology': { type: 'resolution', importance: 3 },
  'c:secret': { type: 'secret', importance: 3 },
  'c:deception': { type: 'secret', importance: 3 },
  'c:discovery': { type: 'discovery', importance: 3 },
  'c:evidence': { type: 'discovery', importance: 3 },
  'c:decision': { type: 'decision', importance: 3 },
  'c:trust': { type: 'relationship_change', importance: 3 },
  'c:injury': { type: 'other', importance: 3 },
  'c:illness': { type: 'other', importance: 3 },
  'c:crime': { type: 'task', importance: 3 },
  'c:money': { type: 'object', importance: 2 },
  'c:photograph': { type: 'object', importance: 3 },
  'c:letter': { type: 'object', importance: 3 },
  'c:ring': { type: 'object', importance: 3 },
  'c:jewel': { type: 'object', importance: 2 },
  'c:key': { type: 'object', importance: 3 },
  'c:travel': { type: 'location_change', importance: 2 },
  'c:task': { type: 'task', importance: 2 },
  'c:joy': { type: 'emotional', importance: 2 },
  'c:sorrow': { type: 'emotional', importance: 2 },
  'c:tears': { type: 'emotional', importance: 2 },
  'c:smile': { type: 'emotional', importance: 1 },
  'c:fear': { type: 'emotional', importance: 2 },
  'c:family': { type: 'conversation', importance: 1 },
  'c:truth': { type: 'discovery', importance: 3 },
};

/** Order-insensitive pair key: "player::poonam" and "poonam::player" collapse. */
export function pairKeyOf(aId: string, bId: string): string {
  return [aId, bId].map((s) => s.trim().toLowerCase()).sort().join('::');
}

export function pairParts(pairKey: string): [string, string] {
  const [a, b] = pairKey.split('::');
  return [a ?? '', b ?? ''];
}

/** All pair keys involving the given characters (player included). */
export function pairKeysFor(participants: string[], playerId: string): string[] {
  const uniq = [...new Set(participants.filter(Boolean))];
  const keys = new Set<string>();
  for (const a of uniq) {
    for (const b of uniq) {
      if (a === b) continue;
      const [x, y] = [a, b].sort();
      keys.add(pairKeyOf(x, y));
    }
  }
  // Participants necessarily pair with the player even when the player is not
  // "named" in the sentence (the reader is the MC).
  for (const c of uniq) if (c !== playerId) keys.add(pairKeyOf(playerId, c));
  return [...keys];
}

/** Resolve characters named in a statement (exact name or alias). */
export function resolveParticipants(text: string, ctx: MemoryContextRef): string[] {
  const lower = (text || '').toLowerCase();
  const found: string[] = [];
  for (const ch of ctx.characters) {
    const names = [ch.name, ...(ch.aliases ?? [])].filter(Boolean);
    for (const n of names) {
      const needle = n.toLowerCase();
      if (needle.length < 3) continue;
      if (lower.includes(needle)) {
        found.push(ch.id);
        break;
      }
    }
  }
  return [...new Set(found)];
}

export function resolveObjects(text: string, ctx: MemoryContextRef): string[] {
  const lower = (text || '').toLowerCase();
  const found: string[] = [];
  for (const o of ctx.objects ?? []) {
    if (o && o.length >= 3 && lower.includes(o.toLowerCase())) found.push(o);
  }
  return [...new Set(found)].slice(0, 4);
}

export function resolveLocation(text: string, ctx: MemoryContextRef): string | null {
  const lower = (text || '').toLowerCase();
  for (const loc of ctx.locations ?? []) {
    if (loc && loc.length >= 3 && lower.includes(loc.toLowerCase())) return loc;
  }
  return null;
}

/* ---- relationship status lexicon + universal ladder ---- */

/**
 * Universal closeness ladder. Stories may invent statuses; those get tier -1
 * ("known label, unknown position") and can never be silently downgraded into
 * a lower universal tier.
 */
export const RELATIONSHIP_LADDER = [
  'stranger',
  'acquaintance',
  'friend',
  'close_friend',
  'romantic_interest',
  'dating',
  'engaged',
  'married',
] as const;

/** States that are explicit endings of a relationship (valid downgrades). */
export const RELATIONSHIP_END_STATES = [
  'separated',
  'divorced',
  'widowed',
  'broken_up',
  'estranged',
  'enemies',
] as const;

const STATUS_LEXICON: { status: string; tier: number; re: RegExp }[] = [
  { status: 'married', tier: 7, re: /\b(shaadi|shadi|vivah|marriage|married|nikah|biwi|wife|husband|pati|patni|mangalsutra|dulhan|dulha)\b/i },
  { status: 'engaged', tier: 6, re: /\b(engaged|engagement|sagaai|sagai|roka|mangni|betrothed)\b/i },
  { status: 'dating', tier: 5, re: /\b(dating|date par|girlfriend|boyfriend|premika|premi)\b/i },
  { status: 'romantic_interest', tier: 4, re: /\b(crush|pyaar ho|love ho|propose|proposal|dil de|romantic interest)\b/i },
  { status: 'close_friend', tier: 3, re: /\b(close friend|best friend|ghani dost|bahut kareeb|bahut close)\b/i },
  { status: 'friend', tier: 2, re: /\b(dost|dosti|friend|friendship|yaar|yaari)\b/i },
  { status: 'acquaintance', tier: 1, re: /\b(acquaintance|jaan-pehchaan|jaan pehchaan|mila tha|pehchaan)\b/i },
  { status: 'separated', tier: -2, re: /\b(separated|alag ho|alag ho gaye|juda ho)\b/i },
  { status: 'divorced', tier: -2, re: /\b(divorce|talaq)\b/i },
  { status: 'broken_up', tier: -2, re: /\b(breakup|break up|tod diya rishta|rishta toot)\b/i },
  { status: 'enemies', tier: -3, re: /\b(dushman|enemy|enemies|dushmani)\b/i },
];

export function universalTierOf(status: string): number {
  const s = (status || '').trim().toLowerCase().replace(/\s+/g, '_');
  const hit = STATUS_LEXICON.find((x) => x.status === s);
  if (hit) return hit.tier;
  const ladderIdx = (RELATIONSHIP_LADDER as readonly string[]).indexOf(s);
  if (ladderIdx >= 0) return ladderIdx;
  return -1;
}

export function normalizeStatus(status: string): string {
  return (status || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40);
}

export interface RelationshipSignal {
  /** Character id (or the player id when a nameless partner is implied). */
  characterId: string;
  pairKey: string;
  status: string;
  tier: number;
  confidence: MemoryConfidence;
  /** Wording that produced the signal (for validation + traceability). */
  evidence: string;
  /** The statement asserts the relationship explicitly (not a guess). */
  explicit: boolean;
}

/**
 * Detect "X and Y are now <status>" style statements.
 * Story-agnostic: it only needs the relationship VOCABULARY, never a story id.
 */
export function detectRelationshipSignal(
  statement: string,
  ctx: MemoryContextRef,
  participants: string[],
): RelationshipSignal | null {
  const text = statement || '';
  const hit = STATUS_LEXICON.find((s) => s.re.test(text));
  if (!hit) return null;

  // Who does this status belong to? Prefer a named character other than the
  // player; the reader is the MC, so "meri shaadi Poonam se hui" resolves too.
  const others = participants.filter((p) => p !== ctx.playerId);
  let characterId: string | null = null;
  if (others.length === 1) characterId = others[0];
  else if (others.length > 1) {
    // Prefer the character whose name appears closest to the status keyword.
    const m = text.match(hit.re);
    const at = m && m.index !== undefined ? m.index : 0;
    let best = others[0];
    let bestDist = Infinity;
    for (const id of others) {
      const ch = ctx.characters.find((c) => c.id === id);
      if (!ch) continue;
      const idx = text.toLowerCase().indexOf(ch.name.toLowerCase());
      if (idx >= 0 && Math.abs(idx - at) < bestDist) {
        bestDist = Math.abs(idx - at);
        best = id;
      }
    }
    characterId = best;
  }
  if (!characterId) {
    // No other person named: "hum log shaadi kar liye" — player + implied partner
    // is too ambiguous to persist as state. Record nothing rather than guess.
    return null;
  }

  const explicit = /\b(hai|hain|ho gayi|ho gaya|ho gaye|hua|hui|kar li|kar liya|married|shaadi)\b/i.test(text);
  const unsure = /\b(shayad|lagta hai|maybe|perhaps|ho sakta|kya pata)\b/i.test(text);
  return {
    characterId,
    pairKey: pairKeyOf(ctx.playerId, characterId),
    status: normalizeStatus(hit.status),
    tier: hit.tier,
    confidence: unsure ? 'low' : explicit ? 'high' : 'medium',
    evidence: sanitize(text, 240),
    explicit,
  };
}

/** Detect status statements in a whole turn and return one signal per pair. */
export function detectRelationshipSignals(
  text: string,
  ctx: MemoryContextRef,
): RelationshipSignal[] {
  const out = new Map<string, RelationshipSignal>();
  for (const statement of splitStatements(text)) {
    if (isTrivialStatement(statement)) continue;
    const participants = resolveParticipants(statement, ctx);
    const signal = detectRelationshipSignal(statement, ctx, participants);
    if (!signal) continue;
    const existing = out.get(signal.pairKey);
    // Prefer the most confident / highest-tier reading of the same turn.
    if (!existing || signal.confidence === 'high' || signal.tier > existing.tier) {
      out.set(signal.pairKey, signal);
    }
  }
  return [...out.values()];
}

/* ---- knowledge claims ---- */

export interface KnowledgeSignal {
  /** Character who does NOT know (the one being kept in the dark) or who learns. */
  characterId: string;
  characterName: string;
  fact: string;
  source: CharacterKnowledgeRecord['source'];
  learnedFrom: string | null;
  confidence: MemoryConfidence;
}

const KNOWS_RE = /\b(jaanta|jaanti|jaante|janta|janti|pata hai|pata tha|knows|knew|know)\b/i;
const LEARNS_RE = /\b(pata chala|pata laga|seekha|suni|suna|bataya|bata diya|bata di|bata rahi|bata raha|bata rahe|bataungi|bataunga|revealed|told|found out|learned|learnt)\b/i;
/**
 * Generic attribution: "X ne Y kiya" / "maine X chhupaya" attached to an
 * information noun, i.e. the speaker/subject is holding, telling or learning
 * information. Story-agnostic — it only reads grammar and information words.
 */
const ATTRIBUTED_RE =
  /\b(?:maine|usne|tumne|aapne|hamne|[\p{L}]{3,}\s+ne)\b[^.]{0,80}?\b(raaz|secret|sach|jhooth|jhoot|chhupaya|chhupayi|bataya|bata diya|bata\s?di|pata hai|jaanta|jaanti)\b/iu;
const IMPERATIVE_RE = /\b(batao|bata\s?do|bata\s?de|bataiye|kaho|bolo|batana)\b/i;

/**
 * Extract "who knows what" from a statement.
 *  - "Poonam ko pata hai ki X"                 → Poonam knows X
 *  - "Bhabhi: \"Maine ek raaz chhupaya hai\""   → Bhabhi knows that secret
 *  - "Bhabhi ne bataya ki X"                   → Bhabhi knows X (she is the source)
 *  - "Bhabhi ne Poonam ko bataya ki X"         → Poonam learns X from Bhabhi
 *  - "Bhabhi ko pata nahi ki X"                → nothing stored (ignorance is the default)
 * Questions and imperative requests ("mujhe batao") never create knowledge.
 */
export function extractKnowledgeSignals(
  statement: string,
  ctx: MemoryContextRef,
  participants: string[],
): KnowledgeSignal[] {
  const text = statement || '';
  if (!text) return [];
  const mentioned = participants.filter((p) => p !== ctx.playerId);
  if (!mentioned.length) return [];

  const negated =
    /\b(nahi jaanta|nahi jaanti|nahi janta|nahi janti|pata nahi|pata nahin|doesn't know|does not know|koi nahi jaanta)\b/i.test(text);
  if (negated) return [];

  const knows = KNOWS_RE.test(text);
  const learns = LEARNS_RE.test(text);
  const isQuestion = /\?\s*$/.test(text.trim());
  const imperative = IMPERATIVE_RE.test(text) && !knows; // "mujhe sach batao" is a request
  const attributed = !isQuestion && !imperative && ATTRIBUTED_RE.test(text);
  const holds = attributed && !knows && !learns;
  if (!knows && !learns && !holds) return [];

  const signals: KnowledgeSignal[] = [];
  for (const id of mentioned) {
    const ch = ctx.characters.find((c) => c.id === id);
    if (!ch) continue;
    const nameIdx = text.toLowerCase().indexOf(ch.name.toLowerCase());
    // "Bhabhi ne ... bataya" — when someone else is also in the sentence, the
    // speaker is the source and the listener is the one who learns.
    const isSubjectSource = nameIdx >= 0 && nameIdx <= 2 && /^(ne|ki|ka|ke)\b/i.test(text.slice(ch.name.length).trim());
    if (isSubjectSource && mentioned.length > 1 && !holds) continue;
    signals.push({
      characterId: id,
      characterName: ch.name,
      fact: sanitize(text.replace(/\s+/g, ' '), 240),
      source: learns ? 'told' : 'witnessed',
      learnedFrom: null,
      confidence: holds && !knows ? 'medium' : 'high',
    });
  }
  return signals.slice(0, 3);
}

/* ---- main detector ---- */

export interface DetectionOptions {
  /** Max events kept per turn (highest importance wins). */
  maxEvents?: number;
  /** Minimum importance to persist at all. Default 2 (MEDIUM). */
  minImportance?: number;
}

/**
 * Turn one exchange into zero or more durable events. Universal rules only:
 * importance comes from generic storytelling signals, never from a story id.
 */
export function detectEvents(
  userText: string,
  assistantText: string,
  ctx: MemoryContextRef,
  opts: DetectionOptions = {},
): DetectedEvent[] {
  const maxEvents = opts.maxEvents ?? 6;
  const minImportance = opts.minImportance ?? 2;
  const found: DetectedEvent[] = [];
  const seen = new Set<string>();

  const statements: { text: string; role: 'user' | 'assistant' }[] = [
    ...splitStatements(userText).map((text) => ({ text, role: 'user' as const })),
    ...splitStatements(assistantText).map((text) => ({ text, role: 'assistant' as const })),
  ];

  for (const { text, role } of statements) {
    if (isTrivialStatement(text)) continue;
    if (text.length > 400) continue; // runaway paragraphs are not events
    if (looksTooPrivate(text)) continue;

    const concepts = conceptTokens(text);
    const participants = resolveParticipants(text, ctx);
    const objects = resolveObjects(text, ctx);
    const relationship = detectRelationshipSignal(text, ctx, participants);
    const knowledge = extractKnowledgeSignals(text, ctx, participants);
    const location = resolveLocation(text, ctx);

    let type: StoryEventType = 'conversation';
    let importance = 1;
    for (const c of concepts) {
      const mapped = TYPE_BY_CONCEPT[c];
      if (!mapped) continue;
      if (mapped.importance > importance) {
        importance = mapped.importance;
        type = mapped.type;
      }
    }
    if (relationship) {
      importance = Math.max(importance, relationship.tier >= 6 ? 4 : 3);
      type = relationship.tier >= 6 ? (relationship.status === 'married' ? 'marriage' : 'engagement') : 'relationship_change';
    }
    if (knowledge.length) {
      importance = Math.max(importance, 3);
      if (type === 'conversation') type = 'knowledge';
    }
    if (location && participants.length) {
      importance = Math.max(importance, 2);
      if (type === 'conversation') type = 'location_change';
    }

    // A statement the reader typed carries deliberate intent → small bump.
    if (role === 'user' && importance >= 2) importance = Math.min(4, importance);

    if (importance < minImportance) continue;
    // Two bare names with no signal is chatter, not memory.
    if (type === 'conversation' && importance < 3 && !knowledge.length) continue;

    const summary = sanitize(text, 240);
    const dedupe = hashText(`${type}|${summary.toLowerCase()}`);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const pairKeys = pairKeysFor(participants, ctx.playerId);
    found.push({
      type,
      summary,
      detail: null,
      importance,
      importanceLabel: importanceLabel(importance),
      confidence: role === 'user' ? 'high' : 'medium',
      participants,
      pairKeys,
      objectNames: objects,
      keywords: keywordSet(`${summary} ${type} ${pairKeys.join(' ')} ${objects.join(' ')}`),
      relationship: relationship ?? null,
      knowledge,
    });
  }

  // Highest importance first, then stable order; cap the turn.
  return found
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.importance - a.e.importance || a.i - b.i)
    .slice(0, maxEvents)
    .map(({ e }) => e);
}

/**
 * Knowledge that a revelation invalidates. Universal rule: when a statement
 * reveals the truth (raaz khulna / sach pata chalna / jhoot pakda gaya) and it
 * mentions a character, the character's earlier knowledge records about that
 * subject stop being reliable — they are marked invalidated and can be
 * re-learned later (the raw record stays on disk).
 */
export function knowledgeInvalidatedBy(
  revelation: string,
  knowledge: CharacterKnowledgeRecord[],
  participants: string[],
): CharacterKnowledgeRecord[] {
  if (!participants.length) return [];
  const lower = revelation.toLowerCase();
  const words = new Set(lower.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4));
  if (!words.size) return [];
  const out: CharacterKnowledgeRecord[] = [];
  for (const k of knowledge) {
    if (k.status === 'invalidated') continue;
    if (!participants.includes(k.characterId)) continue;
    const factWords = k.fact.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
    const shared = factWords.filter((w) => words.has(w)).length;
    if (shared >= 2) out.push(k);
  }
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* 4. State transition validation (contradiction protection)           */
/* ------------------------------------------------------------------ */

export interface TransitionDecision {
  accepted: boolean;
  /** true when accepted only because the model gave explicit evidence. */
  flagged?: boolean;
  reason: string;
  /** Set when the proposal contradicts established state. */
  contradiction?: {
    kind: 'relationship_downgrade';
    expected: string;
    proposed: string;
    reason: string;
  };
}

const BREAK_EVIDENCE_RE = /\b(talaq|divorce|separat|alag ho|alag ho gaye|chhod diya|chhod di|tod diya|toot gaya|breakup|break up|mar gayi|mar gaya|death|died|widow|vidhwa|nikamma|rishta khatam|khatam ho gaya)\b/i;
const WEAK_EVIDENCE_RE = /\b(shayad|lagta hai|maybe|perhaps|kya pata|yaad nahi|bhool)\b/i;

/**
 * Validate a proposed relationship status change against the stored state.
 *
 * Rules (universal, story-agnostic):
 *  - no existing state → accept any higher-than-stranger status
 *  - upward move → accept; a big jump (≥3 tiers) needs evidence, else flagged
 *  - same tier → accept (refresh / confirm)
 *  - downgrade → REJECT unless the turn explicitly narrates a break
 *    (talaq/divorce/breakup/death/leaving) at medium+ confidence. This is what
 *    stops "MC + Poonam married" from silently reverting to "stranger".
 *  - unknown custom label → never allowed to replace a known universal state.
 */
export function validateTransition(
  current: { status: string; tier: number } | null,
  proposed: { status: string; tier: number },
  evidence: string,
  confidence: MemoryConfidence,
  explicit: boolean,
): TransitionDecision {
  const evidenceText = `${evidence ?? ''} ${current?.status ?? ''} ${proposed.status}`;
  const nextTier = proposed.tier;

  if (!current || current.tier <= 0) {
    // A story may define its OWN relationship labels (tier -1). Those are valid
    // new states; only "stranger"/nothing is not worth recording.
    const isEndState = RELATIONSHIP_END_STATES.includes(proposed.status as never);
    if (nextTier === 0 && !isEndState) {
      return { accepted: false, reason: 'no established relationship and nothing new to record' };
    }
    return { accepted: true, reason: 'new relationship state established' };
  }

  if (nextTier === -1) {
    if (current.tier > 0) {
      return {
        accepted: false,
        reason: 'unknown custom status cannot replace an established universal state without explicit story support',
      };
    }
    return { accepted: true, reason: 'custom status updated' };
  }

  if (nextTier > current.tier) {
    const jump = nextTier - current.tier;
    const weak = !evidence.trim() || confidence === 'low' || WEAK_EVIDENCE_RE.test(evidenceText);
    if ((jump >= 3 && weak) || (jump >= 2 && WEAK_EVIDENCE_RE.test(evidenceText))) {
      return {
        accepted: true,
        flagged: true,
        reason: `large jump ${current.status} → ${proposed.status} accepted but flagged for weak evidence`,
      };
    }
    return { accepted: true, reason: 'relationship advanced' };
  }

  if (nextTier === current.tier) {
    return { accepted: true, reason: 'relationship confirmed' };
  }

  // Downgrade. Marriage/dating may not silently revert.
  const breaking = BREAK_EVIDENCE_RE.test(evidenceText);
  const isEndState = RELATIONSHIP_END_STATES.includes(proposed.status as never);
  if ((breaking || isEndState) && confidence !== 'low' && explicit) {
    return { accepted: true, flagged: true, reason: 'explicit break/ending of relationship accepted' };
  }
  return {
    accepted: false,
    reason: `downgrade ${current.status} → ${proposed.status} contradicts established state (no explicit break evidence)`,
    contradiction: {
      kind: 'relationship_downgrade',
      expected: `${current.status} (tier ${current.tier})`,
      proposed: `${proposed.status} (tier ${nextTier})`,
      reason: 'established relationship state is protected; a valid transition requires explicit in-story evidence',
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Retrieval: intent, ranking, multi-hop                            */
/* ------------------------------------------------------------------ */

export interface QueryProfileV2 {
  tokens: Set<string>;
  concepts: Set<string>;
  characters: string[];
  pairs: string[];
  /** Question asks about the past ("pehle kya hua tha") → history intent. */
  historyIntent: boolean;
  /** Question names a character → perspective/pair focus. */
  focusCharacter?: string | null;
  eventTypes: StoryEventType[];
  wantsUnresolved: boolean;
}

const HISTORY_CUES = /\b(pehle|pahle|earlier|before|previously|yaad|remember|bhool|forgot|kya hua|kya hua tha|hua tha|histor|flashback|wapas|returned|baad|after)\b/i;
const UNRESOLVED_CUES = /\b(promise|waada|pending|adhoo?a|unresolved|baaki|reh gaya|karna hai|kasam|secret|raaz)\b/i;

export function buildQueryProfileV2(
  query: string,
  ctx: MemoryContextRef,
  opts: { relationshipPair?: string | null; eventTypes?: StoryEventType[] } = {},
): QueryProfileV2 {
  const text = query || '';
  const tokens = new Set(tokenize(text));
  const concepts = new Set(conceptTokens(text));
  const characters = resolveParticipants(text, ctx);
  const pairs = new Set<string>();
  for (const c of characters) if (c !== ctx.playerId) pairs.add(pairKeyOf(ctx.playerId, c));
  if (opts.relationshipPair) pairs.add(opts.relationshipPair);
  // Relationship words in the query map to the pairs of every mentioned character.
  if (concepts.has('c:family') || concepts.has('c:wedding') || concepts.has('c:romance')) {
    for (const c of characters) pairs.add(pairKeyOf(ctx.playerId, c));
  }
  return {
    tokens,
    concepts,
    characters,
    pairs: [...pairs],
    historyIntent: HISTORY_CUES.test(text),
    focusCharacter: characters.find((c) => c !== ctx.playerId) ?? null,
    eventTypes: opts.eventTypes?.length ? opts.eventTypes : [],
    wantsUnresolved: UNRESOLVED_CUES.test(text),
  };
}

export interface RankOptions {
  nowMs?: number;
  /** Half-life in days for recency decay (longer for history questions). */
  halfLifeDays?: number;
  /** Weight multiplier for recency (history questions lower it). */
  recencyWeight?: number;
}

/** Semantic (concept + token + trigram) overlap between a query and keywords. */
export function semanticOverlap(query: QueryProfileV2, keywords: string[], text: string): number {
  if (!keywords?.length && !text) return 0;
  const kw = new Set(keywords ?? []);
  let score = 0;
  for (const t of query.tokens) {
    if (kw.has(t)) score += 1 + Math.min(1, Math.max(0, (t.length - 4) / 3));
  }
  for (const c of query.concepts) if (kw.has(c)) score += 2.2;
  // Trigram fallback for spelling drift (bounded: only when there was some signal).
  if (score > 0) {
    for (const k of kw) {
      if (k.length < 5) continue;
      if (query.tokens.has(k)) continue;
      for (const t of query.tokens) {
        if (t.length >= 5 && trigramSimilarity(t, k) >= 0.6) {
          score += 0.6;
          break;
        }
      }
    }
  }
  return score;
}

function recencyWeightOf(iso: string, nowMs: number, halfLifeDays: number, weight: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (nowMs - t) / 86_400_000);
  return weight * Math.pow(0.5, days / halfLifeDays);
}

/** One event's relevance for this retrieval request. */
export function scoreEvent(
  e: StoryEventRecord,
  query: QueryProfileV2,
  opts: RankOptions = {},
): number {
  const nowMs = opts.nowMs ?? Date.now();
  const halfLife = opts.halfLifeDays ?? (query.historyIntent ? 45 : 10);
  const recencyWeight = opts.recencyWeight ?? (query.historyIntent ? 1.2 : 3.0);

  let score = semanticOverlap(query, e.keywords, e.summary);
  if (query.pairs.length) {
    for (const p of query.pairs) if (e.pairKeys.includes(p)) score += 4.5;
  }
  if (query.characters.length) {
    for (const c of query.characters) if (e.participants.includes(c)) score += 3;
  }
  if (query.eventTypes.length && query.eventTypes.includes(e.type)) score += 3;
  score += e.importance * 2;
  score += recencyWeightOf(e.occurredAt, nowMs, halfLife, recencyWeight);
  if (e.status === 'active' && (e.type === 'promise' || e.type === 'task' || e.type === 'secret')) score += 2.5;
  if (query.wantsUnresolved && e.status === 'active') score += 2;
  if (e.status === 'superseded') score -= 4;
  if (e.confidence === 'high') score += 1.2;
  else if (e.confidence === 'low') score -= 1.2;
  if (e.source === 'user' || e.source === 'manual') score += 1;
  if (e.sourceMessageIds?.length) score += 0.8; // traceable to raw archive
  if (e.type === 'rollup') score -= 0.5; // prefer the concrete events when both match
  return score;
}

export function scoreRelationship(
  r: RelationshipStateRecord,
  query: QueryProfileV2,
): number {
  let score = 0;
  if (query.pairs.includes(r.pairKey)) score += 12;
  for (const c of query.characters) if (r.a.id === c || r.b.id === c) score += 5;
  score += semanticOverlap(query, [], `${r.a.name} ${r.b.name} ${r.status}`) * 1.5;
  score += Math.max(0, r.tier) * 0.4;
  if (query.concepts.has('c:family') || query.concepts.has('c:wedding') || query.concepts.has('c:romance')) score += 2;
  return score;
}

export function scoreKnowledge(k: CharacterKnowledgeRecord, query: QueryProfileV2): number {
  if (k.status === 'invalidated') return -Infinity;
  let score = semanticOverlap(query, [], `${k.fact} ${k.characterName}`) * 1.2;
  for (const c of query.characters) if (k.characterId === c) score += 4;
  if (query.focusCharacter && k.characterId === query.focusCharacter) score += 3;
  if (query.concepts.has('c:secret') || query.concepts.has('c:revelation') || query.concepts.has('c:discovery')) score += 2.5;
  if (k.source === 'seed') score += 0.5;
  return score;
}

/**
 * Multi-hop expansion.
 *
 * hop 1 — the query itself (tokens, concepts, characters, pairs)
 * hop 2 — knowledge records matched by the query pull in the events they came
 *         from (and the events of the same relationship pair)
 * hop 3 — those events pull in their raw source messages (verbatim evidence)
 *
 * The planner is pure: it takes the archive slice and returns what to fetch.
 */
export interface MultiHopPlan {
  hops: string[];
  eventIds: Set<string>;
  /** Pairs discovered while hopping (e.g. "Bhabhi knows this secret" → pair). */
  extraPairs: string[];
  knowledgeIds: Set<string>;
  /** Message ids whose verbatim text should be pulled as evidence. */
  evidenceMessageIds: string[];
}

export function planMultiHop(
  query: QueryProfileV2,
  archive: { events: StoryEventRecord[]; knowledge: CharacterKnowledgeRecord[]; relationships: RelationshipStateRecord[] },
): MultiHopPlan {
  const hops: string[] = ['direct'];
  const eventIds = new Set<string>();
  const knowledgeIds = new Set<string>();
  const extraPairs = new Set<string>();
  const evidenceMessageIds: string[] = [];

  for (const k of archive.knowledge) {
    const score = scoreKnowledge(k, query);
    if (score >= 4) {
      knowledgeIds.add(k.id);
      hops.push('knowledge');
      if (k.sourceEventId) eventIds.add(k.sourceEventId);
      extraPairs.add(pairKeyOf(k.characterId, 'player'));
      for (const c of archive.relationships) {
        if (c.a.id === k.characterId || c.b.id === k.characterId) extraPairs.add(c.pairKey);
      }
      for (const c of query.characters) extraPairs.add(pairKeyOf(c, k.characterId));
    }
  }

  for (const c of query.characters) {
    for (const r of archive.relationships) {
      if (r.a.id === c || r.b.id === c) {
        extraPairs.add(r.pairKey);
        hops.push('pair');
      }
    }
  }
  for (const pair of extraPairs) {
    for (const e of archive.events) {
      if (e.pairKeys.includes(pair) && (e.importance >= 3 || ['promise', 'secret', 'decision', 'marriage'].includes(e.type))) {
        eventIds.add(e.id);
      }
    }
  }
  // Unresolved promises/tasks/threads always stay discoverable.
  if (query.wantsUnresolved) {
    for (const e of archive.events) {
      if (e.status === 'active' && (e.type === 'promise' || e.type === 'task' || e.type === 'secret')) {
        eventIds.add(e.id);
        hops.push('unresolved');
      }
    }
  }
  for (const e of archive.events) {
    if (eventIds.has(e.id) && e.sourceMessageIds?.length) {
      evidenceMessageIds.push(...e.sourceMessageIds.slice(-2));
    }
  }
  return {
    hops: [...new Set(hops)],
    eventIds,
    knowledgeIds,
    extraPairs: [...extraPairs],
    evidenceMessageIds: [...new Set(evidenceMessageIds)].slice(0, 6),
  };
}

export interface RetrieveOptions {
  limit?: number;
  eventTypes?: StoryEventType[];
  timeRange?: { from?: number; to?: number };
  importance?: MemoryImportanceLabel[];
  relationshipPair?: string | null;
  nowMs?: number;
}

export interface RankedArchive {
  events: StoryEventRecord[];
  relationships: RelationshipStateRecord[];
  knowledge: CharacterKnowledgeRecord[];
  hops: string[];
  candidates: number;
}

/**
 * Full local retrieval: rank, filter, multi-hop expand, order chronologically.
 * Pure — the caller provides the archive (already isolated by story/playthrough).
 */
export function rankArchive(
  archive: { events: StoryEventRecord[]; knowledge: CharacterKnowledgeRecord[]; relationships: RelationshipStateRecord[] },
  query: string,
  ctx: MemoryContextRef,
  opts: RetrieveOptions = {},
): RankedArchive {
  const limit = Math.max(1, Math.min(40, opts.limit ?? 14));
  const profile = buildQueryProfileV2(query, ctx, {
    relationshipPair: opts.relationshipPair,
    eventTypes: opts.eventTypes,
  });

  let events = archive.events.filter((e) => !e.archived);
  if (opts.eventTypes?.length) events = events.filter((e) => opts.eventTypes!.includes(e.type));
  if (opts.importance?.length) {
    const wanted = new Set(opts.importance.map((l) => MEMORY_IMPORTANCE_SCORE[l]));
    events = events.filter((e) => wanted.has(e.importance));
  }
  if (opts.timeRange) {
    if (opts.timeRange.from !== undefined) events = events.filter((e) => e.seq >= opts.timeRange!.from!);
    if (opts.timeRange.to !== undefined) events = events.filter((e) => e.seq <= opts.timeRange!.to!);
  }
  const plan = planMultiHop(profile, { events, knowledge: archive.knowledge, relationships: archive.relationships });

  const scored: { e: StoryEventRecord; score: number }[] = [];
  for (const e of events) {
    let score = scoreEvent(e, profile, { nowMs: opts.nowMs });
    if (plan.eventIds.has(e.id)) score += 5;
    if (opts.relationshipPair && e.pairKeys.includes(opts.relationshipPair)) score += 6;
    if (score > 0.5) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.seq - b.e.seq);

  // Diversity guard: never fill the whole budget with one event type.
  const byType = new Map<string, number>();
  const selected: StoryEventRecord[] = [];
  const hardCapPerType = Math.max(3, Math.ceil(limit / 2));
  for (const { e } of scored) {
    const used = byType.get(e.type) ?? 0;
    if (used >= hardCapPerType && selected.length >= Math.min(4, limit)) continue;
    byType.set(e.type, used + 1);
    selected.push(e);
    if (selected.length >= limit) break;
  }

  // A selected rollup still resolves to its concrete source events: consolidated
  // summaries accelerate retrieval, they never replace the raw record.
  const selectedIds = new Set(selected.map((e) => e.id));
  const byId = new Map(archive.events.map((e) => [e.id, e]));
  for (const e of [...selected]) {
    if (e.type !== 'rollup' || !e.sourceEventIds?.length) continue;
    for (const id of e.sourceEventIds.slice(0, 4)) {
      const member = byId.get(id);
      if (member && !selectedIds.has(id)) {
        selectedIds.add(id);
        selected.push(member);
      }
    }
  }

  const relationships = archive.relationships
    .map((r) => ({ r, score: scoreRelationship(r, profile) }))
    .filter((x) => x.score > 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.r);

  // Character knowledge: relevant facts, plus everything the focus character
  // knows (so the narrator can respect their perspective).
  const knowledgeScored = archive.knowledge
    .map((k) => ({ k, score: scoreKnowledge(k, profile) }))
    .filter((x) => x.score > 2.5)
    .sort((a, b) => b.score - a.score);
  const chosenKnowledge: CharacterKnowledgeRecord[] = [];
  const seenKnowledge = new Set<string>();
  for (const { k } of knowledgeScored) {
    if (seenKnowledge.has(k.id)) continue;
    seenKnowledge.add(k.id);
    chosenKnowledge.push(k);
    if (chosenKnowledge.length >= 8) break;
  }

  return {
    events: selected,
    relationships,
    knowledge: chosenKnowledge,
    hops: plan.hops,
    candidates: archive.events.length,
  };
}

/** Chronological order (timeline). Never presents the future as the past. */
export function chronological<T extends { seq: number; occurredAt: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => a.seq - b.seq || (a.occurredAt < b.occurredAt ? -1 : 1));
}

/** Decade-ish human label for "how long ago" inside the story. */
export function timelineLabel(event: { seq: number }, currentSeq: number): string {
  const delta = Math.max(0, currentSeq - event.seq);
  if (delta === 0) return 'this turn';
  if (delta <= 3) return 'a few turns ago';
  if (delta <= 12) return 'earlier this chapter';
  if (delta <= 40) return 'earlier in the story';
  return 'long ago';
}

/* ------------------------------------------------------------------ */
/* 6. Consolidation                                                    */
/* ------------------------------------------------------------------ */

export interface ConsolidationCluster {
  key: string;
  pairKey: string | null;
  eventType: StoryEventType;
  eventIds: string[];
  /** Deterministic, human-readable rollup (never AI-authoritative). */
  summary: string;
  importance: number;
  participants: string[];
  sourceMessageIds: string[];
  firstSeq: number;
  lastSeq: number;
}

/**
 * Group old events into durable rollups. Raw events are only marked archived —
 * a rollup is a retrieval accelerator, never a replacement for the record.
 */
export function planConsolidation(
  events: StoryEventRecord[],
  opts: { keepLive?: number; minCluster?: number; maxClusters?: number; window?: number } = {},
): ConsolidationCluster[] {
  const keepLive = opts.keepLive ?? 60;
  const minCluster = opts.minCluster ?? 4;
  const maxClusters = opts.maxClusters ?? 6;
  const windowSize = opts.window ?? 25;

  const active = events.filter((e) => !e.archived && e.type !== 'rollup' && e.status !== 'superseded');
  if (active.length <= keepLive) return [];
  const sorted = chronological(active);
  const foldable = sorted.slice(0, sorted.length - keepLive);

  const buckets = new Map<string, StoryEventRecord[]>();
  for (const e of foldable) {
    const pair = e.pairKeys[0] ?? 'global';
    const bucketKey = `${pair}|${e.type}|${Math.floor(e.seq / windowSize)}`;
    const list = buckets.get(bucketKey) ?? [];
    list.push(e);
    buckets.set(bucketKey, list);
  }

  const clusters: ConsolidationCluster[] = [];
  for (const [key, list] of buckets) {
    if (list.length < minCluster) continue;
    const withNames = list[0];
    const [a, b] = pairParts(withNames.pairKeys[0] ?? '');
    const pairLabel = [a, b].filter(Boolean).join(' & ') || 'the story';
    const typeLabel = EVENT_TYPE_LABEL[withNames.type] ?? 'event';
    const names = [...new Set(list.flatMap((e) => e.participants))].slice(0, 3);
    const summary = sanitize(
      `${pairLabel}: ${list.length} ${typeLabel}${list.length > 1 ? 's' : ''} in this stretch of the story — ${
        list.map((e) => e.summary.split(/[.|]/)[0]).slice(0, 3).join('; ')
      }`,
      300,
    );
    clusters.push({
      key,
      pairKey: withNames.pairKeys[0] ?? null,
      eventType: withNames.type,
      eventIds: list.map((e) => e.id),
      summary,
      importance: Math.max(...list.map((e) => e.importance)),
      participants: names,
      sourceMessageIds: [...new Set(list.flatMap((e) => e.sourceMessageIds ?? []))].slice(0, 12),
      firstSeq: list[0].seq,
      lastSeq: list[list.length - 1].seq,
    });
    if (clusters.length >= maxClusters) break;
  }
  return clusters;
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  relationship_change: 'relationship moment',
  marriage: 'marriage milestone',
  engagement: 'engagement milestone',
  meeting: 'meeting',
  conversation: 'important conversation',
  promise: 'promise',
  decision: 'decision',
  secret: 'secret',
  discovery: 'discovery',
  conflict: 'conflict',
  resolution: 'resolution',
  location_change: 'move',
  object: 'object',
  emotional: 'emotional beat',
  task: 'open task',
  knowledge: 'shared information',
  rollup: 'summary',
  contradiction: 'flagged contradiction',
  other: 'moment',
};

/* ------------------------------------------------------------------ */
/* 7. Prompt rendering (bounded)                                       */
/* ------------------------------------------------------------------ */

export interface RenderInput {
  relationships: RelationshipStateRecord[];
  events: StoryEventRecord[];
  knowledge: CharacterKnowledgeRecord[];
  contradictions?: { expected: string; proposed: string; reason: string }[];
  evidence?: { speaker: string | null; role: string; text: string }[];
  currentSeq: number;
  nameOf?: (id: string) => string;
  charBudget?: number;
}

/**
 * The block the narrator receives. Compact, ordered oldest → newest, tagged
 * with importance/confidence, and always leave room for character knowledge so
 * the model never lets a character act on something they were never told.
 */
export function renderMemoryBlock(input: RenderInput): string {
  const budget = input.charBudget ?? 4200;
  const nameOf = input.nameOf ?? ((id: string) => id);
  const lines: string[] = [];
  let used = 0;
  const push = (line: string) => {
    if (used + line.length + 1 > budget) return false;
    lines.push(line);
    used += line.length + 1;
    return true;
  };

  if (input.relationships.length) {
    push('CURRENT RELATIONSHIP STATE (persistent across scenes — never contradict this):');
    for (const r of input.relationships) {
      const hist = r.history.filter((h) => h.status !== r.status).map((h) => h.status).slice(-3);
      const histTxt = hist.length ? ` | history: ${hist.join(' → ')} → ${r.status}` : '';
      push(
        `- ${r.a.name} ↔ ${r.b.name}: ${r.status.toUpperCase()} (confidence ${r.confidence})${histTxt}${
          r.sourceEventIds.length ? ` [source events: ${r.sourceEventIds.slice(-2).join(', ')}]` : ''
        }`,
      );
    }
  }

  const promises = input.events.filter((e) => e.type === 'promise' || e.type === 'task' || e.type === 'secret');
  if (promises.length) {
    push('OPEN PROMISES / DECISIONS / SECRETS (must stay consistent):');
    for (const e of chronological(promises).slice(0, 6)) {
      push(
        `- [${e.type}|${e.importanceLabel}] ${e.summary} (${e.status}${e.participants.length ? `, ${e.participants.map(nameOf).join(', ')}` : ''})`,
      );
    }
  }

  const history = input.events.filter((e) => !promises.includes(e));
  if (history.length) {
    push('RELEVANT PAST EVENTS (oldest first — retrieve, don\'t invent):');
    for (const e of chronological(history)) {
      const when = timelineLabel(e, input.currentSeq);
      const who = e.participants.length ? ` [${e.participants.map(nameOf).join(', ')}]` : '';
      const place = e.location ? ` @ ${e.location}` : '';
      push(`- #${e.seq} (${when}) ${e.type}: ${e.summary}${who}${place} [${e.importanceLabel}, ${e.confidence}]`);
    }
  }

  if (input.knowledge.length) {
    push('CHARACTER KNOWLEDGE (each character may act ONLY on what they know):');
    for (const k of input.knowledge.slice(0, 8)) {
      push(`- ${k.characterName} knows: ${sanitize(k.fact, 160)} (${k.source}, ${k.confidence})`);
    }
  }

  if (input.contradictions?.length) {
    push('FLAGGED CONTRADICTIONS (do NOT act on these; established state wins):');
    for (const c of input.contradictions.slice(0, 3)) {
      push(`- proposed "${c.proposed}" contradicts stored "${c.expected}" — ${c.reason}`);
    }
  }

  if (input.evidence?.length) {
    push('RAW ARCHIVE EVIDENCE (verbatim source, highest authority):');
    for (const ev of input.evidence.slice(0, 3)) {
      push(`- ${ev.speaker ?? (ev.role === 'user' ? 'Player' : 'Narrator')}: ${sanitize(ev.text, 180)}`);
    }
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 8. Structured-state (kissa-state) validation                        */
/* ------------------------------------------------------------------ */

export interface ProposedStateChanges {
  relationships: { pairKey: string; status: string; tier: number; confidence: MemoryConfidence; evidence: string; explicit: boolean }[];
  promises: string[];
  decisions: string[];
  secrets: string[];
  knowledge: { characterId: string; fact: string; source: CharacterKnowledgeRecord['source'] }[];
}

/**
 * Read structured state the narrator volunteered (kissa-state block) into the
 * engine's vocabulary. Anything unrecognised is ignored, never trusted blindly.
 */
export function parseProposedState(
  raw: unknown,
  ctx: MemoryContextRef,
): ProposedStateChanges {
  const out: ProposedStateChanges = { relationships: [], promises: [], decisions: [], secrets: [], knowledge: [] };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;

  const statusMaps: unknown[] = [];
  if (o.relationshipStatus) statusMaps.push(o.relationshipStatus);
  if (o.relationshipStates && !Array.isArray(o.relationshipStates)) statusMaps.push(o.relationshipStates);
  for (const map of statusMaps) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (typeof value !== 'string' || !value.trim() || value.length > 40) continue;
      const characterId = key.trim().toLowerCase() === 'player' ? ctx.playerId : key.trim().toLowerCase();
      const known = ctx.characters.find((c) => c.id === characterId || c.name.toLowerCase() === key.trim().toLowerCase());
      const finalId = known?.id ?? characterId;
      if (finalId === ctx.playerId) continue;
      const status = normalizeStatus(value);
      out.relationships.push({
        pairKey: pairKeyOf(ctx.playerId, finalId),
        status,
        tier: universalTierOf(status),
        confidence: 'high',
        evidence: `kissa-state relationshipStatus: ${finalId}=${status}`,
        explicit: true,
      });
    }
  }

  // Array form: [{pair|characters, status}]
  if (Array.isArray(o.relationshipStates)) {
    for (const item of (o.relationshipStates as unknown[]).slice(0, 6)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const status = typeof rec.status === 'string' ? normalizeStatus(rec.status) : '';
      if (!status) continue;
      const ids = Array.isArray(rec.characters)
        ? (rec.characters as unknown[]).filter((x): x is string => typeof x === 'string').map((s) => s.toLowerCase())
        : typeof rec.characterId === 'string'
          ? [rec.characterId.toLowerCase()]
          : [];
      const other = ids.map((id) => ctx.characters.find((c) => c.id === id || c.name.toLowerCase() === id)?.id ?? id).find((id) => id !== ctx.playerId);
      if (!other) continue;
      out.relationships.push({
        pairKey: pairKeyOf(ctx.playerId, other),
        status,
        tier: universalTierOf(status),
        confidence: 'high',
        evidence: `kissa-state relationshipStates[${other}]=${status}`,
        explicit: true,
      });
    }
  }

  const stringList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 4 && x.length < 200).map((s) => sanitize(s, 200)) : [];

  out.promises = [...stringList(o.promises), ...stringList(o.threads)];
  out.decisions = stringList(o.decisions);
  out.secrets = stringList(o.secrets);

  if (Array.isArray(o.characterKnowledge)) {
    for (const item of (o.characterKnowledge as unknown[]).slice(0, 6)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const characterId = typeof rec.characterId === 'string' ? rec.characterId.toLowerCase() : '';
      const fact = typeof rec.fact === 'string' ? sanitize(rec.fact, 200) : '';
      if (!characterId || !fact) continue;
      const known = ctx.characters.find((c) => c.id === characterId || c.name.toLowerCase() === characterId);
      out.knowledge.push({ characterId: known?.id ?? characterId, fact, source: 'witnessed' });
    }
  }
  return out;
}
