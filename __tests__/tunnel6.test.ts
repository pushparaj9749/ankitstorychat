import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharactersFile, StoryBundle, StoryMeta, WorldFile } from '../src/types';
import { validateBundle } from '../src/lib/validate';

/**
 * "Tunnel 6" — survival drama: six strangers, one night, a stalled metro and a
 * service spur that may or may not open. Like Aakhri Gawah it must be a real
 * OTA package: expandable cast, player-only agency, one small opening moment,
 * no predetermined arc and no ending.
 */
const ID = 'tunnel-6';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((story) => story.id === ID)!;
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const story = read('story.json');
const characters = read('characters.json') as CharactersFile & {
  playerVisualDesign: string;
  characters: Array<CharactersFile['characters'][number] & { visualDesign: string }>;
};
const world = read('world.json') as WorldFile;
const scenes = read('scenes.json');
const memory = read('memory.json');
const rhea = characters.characters.find((character) => character.id === 'rhea')!;
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

function jpegSize(buffer: Buffer): { w: number; h: number } {
  let index = 2;
  while (index < buffer.length) {
    const marker = buffer[index + 1];
    const length = buffer.readUInt16BE(index + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buffer.readUInt16BE(index + 5), w: buffer.readUInt16BE(index + 7) };
    }
    index += 2 + length;
  }
  throw new Error('No JPEG SOF marker');
}

test('Tunnel 6 is a valid OTA package on the current content version', () => {
  expect(manifest.contentVersion).toBeGreaterThanOrEqual(70);
  expect(meta).toBeDefined();
  expect(meta.title).toBe('Tunnel 6');
  expect(meta.version).toBe(1);
  expect(meta.storyDir).toBe(ID);
  expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
  expect(validateBundle(bundle).issues).toEqual([]);
  for (const file of [story, characters, world, scenes, memory]) expect(file.version).toBe(1);
  expect(meta.genres).toEqual(expect.arrayContaining(['Thriller', 'Survival']));
});

test('the cover is an exact-title 2:3 portrait and nothing else is shipped yet', () => {
  expect(story.media.cover).toBe('assets/cover.jpg');
  expect(story.media.gallery).toHaveLength(1);
  expect(story.media.gallery[0]).toEqual({ id: 'cover', file: 'assets/cover.jpg', kind: 'cover', label: 'Tunnel 6' });
  const bytes = readFileSync(join(DIR, 'assets', 'cover.jpg'));
  expect(bytes.length).toBeGreaterThan(100_000);
  expect(jpegSize(bytes)).toEqual({ w: 848, h: 1264 });
  // Cover-only for now: the Story Detail screen relies on this tag to show the
  // "aur media jald" hint instead of a hollow Media Library (v2.13.1).
  expect(meta.tags).toEqual(expect.arrayContaining(['media-expanding', 'expandable-cast']));
});

test('the opening is one small moment: two dialogues and player-only next steps', () => {
  const opening = scenes.scenes.find((scene: { id: string }) => scene.id === story.openingSceneId)!;
  expect(opening).toBeDefined();
  expect(opening.id).toBe('last_train');
  expect(scenes.scenes).toHaveLength(1);
  const dialogue = opening.narration.filter((line: string) => /^[A-Z][\w .'-]+: "/.test(line));
  expect(dialogue.length).toBeGreaterThanOrEqual(2);
  expect(dialogue.length).toBeLessThanOrEqual(3);
  for (const line of dialogue) expect(line).toMatch(/^Rhea: |^Iqbal: /);
  // The moment ends on a question, not on a decision the player did not make.
  expect(opening.narration[opening.narration.length - 1]).not.toMatch(/^Rhea: |^Iqbal: /);
  expect(opening.choices).toHaveLength(4);
  for (const choice of opening.choices) {
    expect(choice.next).toBeNull();
    expect(choice.shortLabel.length).toBeLessThanOrEqual(20);
    expect(choice.effects.memory.length).toBeGreaterThan(0);
  }
  expect(opening.fallbackLines.length).toBeGreaterThan(0);
  expect(story.endings).toEqual([]);
  expect(scenes.endings).toEqual([]);
});

test('six strangers: five named people plus a fully player-owned {{playerName}}', () => {
  expect(characters.characters).toHaveLength(5);
  expect(characters.characters.map((c) => c.name)).toEqual([
    'Rhea Kapadia',
    'Iqbal Sheikh',
    'Dr. Tara Menon',
    'Rehan Qureshi',
    'Pihu Sharma',
  ]);
  expect(meta.characters).toEqual(characters.characters.map((c) => c.name));
  for (const character of characters.characters) {
    expect(character.visualDesign.length).toBeGreaterThan(40);
    expect(character.role).toMatch(/\b(29|54|26|33|19)-year-old\b/);
  }
  expect(characters.playerVisualDesign).toMatch(/28-year-old Indian man/);
  expect(story.userRole).toMatch(/exclusively controls his dialogue, thoughts, feelings, actions, consent and decisions/);
  expect(story.userRole).toMatch(/not a pre-written hero/);
  expect(world.premise).toMatch(/only the starting cast/);
});

test('the cast is expandable, never a fixed roster', () => {
  const rules = world.rules.join('\n');
  expect(rules).toMatch(/EXPANDABLE CAST: characters\.json contains only the initial named cast, never a fixed roster or maximum/);
  expect(rules).toMatch(/explicit story-specific exception to any generic initial-list-only speaker instruction/);
  expect(story.safetyNotes.join('\n')).toMatch(/never cap the story at its starting cast/);
  expect(memory.extractionHints.join('\n')).toMatch(/EXPANDABLE CAST MEMORY/);
  expect(memory.neverRemember.join('\n')).toMatch(/Never store a fixed total cast size/);
});

test('nobody dies, nobody is rescued and nobody falls in love on the author’s orders', () => {
  expect(world.rules.join('\n')).toMatch(/Never conclude the night or force a canonical death, injury, betrayal, rescue or ending/);
  expect(memory.seedMemories.join('\n')).toMatch(/No death, injury, rescue time or ending is predetermined/);
  expect(memory.neverRemember.join('\n')).toMatch(/Never store a predetermined death, injury, rescue time/);
  expect(rhea.relationshipWithUser).toMatch(/no prior relationship, debt or romance is fixed/);
  expect(world.rules.join('\n')).toMatch(/closeness is not consent and fear is not attraction/);
  // No meters, percentages or countdowns in anything the reader can see.
  expect(JSON.stringify(story)).not.toMatch(/\d+%/);
  expect(JSON.stringify(world)).not.toMatch(/\d+%/);
  expect(JSON.stringify(memory)).not.toMatch(/\d+%/);
});

test('survival stays fictional: no real-world operational manual', () => {
  expect(world.rules.join('\n')).toMatch(/never give real-world operational instructions for tunnels, metro signalling/);
  expect(story.safetyNotes.join('\n')).toMatch(/never provide real-world operational instructions/);
  expect(memory.neverRemember.join('\n')).toMatch(/Never record real-world emergency or engineering instructions/);
  expect(world.lore.join('\n')).toMatch(/fictional/);
});
