/**
 * v2.12.0 — Story clock: time moves only as fast as the conversation.
 *
 * Owner bug report: "raat me baat karte waqt 4-6 chats me subah ho jati he".
 * The narrator used to jump from night to morning ("agli subah…") after a few
 * exchanges, and the record-keeper happily wrote that jump into the world
 * state, so the next reply started in the morning too.
 *
 * Fix, in three layers (all pure functions here, wired in engine / memoryEngine
 * / Chat):
 *  1. The initial time of day is read from the story's own opening instead of
 *     a hardcoded "evening", and the narrator gets a TIME LAW with the current
 *     story time every turn.
 *  2. A reply that jumps to morning / the next day / "hours later" while the
 *     reader did not choose to sleep or skip time gets one silent rewrite.
 *  3. The record-keeper may move time only one step (evening → night →
 *     late-night) and never past the night into the next morning or day
 *     unless the reader asked for it.
 */
import type { StoryTime, TimeOfDay } from './worldState';

export const TIME_ORDER: readonly Exclude<TimeOfDay, null>[] = [
  'dawn',
  'morning',
  'afternoon',
  'evening',
  'night',
  'late-night',
];

const DARK: ReadonlySet<string> = new Set(['evening', 'night', 'late-night']);

/** Human label used in prompts. */
export function timeLabel(t: Pick<StoryTime, 'timeOfDay' | 'clockTime'> | null | undefined): string | null {
  if (!t || !t.timeOfDay) return null;
  return t.clockTime ? `${t.clockTime} (${t.timeOfDay})` : t.timeOfDay;
}

/* ---------------- 1. initial time from the opening ---------------- */

const OPENING_CUES: { re: RegExp; time: Exclude<TimeOfDay, null> }[] = [
  { re: /\b(aadhi raat|adhi raat|midnight|aadhee raat|raat ke (?:do|teen|ek|2|3|1) baje)\b/i, time: 'late-night' },
  { re: /\b(raat|raaton|raatein|night|nighttime|chandni raat)\b/i, time: 'night' },
  { re: /\b(bhor|dawn|pau phat|pau phatne)\b/i, time: 'dawn' },
  { re: /\b(subah|savera|savere|morning|sunrise)\b/i, time: 'morning' },
  { re: /\b(dopahar|dupahar|afternoon|noon)\b/i, time: 'afternoon' },
  { re: /\b(shaam|sham|evening|sunset|dhalti)\b/i, time: 'evening' },
];

/**
 * Time of day stated by a story's opening narration ("Raat ke gyarah baje…",
 * "Subah ki dhoop…"). The EARLIEST cue in the text wins; null when the opening
 * does not say.
 */
export function inferTimeOfDay(text: string | null | undefined): TimeOfDay {
  if (!text) return null;
  // Spoken lines and quoted notes talk about OTHER times ("'Subah 4 baje
  // kholna'"); only the narration sets the scene.
  text = text.replace(/"[^"]*"|“[^”]*”|'[^'\n]{2,160}'|‘[^’]*’/g, ' ');
  let best: { at: number; time: Exclude<TimeOfDay, null> } | null = null;
  for (const cue of OPENING_CUES) {
    const m = cue.re.exec(text);
    if (m && (best === null || m.index < best.at)) best = { at: m.index, time: cue.time };
  }
  return best ? best.time : null;
}

/* ---------------- 2. did the reader ask for time to pass? ---------------- */

const READER_SKIP_RE = new RegExp(
  [
    // sleeping
    'so ja(?:o|ate|te|ti|ta|unga|ungi|enge|yenge)?', 'so gay[ae]?', 'so gayi', 'so lete', 'so le(?:te|tin)?', 'sona hai', 'sone (?:chal|ja|do|de)',
    'sote (?:hain|hai|hue)', 'neend', 'sleep(?:ing)?', 'good ?night', 'gn\\b',
    // explicit later time
    'subah', 'savere', 'savera', 'morning', 'kal', 'tomorrow', 'agle din', 'next day', 'parso',
    'raat bhar', 'poori raat', 'puri raat', 'saari raat', 'sari raat', 'all night',
    // skips
    'skip', 'time ?skip', 'fast ?forward', 'aage badh(?:o|te)? (?:time|waqt)', 'ghante baad', 'ghanton baad', 'hours later', 'din baad', 'baad mein milte',
  ].join('|'),
  'i',
);

/** True when the reader's own words ask for sleep, a later time or a skip. */
export function readerAskedForTimeSkip(text: string | null | undefined): boolean {
  if (!text) return false;
  return new RegExp(`(?:^|[^a-z])(?:${READER_SKIP_RE.source})(?:$|[^a-z])`, 'i').test(text);
}

/* ---------------- 3. did the reply jump ahead? ---------------- */

/** Day-skips — a jump whatever the time of day. */
const DAY_SKIP_RE =
  /\b(agle din|agli subah|next day|next morning|the following (?:day|morning)|following morning|(?:do|teen|kuch|kai) din baad|days later|ek hafte baad|weeks? later|kuch ghante baad|ghanton baad|(?:a few |two |three |several )?hours later|(?:do|teen|char|chaar) ghante baad)\b/i;

/** Night → morning jumps — only a jump while it is evening / night. */
const MORNING_RE =
  /\b(subah ho (?:gayi|gai|chuki|rahi|jaati|jati)|subah ho(?:ne)? (?:lagi|wali)|subah ki (?:pehli |pahli )?(?:dhoop|roshni|kiran|kirne|kirnein|hawa)|savera ho|bhor ho|pau phat|suraj (?:nikal|ug|ki pehli|ki pahli|ki kiran|ki roshni|chadh)|sunrise|sun (?:rose|was rising|comes up|came up)|morning light|good morning|raat (?:beet|guzar|kat|khatam ho) (?:gayi|gai|chuki)|alarm baj|dhoop (?:khidki|kamre|andar|chehre|parde)|chidiyon ki chahchahat|chidiya chahchaha)\w*/i;

/**
 * The phrase in `reply` that skips ahead in story time, or null. Morning
 * phrases only count while the story is in the evening or at night.
 */
export function findTimeJump(reply: string, timeOfDay: TimeOfDay): string | null {
  if (!reply) return null;
  const day = DAY_SKIP_RE.exec(reply);
  if (day) return day[0];
  if (timeOfDay && DARK.has(timeOfDay)) {
    const m = MORNING_RE.exec(reply);
    if (m) return m[0];
  }
  return null;
}

/* ---------------- 4. keep the record-keeper honest ---------------- */

/** Period of a clock time like "8:42 PM" / "23:10"; null when unclear. */
export function periodOfClock(clock: string | null | undefined): TimeOfDay {
  if (!clock) return null;
  const m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(clock);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'am') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23 || h < 13) {
    // "9:30" without AM/PM is ambiguous; 13–23 is clearly 24h.
    if (h !== 0) return null;
  }
  if (h >= 4 && h < 6) return 'dawn';
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'afternoon';
  if (h >= 16 && h < 19) return 'evening';
  if (h >= 19 && h < 23) return 'night';
  return 'late-night';
}

/** Without a reader-chosen skip, time may move at most one step, never past the night. */
export function timeStepAllowed(from: TimeOfDay, to: TimeOfDay): boolean {
  if (!from || !to) return true;
  const a = TIME_ORDER.indexOf(from);
  const b = TIME_ORDER.indexOf(to);
  if (a < 0 || b < 0) return true;
  return Math.abs(b - a) <= 1;
}

export interface StoryTimePatch {
  clockTime?: string;
  timeOfDay?: string;
  dayDelta?: number;
}

/**
 * Filter the record-keeper's storyTime patch. With `allowSkip` (the reader
 * slept, asked for the morning, tapped "Naya mod"…) everything passes.
 * Otherwise: no new day, no jump of more than one time-of-day step, and no
 * clock time that would put the story in such a jump.
 */
export function clampStoryTimePatch(
  current: Pick<StoryTime, 'timeOfDay'>,
  patch: StoryTimePatch | undefined,
  allowSkip: boolean,
): StoryTimePatch | undefined {
  if (!patch) return patch;
  if (allowSkip) return patch;
  const from = current.timeOfDay;
  const out: StoryTimePatch = {};
  let to: TimeOfDay = from;
  if (patch.timeOfDay && timeStepAllowed(from, patch.timeOfDay as TimeOfDay)) {
    out.timeOfDay = patch.timeOfDay;
    to = patch.timeOfDay as TimeOfDay;
  }
  if (patch.clockTime) {
    const p = periodOfClock(patch.clockTime);
    // The clock must agree with the (possibly unchanged) time of day.
    if (p === null || !to || timeStepAllowed(to, p)) out.clockTime = patch.clockTime;
  }
  if (patch.dayDelta !== undefined && patch.dayDelta <= 0) out.dayDelta = patch.dayDelta;
  return Object.keys(out).length ? out : undefined;
}

/* ---------------- prompt text ---------------- */

/** Narrator rule, with the current story time when it is known. */
export function timeLawFor(t: Pick<StoryTime, 'timeOfDay' | 'clockTime'> | null | undefined): string {
  const now = timeLabel(t);
  return `TIME LAW (never break it):
- ${now ? `It is ${now} in the story right now.` : 'Keep the time of day the story has established.'} Story time moves only as fast as the conversation: one exchange is a few minutes, a long talk is maybe an hour.
- Night stays night. Never jump to morning, sunrise, the next day or "hours later" (no "subah ho gayi", "agli subah", "suraj nikla", "good morning", alarms) — not after a long talk, a kiss or a romantic moment.
- Time skips ONLY when the reader himself chooses it (he sleeps, says "subah milte hain", asks to skip) or an INTERNAL ACTION INSTRUCTION below asks for one.`;
}

/** Rule for the silent record-keeper. */
export const RECORD_KEEPER_TIME_RULES = `TIME RULES:
- "storyTime" changes only as much as THIS exchange shows: usually a few minutes, so normally omit it. Never move to the next morning or day, and never add "dayDelta", unless the exchange clearly shows sleeping through the night or an explicit time skip.`;
