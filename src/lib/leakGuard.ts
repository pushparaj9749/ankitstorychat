/**
 * KISSA v2.7.0 — LEAK GUARD (pure logic, no I/O).
 *
 * The narrator receives private notes every turn (story-so-far summary, key
 * facts, relationships, important objects, hidden truths, who-knows-what).
 * None of that may ever reach the reader. engine.stripStateLeakage already
 * removes JSON-shaped `kissa-state` blocks; this module removes everything
 * else a model can do wrong:
 *
 *  - label lines   "Important objects: earbud (Mahi)", "**Memory:** …",
 *                  "Relationships: trust 40", "Rishte: …", "Yaadein: …"
 *  - heading blocks "CURRENT WORLD STATE:" / "## Memory" + their bullet lists
 *  - YAML-ish state "kissa-state:" followed by `key: value` lines
 *  - tags          "[STATE] …", "[MEMORY] …", "(OOC: …)", "*(HIDDEN TRUTH: …)*"
 *  - HTML comments "<!-- state … -->"
 *  - copies        plain lines that are near-verbatim copies of private notes
 *  - reader lines  the narrator writing dialogue for the reader
 *
 * It is deliberately conservative: story-format lines (faded `*narration*`
 * and `Name: "dialogue"`) are never touched by the label filter, and a cast
 * member whose name happens to equal a label is protected.
 */
import { trigramSimilarity } from './storyMemoryCore';

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** Internal labels the prompt (or a confused model) uses for hidden state. */
const LABELS = [
  // objects / inventory
  'important objects', 'important object', 'important items', 'key objects', 'key items', 'objects', 'items',
  'inventory', 'inventory add', 'inventory remove', 'object', 'cheezein', 'saaman',
  // memory
  'memory', 'memories', 'memory notes', 'memory note', 'memory update', 'memory updates', 'long term memory',
  'long-term memory', 'short term memory', 'short-term memory', 'yaadein', 'yaad', 'yaadein update',
  'remembered', 'remember', 'to remember', 'facts', 'key facts', 'pakki yaadein', 'new memory', 'new memories',
  // relationships
  'relationship', 'relationships', 'relationship status', 'relationship state', 'relationship states',
  'relationship update', 'rishte', 'rishta', 'trust', 'affection', 'tension', 'romance meter',
  // threads / plot bookkeeping
  'unresolved threads', 'open threads', 'active threads', 'plot threads', 'threads', 'threads resolved',
  'resolved threads', 'active events', 'completed events', 'events', 'promises', 'decisions', 'secrets',
  'hidden truth', 'hidden truths', 'hidden secret', 'hidden secrets', 'secret',
  // world / scene bookkeeping
  'world state', 'current world state', 'story state', 'story state so far', 'state', 'hidden state',
  'legacy state', 'game state', 'state update', 'current state', 'kissa state', 'kissa-state', 'kissastate',
  'location memory', 'location', 'current location', 'previous location', 'present', 'present characters',
  'absent', 'absent characters', 'characters present', 'story time', 'storytime', 'time of day', 'clock time',
  'scene', 'scene id', 'current scene', 'next scene', 'arc', 'current arc', 'activity', 'current activity',
  'player action', 'player state', 'player is', 'player mood', 'flags', 'past choices', 'choices made',
  'end story', 'endstory', 'character states', 'character state', 'character knowledge', 'knowledge', 'knows',
  // prompt section names
  'story so far', 'summary', 'chapter summary', 'chapter summaries', 'long-term story archive',
  'story archive', 'archive', 'canon', 'continuity', 'continuity law', 'secrecy law', 'lore', 'world rules',
  'narrator notes', 'narrator note', 'private notes', 'private narrator notes', 'internal notes', 'notes',
  'note', 'ooc', 'out of character', 'system note', 'instruction', 'instructions',
  'stage 1', 'stage 2', 'stage 3', 'latest turn cues', 'reader journey', 'debug',
];
const LABEL_SET = new Set(LABELS);
/** Labels so specific they are internal even inside faded `*…*` narration. */
const STRONG_LABELS = new Set([
  'important objects', 'important object', 'important items', 'key objects', 'inventory', 'memory', 'memories',
  'memory notes', 'memory update', 'yaadein', 'key facts', 'pakki yaadein', 'relationships', 'relationship status',
  'relationship states', 'unresolved threads', 'open threads', 'plot threads', 'world state',
  'current world state', 'story state', 'hidden state', 'kissa state', 'kissa-state', 'location memory',
  'character knowledge', 'hidden truth', 'hidden truths', 'present characters', 'absent characters',
  'story time', 'past choices', 'narrator notes', 'private notes', 'long-term story archive', 'story so far',
]);

/** Words that, inside a leading [..] / (..) tag, mark the line as internal. */
const TAG_WORDS =
  'hidden|state|memory|memories|yaad|yaadein|kissa|narrator|internal|ooc|out of character|system|note|notes|secret|secrets|world|update|updated|debug|meta|lore|canon|archive|summary|truth|knowledge|relationship|relationships|inventory|object|objects|thread|threads';
const TAG_LINE_RE = new RegExp(String.raw`^[\[(（{]\s*(?:${TAG_WORDS})\b[^\])）}]*(?:[\])）}]|$)`, 'i');
/** "HIDDEN TRUTH", "STATE UPDATE", "MEMORY UPDATED" … anywhere at line start. */
const META_PHRASE_RE =
  /^(?:hidden\s+(?:truth|truths|state|secret|secrets|notes?)|(?:state|memory|world\s*state|kissa[\s_-]*state)\s+(?:update[sd]?|block|notes?|saved|log)|narrator['’]?s?\s+notes?|private\s+notes?|internal\s+notes?|ooc)\b/i;

/* ------------------------------------------------------------------ */
/* Line helpers                                                        */
/* ------------------------------------------------------------------ */

/** `Name: "…"` / `Name: “…”` dialogue. */
const DIALOGUE_RE = /^\s*[A-Z\u0900-\u097F][\p{L}0-9.'’_\- ]{0,30}?\s*:\s*["“”]/u;
/** Faded narration `*…*` (asterisk followed by a non-space). */
const NARRATION_RE = /^\s*\*[^\s*]/;
/** Bullets / numbered items / indented continuation lines. */
const BULLET_RE = /^\s*(?:[-–—•·▪◦]\s+|\*\s+|\d{1,2}[.)]\s+|[a-z][.)]\s+)/i;
const INDENTED_RE = /^(?:\s{2,}|\t)\S/;
/** `key: value` where value is not dialogue — YAML-ish payloads. */
const KEY_VALUE_RE = /^\s*["']?[\p{L}_][\p{L}0-9_ ()'’\-]{0,40}["']?\s*[:=]\s*(?!["“])\S/u;
const SEPARATOR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,}|={3,}|~{3,})\s*$/;

function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`*_#>~]/g, ' ')
    .replace(/[^\p{L}0-9\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip leading markdown decoration (heading marks, bold, bullets, quotes). */
function undecorate(line: string): string {
  let s = line.trim();
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^(?:[-–—•·▪◦]|\d{1,2}[.)])\s+/, '')
      .replace(/^(?:\*\*|__)\s*/, '')
      .replace(/^[*_]\s*(?=[\[(（])/, '')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

interface LabelHit {
  label: string;
  rest: string;
}

/** `Label: rest` / `**Label:** rest` / `## Label` / `LABEL` → hit, else null. */
function matchLabel(line: string, protectedNames: Set<string>): LabelHit | null {
  const s = undecorate(line);
  if (!s) return null;
  // `**Label:** rest` / `Label: rest` / `Label = rest` / `Label — rest`
  const m = s.match(/^([^:=\n]{1,48}?)\s*(?:\*\*|__)?\s*[:=]\s*(?:\*\*|__)?\s*(.*)$/);
  if (m) {
    const label = normLabel(m[1].replace(/[(（][^)）]*[)）]/g, ' '));
    const rest = m[2] ?? '';
    if (!label || protectedNames.has(label)) return null;
    if (LABEL_SET.has(label)) return { label, rest };
    // "Important objects (Mahi)", "Relationships (0-100)", "Memory #3"
    const head = label.replace(/\s*\d+$/, '').trim();
    if (LABEL_SET.has(head)) return { label: head, rest };
    return null;
  }
  // Bare heading line: `## Memory`, `**Unresolved threads**`, `CURRENT WORLD STATE`
  const bare = normLabel(s);
  if (bare && LABEL_SET.has(bare) && !protectedNames.has(bare)) {
    const isHeading = /^\s*#{1,6}\s/.test(line) || /^\s*(?:\*\*|__)/.test(line) || s === s.toUpperCase();
    if (isHeading) return { label: bare, rest: '' };
  }
  return null;
}

function isTagLine(line: string): boolean {
  const s = line.trim().replace(/^[*_]+/, '').replace(/[*_]+$/, '').trim();
  if (TAG_LINE_RE.test(s)) return true;
  return META_PHRASE_RE.test(undecorate(s).replace(/^[\[(（{]\s*/, ''));
}

function isStoryLine(line: string): boolean {
  return NARRATION_RE.test(line) || DIALOGUE_RE.test(line);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface GuardOptions {
  /** Cast names: a character called "Raaz" or "Notes" is never treated as a label. */
  protectedNames?: string[];
  /** Private notes sent to the model this turn (for copy detection). */
  hiddenNotes?: string;
  /** The reader's name — dialogue written for the reader is removed. */
  readerName?: string;
}

export interface GuardResult {
  text: string;
  /** Internal state / notes were found and removed. */
  leaked: boolean;
  /** The narrator wrote a line of dialogue for the reader. */
  spokeForReader: boolean;
  /** Short machine-readable reasons (for tests / diagnostics). */
  reasons: string[];
}

/**
 * Remove every non-JSON form of internal-state leakage. Pure and idempotent:
 * guard(guard(x)) === guard(x).
 */
export function guardVisibleText(text: string, opts: GuardOptions = {}): GuardResult {
  const reasons: string[] = [];
  if (!text) return { text: '', leaked: false, spokeForReader: false, reasons };
  const protectedNames = new Set((opts.protectedNames ?? []).map(normLabel).filter(Boolean));

  let src = text.replace(/\r/g, '');

  // HTML comments (terminated or not).
  const beforeComments = src;
  src = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/, '');
  if (src !== beforeComments) reasons.push('html-comment');

  const lines = src.split('\n');
  const out: string[] = [];
  /** Inside a removed heading / YAML block: drop list + key-value continuation. */
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      inBlock = false;
      out.push(line);
      continue;
    }

    if (inBlock) {
      if (isStoryLine(line) && !BULLET_RE.test(line)) {
        inBlock = false; // story resumes
      } else if (BULLET_RE.test(line) || INDENTED_RE.test(line) || KEY_VALUE_RE.test(line) || /^[\]}),]+$/.test(trimmed)) {
        continue;
      } else {
        inBlock = false;
      }
    }

    // Marker line without JSON (`kissa-state:` / ```kissa-state handled by engine).
    if (/^\s*`{0,3}\s*kissa[\s_-]*state\b/i.test(trimmed) && !/[{]/.test(trimmed)) {
      reasons.push('state-marker');
      inBlock = true;
      continue;
    }

    if (isTagLine(line)) {
      reasons.push('tag-line');
      continue;
    }

    {
      const narration = NARRATION_RE.test(line) && !BULLET_RE.test(line);
      const probe = narration ? trimmed.replace(/^\*+/, '').replace(/\*+$/, '') : line;
      const found = matchLabel(probe, protectedNames);
      const hit = found && (!narration || STRONG_LABELS.has(found.label)) ? found : null;
      if (hit) {
        reasons.push(`label:${hit.label}`);
        // A heading (or a label whose value continues below) opens a block.
        if (!hit.rest.trim() || /[:,]$/.test(hit.rest.trim())) inBlock = true;
        else {
          // Same-line value, but a list may still follow (e.g. "Threads: 2").
          const next = lines[i + 1] ?? '';
          if (BULLET_RE.test(next) || INDENTED_RE.test(next)) inBlock = true;
        }
        continue;
      }
    }

    out.push(line);
  }

  let result = out.join('\n');

  // Copy detection: plain (non-story-format) lines that near-duplicate the
  // private notes are leaks even when the model dropped every label.
  if (opts.hiddenNotes) {
    const hidden = hiddenLinesOf(opts.hiddenNotes);
    if (hidden.length) {
      const kept: string[] = [];
      for (const line of result.split('\n')) {
        const t = line.trim();
        if (t.length >= 18 && !isStoryLine(line)) {
          const plain = t.replace(/[*_`#>]/g, '').trim();
          if (hidden.some((h) => trigramSimilarity(plain, h) >= 0.62)) {
            reasons.push('copied-note');
            continue;
          }
        }
        kept.push(line);
      }
      result = kept.join('\n');
    }
  }

  // Dialogue written for the reader ("Ankit: …", "You: …").
  let spokeForReader = false;
  const readerNames = ['you', 'tum', 'aap', 'reader', 'player', 'user'];
  if (opts.readerName?.trim()) readerNames.push(opts.readerName.trim().toLowerCase());
  const readerRe = new RegExp(
    String.raw`^\s*\**\s*(?:${readerNames.map(escapeRe).join('|')})\s*\**\s*:\s*["“]`,
    'i',
  );
  const readerSafe = new Set([...protectedNames]);
  result = result
    .split('\n')
    .filter((line) => {
      if (!readerRe.test(line)) return true;
      const name = normLabel(line.split(':')[0]);
      if (readerSafe.has(name)) return true;
      spokeForReader = true;
      reasons.push('spoke-for-reader');
      return false;
    })
    .join('\n');

  // Tidy: trailing separators / empty bold markers left behind by removed blocks.
  const tidyLines = result.split('\n');
  while (tidyLines.length && (SEPARATOR_RE.test(tidyLines[tidyLines.length - 1]) || !tidyLines[tidyLines.length - 1].trim())) {
    tidyLines.pop();
  }
  while (tidyLines.length && (SEPARATOR_RE.test(tidyLines[0]) || !tidyLines[0].trim())) tidyLines.shift();
  result = tidyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const leaked = reasons.some((r) => r !== 'spoke-for-reader');
  return { text: result, leaked, spokeForReader, reasons };
}

/** Lines of the private notes worth comparing against (labels and bullets peeled). */
export function hiddenLinesOf(notes: string): string[] {
  const out: string[] = [];
  for (const raw of (notes || '').split('\n')) {
    let s = undecorate(raw).replace(/^[\[(（]?\s*(?:hidden truth|secret)\s*[:\])）]\s*/i, '');
    const lab = s.match(/^([^:]{1,40}):\s*(.+)$/);
    if (lab && LABEL_SET.has(normLabel(lab[1]))) s = lab[2];
    s = s.replace(/[*_`]/g, '').trim();
    if (s.length >= 18) out.push(s);
    if (out.length >= 400) break;
  }
  return out;
}

/**
 * For stored history (render + the window sent back to the model): the same
 * filter, without reader-line removal side effects being reported.
 */
export function sanitizeStoredText(text: string, protectedNames: string[] = []): string {
  return guardVisibleText(text, { protectedNames }).text;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
