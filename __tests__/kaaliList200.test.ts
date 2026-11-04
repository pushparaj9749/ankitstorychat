import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharactersFile, StoryBundle, StoryMeta, WorldFile } from '../src/types';
import { validateBundle } from '../src/lib/validate';

const ID = 'kaali-list-200';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((story) => story.id === ID)!;
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const story = read('story.json');
const characters = read('characters.json') as CharactersFile;
const world = read('world.json') as WorldFile;
const scenes = read('scenes.json');
const memory = read('memory.json');
const avantika = characters.characters.find((character) => character.id === 'avantika')!;
const bundle: StoryBundle = {
  meta,
  story,
  characters,
  world,
  scenes,
  memory,
  creator: meta.creator!,
  source: 'remote',
};

test('Kaali List v2 is a valid OTA character-direction fix', () => {
  expect(manifest.contentVersion).toBeGreaterThanOrEqual(67);
  expect(meta.version).toBe(2);
  for (const file of [story, characters, world, scenes, memory]) expect(file.version).toBe(2);
  expect(validateBundle(bundle).issues).toEqual([]);
  expect(meta.description).toMatch(/direct, disciplined aur rules par pukki/);
  expect(meta.description).not.toMatch(/arrogant|order jaisa/i);
});

test('Avantika keeps full attitude without arrogance or indiscipline', () => {
  expect(avantika.personality).toMatch(/visible attitude and immense self-belief/);
  expect(avantika.personality).toMatch(/disciplined officer's confidence/);
  expect(avantika.personality).toMatch(/With senior officers she is courteous and attentive/);
  expect(avantika.personality).toMatch(/presents evidence respectfully through the proper channel/);
  expect(avantika.speakingStyle).toMatch(/correct rank or sir\/ma'am/);
  expect(avantika.speakingStyle).toMatch(/listens without interrupting/);
  expect(avantika.speakingStyle).toMatch(/never sarcasm or defiance/);
  expect(avantika.relationshipWithUser).toMatch(/cooperation is requested and documented/);
  expect(avantika.relationshipWithUser).toMatch(/never commanded or assumed/);
});

test('senior respect, lawful orders and police procedure are explicit story rules', () => {
  const rules = world.rules.join('\n');
  const safety = story.safetyNotes.join('\n');
  expect(rules).toMatch(/correct rank or sir\/ma'am/);
  expect(rules).toMatch(/compliance with lawful orders and the chain of command/);
  expect(rules).toMatch(/never interrupts, mocks, eye-rolls, shouts, refuses lawful direction or bypasses authorization/);
  expect(rules).toMatch(/required approvals, lawful consent or authorization, chain of custody, evidence preservation/);
  expect(rules).toMatch(/No rule-breaking for convenience/);
  expect(rules).toMatch(/requests cooperation rather than issuing orders/);
  expect(safety).toMatch(/never insults a senior, disobeys lawful direction, bypasses procedure/);
});

test('the opening now models a firm but professional IPS officer', () => {
  const opening = scenes.scenes[0];
  const narration = opening.narration.join('\n');
  expect(opening.narration[2]).toMatch(/crisp knock/);
  expect(opening.narration[2]).toMatch(/professional nod/);
  expect(opening.narration[2]).toMatch(/cap console se door/);
  expect(opening.narration[5]).toMatch(/^Avantika: "Kya tum original recording/);
  expect(narration).toMatch(/posture measured aur professional/);
  expect(narration).not.toMatch(/bina knock|Original recording chahiye|request karne wali body language nahi/);
  const processChoice = opening.choices.find((choice: { id: string }) => choice.id === 'set_boundary');
  expect(processChoice.text).toMatch(/process clear kar dete hain/);
  expect(processChoice.shortLabel).toBe('Process clear karo');
  for (const choice of opening.choices) expect(choice.next ?? null).toBeNull();
});

test('old disrespectful direction cannot silently return', () => {
  const canon = JSON.stringify([story, characters, world, scenes, memory]);
  for (const removed of [
    'often asks for help as though she is issuing an order',
    'Her ego is real',
    'Her ego and confidence remain consistent',
    'bold, arrogant, sharp-tongued',
    'Studio ka darwaza bina knock khulta hai',
    'attitude bhi handle karna hoga',
    'madat maangne ke bawajood bilkul bhi request karne wali body language nahi',
  ]) {
    expect(canon).not.toContain(removed);
  }
  expect(story.endings).toEqual([]);
  expect(scenes.endings).toEqual([]);
  expect(story.media.gallery).toHaveLength(9);
});
