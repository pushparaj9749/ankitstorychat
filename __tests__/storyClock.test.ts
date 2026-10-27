/**
 * v2.12.0 — story clock guard (owner bug: "raat me baat karte waqt 4-6 chats
 * me subah ho jati he").
 *
 * Time moves only as fast as the conversation. A night stays night unless the
 * reader himself sleeps, asks for the morning or skips time.
 */
// worldState / memoryEngine reach for the device database at import time;
// everything tested here is pure.
jest.mock('../src/lib/db', () =>
  new Proxy({}, { get: (_t, key) => (key === '__esModule' ? false : jest.fn(async () => null)) }),
);

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import {
  clampStoryTimePatch,
  findTimeJump,
  inferTimeOfDay,
  periodOfClock,
  readerAskedForTimeSkip,
  timeLawFor,
  timeStepAllowed,
} from '../src/lib/storyClock';
import { buildStateExtractionMessages, buildSystemPrompt, checkAssistantReply, parseAssistantResponse, rewriteInstructionFor, REWRITE_INSTRUCTION } from '../src/lib/engine';
import { createInitialWorldState, renderWorldStateForPrompt, type WorldState } from '../src/lib/worldState';
import { toStateUpdate } from '../src/lib/memoryEngine';

const ROOT = join(__dirname, '..', 'content');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as { stories: StoryMeta[] };

function loadBundle(id: string): StoryBundle {
  const meta = manifest.stories.find((s) => s.id === id)!;
  const read = (f: string) => JSON.parse(readFileSync(join(ROOT, 'stories', meta.storyDir ?? id, f), 'utf8'));
  return {
    meta,
    story: read('story.json'),
    characters: read('characters.json'),
    world: read('world.json'),
    scenes: read('scenes.json'),
    memory: read('memory.json'),
    creator: meta.creator ?? KISSA_OWNER_CREATOR,
    source: 'remote',
  };
}

function playthroughFor(bundle: StoryBundle): Playthrough {
  return {
    id: `clock-${bundle.story.id}`,
    storyId: bundle.story.id,
    label: 'Test',
    status: 'active',
    currentSceneId: bundle.story.openingSceneId,
    state: createInitialState(bundle.world.locations[0]?.name ?? 'Somewhere'),
    progress: 0,
    messageCount: 0,
    endingId: null,
    mode: 'ai',
    providerId: null,
    createdAt: '2026-10-27T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
  };
}

const nightWorld = (bundle: StoryBundle): WorldState => {
  const ws = createInitialWorldState(playthroughFor(bundle), bundle);
  return { ...ws, storyTime: { ...ws.storyTime, timeOfDay: 'night', clockTime: '11:20 PM' } };
};

describe('initial story time comes from the opening, not a hardcoded "evening"', () => {
  test('narration cues', () => {
    expect(inferTimeOfDay('*Raat ke gyarah baje. Haveli shaant hai.*')).toBe('night');
    expect(inferTimeOfDay('*Aadhi raat ke do baje hain.*')).toBe('late-night');
    expect(inferTimeOfDay('*Shaam ke saat baje, baarish tez hai.*')).toBe('evening');
    expect(inferTimeOfDay('*Subah ke 9:05. Classroom.*')).toBe('morning');
    expect(inferTimeOfDay('*Panchami ki dopahar.*')).toBe('afternoon');
    expect(inferTimeOfDay('*Ek library ka corner.*')).toBeNull();
  });

  test('a time mentioned inside quotes does not set the scene', () => {
    expect(inferTimeOfDay("Baarish. Neon. Client ne kaha — 'Aakash Tower. Subah 4 baje. Kholna mat.'")).toBeNull();
    expect(inferTimeOfDay('*Raat ka khana.* Maa: "Kal subah jaldi uthna."')).toBe('night');
  });

  test('real stories start at their own time', () => {
    const expectations: Record<string, string | null> = {
      thakurain: 'night',
      'highway-ki-sherni': 'late-night',
      'heros-party': 'evening',
      'kuch-toh-bol-na': 'morning',
      'neo-delhi-2099': null,
    };
    for (const [id, time] of Object.entries(expectations)) {
      const b = loadBundle(id);
      expect([id, createInitialWorldState(playthroughFor(b), b).storyTime.timeOfDay]).toEqual([id, time]);
    }
  });

  test('an unknown time renders without a fake "evening" or "null"', () => {
    const b = loadBundle('neo-delhi-2099');
    const text = renderWorldStateForPrompt(createInitialWorldState(playthroughFor(b), b));
    expect(text).toContain('Story Time: time of day as the story set it, Day 1');
    expect(text).not.toMatch(/Story Time: (?:evening|null)/);
  });
});

describe('did the reader choose to let time pass?', () => {
  test.each([
    'Chalo ab so jaate hain',
    'good night jaan',
    'subah milte hain',
    'kal baat karte hain',
    'time skip karo',
    'poori raat baat karenge',
    'mujhe neend aa rahi hai',
  ])('yes: %s', (t) => expect(readerAskedForTimeSkip(t)).toBe(true));

  test.each([
    'Tum bahut sundar lag rahi ho',
    'aur batao, kya chal raha hai?',
    'kalpana karo hum dono pahadon mein hain',
    'mujhe ek sign do',
    '',
  ])('no: %s', (t) => expect(readerAskedForTimeSkip(t)).toBe(false));
});

describe('a reply that jumps ahead in time', () => {
  test('night → morning phrases are caught at night', () => {
    expect(findTimeJump('*Agli subah jab tumhari aankh khuli, Tara chai bana rahi thi.*', 'night')).toMatch(/agli subah/i);
    expect(findTimeJump('*Baaton baaton mein subah ho gayi.*', 'night')).toMatch(/subah ho gayi/i);
    expect(findTimeJump('*Khidki se suraj nikalta dikha.*', 'late-night')).toMatch(/suraj nikal/i);
    expect(findTimeJump('Lavanya: "Good morning, mere hero."', 'evening')).toMatch(/good morning/i);
    expect(findTimeJump('*Raat beet gayi, pata hi nahi chala.*', 'night')).toMatch(/raat beet gayi/i);
  });

  test('day skips are caught at any time', () => {
    expect(findTimeJump('*Kuch ghante baad…*', 'afternoon')).toMatch(/ghante baad/i);
    expect(findTimeJump('*Next day, office mein…*', 'morning')).toMatch(/next day/i);
    expect(findTimeJump('*Teen din baad.*', null)).toMatch(/din baad/i);
  });

  test('ordinary night talk is not a jump', () => {
    expect(findTimeJump('Tara: "Kal subah tumhe station chhod dungi, abhi baitho na."', 'night')).toBeNull();
    expect(findTimeJump('*Chaand ki roshni uske chehre par padti hai.* Veera: "Itni raat ko bhi jaag rahe ho?"', 'night')).toBeNull();
    expect(findTimeJump('Neelambari: "Good morning! Class shuru karein?"', 'morning')).toBeNull();
  });

  test('the reply check asks for one silent rewrite, unless the reader chose it', () => {
    const parsed = parseAssistantResponse('*Baaton baaton mein subah ho gayi.*\nTara: "Uth jao, mere hero."');
    const jumped = checkAssistantReply(parsed, { castNames: ['Tara'], readerName: 'Ankit', clock: { timeOfDay: 'night', readerText: 'Aur batao' } });
    expect(jumped.needsRewrite).toBe(true);
    expect(jumped.reasons.some((r) => r.startsWith('time-jump:'))).toBe(true);

    const chosen = checkAssistantReply(parsed, { castNames: ['Tara'], readerName: 'Ankit', clock: { timeOfDay: 'night', readerText: 'Chalo so jaate hain' } });
    expect(chosen.reasons.some((r) => r.startsWith('time-jump:'))).toBe(false);

    const noClock = checkAssistantReply(parsed, { castNames: ['Tara'], readerName: 'Ankit' });
    expect(noClock.reasons.some((r) => r.startsWith('time-jump:'))).toBe(false);
  });

  test('the rewrite nudge is about time, not about format', () => {
    const nudge = rewriteInstructionFor(['time-jump:subah ho gayi']);
    expect(nudge).toMatch(/jumped ahead in story time/);
    expect(nudge).toMatch(/night stays night/);
    expect(nudge).not.toContain(REWRITE_INSTRUCTION);
  });
});

describe('the record-keeper cannot push the night into the morning', () => {
  test('clock periods', () => {
    expect(periodOfClock('10:20 PM')).toBe('night');
    expect(periodOfClock('11:20 PM')).toBe('late-night');
    expect(periodOfClock('7:10 AM')).toBe('morning');
    expect(periodOfClock('2:30 am')).toBe('late-night');
    expect(periodOfClock('23:45')).toBe('late-night');
    expect(periodOfClock('9:30')).toBeNull();
  });

  test('one step at a time, never past the night', () => {
    expect(timeStepAllowed('evening', 'night')).toBe(true);
    expect(timeStepAllowed('night', 'late-night')).toBe(true);
    expect(timeStepAllowed('late-night', 'dawn')).toBe(false);
    expect(timeStepAllowed('night', 'morning')).toBe(false);
    expect(timeStepAllowed(null, 'morning')).toBe(true);
  });

  test('clampStoryTimePatch', () => {
    const night = { timeOfDay: 'night' as const };
    expect(clampStoryTimePatch(night, { timeOfDay: 'morning', clockTime: '7:10 AM', dayDelta: 1 }, false)).toBeUndefined();
    expect(clampStoryTimePatch(night, { timeOfDay: 'late-night', clockTime: '12:15 AM' }, false)).toEqual({ timeOfDay: 'late-night', clockTime: '12:15 AM' });
    expect(clampStoryTimePatch(night, { clockTime: '11:40 PM' }, false)).toEqual({ clockTime: '11:40 PM' });
    expect(clampStoryTimePatch(night, { timeOfDay: 'morning', dayDelta: 1 }, true)).toEqual({ timeOfDay: 'morning', dayDelta: 1 });
  });

  test('toStateUpdate keeps the night unless the reader slept', () => {
    const b = loadBundle('heros-party');
    const ws = nightWorld(b);
    const jump = { confidence: 'medium' as const, storyTime: { timeOfDay: 'morning', clockTime: '7:00 AM', dayDelta: 1 } };
    const blocked = toStateUpdate(jump, ws, null);
    expect(blocked.storyTimePatch?.timeOfDay).toBeUndefined();
    expect(blocked.storyTimePatch?.day).toBeUndefined();
    expect(blocked.storyTimePatch?.clockTime).toBeUndefined();

    const slept = toStateUpdate(jump, ws, null, true);
    expect(slept.storyTimePatch?.timeOfDay).toBe('morning');
    expect(slept.storyTimePatch?.day).toBe(ws.storyTime.day + 1);
  });
});

describe('prompts', () => {
  test('the narrator gets the TIME LAW with the current story time', () => {
    const b = loadBundle('heros-party');
    const pt = playthroughFor(b);
    const prompt = buildSystemPrompt(
      { bundle: b, playthrough: pt, profile: { nickname: 'Ankit', ageGroup: '18+', createdAt: pt.createdAt }, memories: [], history: [], worldState: nightWorld(b) },
      '18+',
    );
    expect(prompt).toContain('TIME LAW');
    expect(prompt).toContain('It is 11:20 PM (night) in the story right now.');
    expect(prompt).toMatch(/Night stays night/);
    expect(timeLawFor(null)).toContain('Keep the time of day the story has established.');
  });

  test('the record-keeper is told not to move time without cause', () => {
    const b = loadBundle('heros-party');
    const pt = playthroughFor(b);
    const [system] = buildStateExtractionMessages({ bundle: b, playthrough: pt, worldState: nightWorld(b), userText: 'Aur batao', assistantText: 'Tara: "Haan?"', playerName: 'Ankit' });
    expect(system.content).toContain('TIME RULES');
    expect(system.content).toMatch(/Never move to the next morning or day/);
  });
});

describe('Chat wires the story clock', () => {
  const chat = readFileSync(join(__dirname, '..', 'src', 'screens', 'Chat.tsx'), 'utf8');
  test('reply check gets the clock, record-keeper gets the reader-chosen skip', () => {
    expect(chat).toMatch(/clock: checkPresence\s*\?\s*\{ timeOfDay: wsForPrompt\?\.storyTime\?\.timeOfDay \?\? null/);
    expect(chat).toContain("allowTimeSkip: request.kind === 'scene' || readerAskedForTimeSkip(userText)");
    expect(chat).toMatch(/time does not skip ahead/);
  });
});
