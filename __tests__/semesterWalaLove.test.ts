import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharactersFile, StoryBundle, StoryMeta, WorldFile } from '../src/types';
import { validateBundle } from '../src/lib/validate';

const ID = 'semester-wala-love';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((story) => story.id === ID)!;
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const story = read('story.json');
const characters = read('characters.json') as CharactersFile & { playerVisualDesign: string };
const world = read('world.json') as WorldFile;
const scenes = read('scenes.json');
const memory = read('memory.json');
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

test('Semester Wala Love is registered as the next complete OTA story', () => {
  expect(meta).toBeDefined();
  expect(manifest.contentVersion).toBeGreaterThanOrEqual(66);
  expect(meta.title).toBe('Semester Wala Love');
  expect(meta.featured).toBe(true);
  expect(meta.isNew).toBe(true);
  expect(meta.tags).toEqual(expect.arrayContaining([
    'girls-college', 'only-male-student', 'bold-heroines', 'romantic-teasing', 'open-hero', 'ongoing',
  ]));
  expect(validateBundle(bundle).issues).toEqual([]);
});

test('the premise has one adult male transfer student and six distinct adult women', () => {
  expect(story.userRole).toMatch(/adult Indian man aged 22/);
  expect(story.userRole).toMatch(/only male student/);
  expect(story.userRole).toMatch(/Nothing about his personality/);
  expect(characters.characters.map((character) => character.id)).toEqual([
    'kiara', 'zoya', 'aisha', 'riya', 'tara', 'devika',
  ]);
  const ages = characters.characters.map((character) => {
    const match = character.role.match(/(\d+)-year-old/);
    expect(match).not.toBeNull();
    return Number(match![1]);
  });
  expect(ages.slice(0, 3)).toEqual([22, 22, 23]);
  expect(ages.slice(3).every((age) => age >= 29)).toBe(true);
  expect(characters.playerVisualDesign).toMatch(/clean-shaven/);
  expect(characters.playerVisualDesign).toMatch(/No glasses, no beard, no grey hoodie/);
});

test('bold teasing never overrides player consent or academic fairness', () => {
  const safety = story.safetyNotes.join('\n');
  const rules = world.rules.join('\n');
  expect(story.tone).toMatch(/romantic teasing frequent, playful and confident/);
  expect(safety).toMatch(/never creates \{\{playerName\}\}'s consent/);
  expect(safety).toMatch(/A clear no or boundary is respected immediately/);
  expect(safety).toMatch(/never exchange marks, attendance, recommendations, discipline, scholarships/);
  expect(rules).toMatch(/never trade marks, attendance, discipline, recommendations, admissions/);
  expect(rules).toMatch(/Do not make the campus a hive mind/);
  expect(safety).toMatch(/non-explicit/i);
});

test('opening is a calibrated two-dialogue moment with no predetermined route', () => {
  expect(scenes.scenes).toHaveLength(1);
  expect(scenes.endings).toEqual([]);
  expect(story.endings).toEqual([]);
  const opening = scenes.scenes[0];
  expect(opening.id).toBe('noor_ka_pehla_lecture');
  const dialogue = opening.narration.filter((line: string) => /^(Kiara|Riya):/.test(line));
  expect(dialogue).toHaveLength(2);
  expect(dialogue[0]).toMatch(/view yahan better hai/);
  expect(dialogue[1]).toMatch(/personal attendance list/);
  expect(opening.choices).toHaveLength(3);
  for (const choice of opening.choices) {
    expect(choice.next ?? null).toBeNull();
    expect(choice.effects?.scene).toBeUndefined();
    expect(choice.effects?.endStory).toBeUndefined();
  }
  const visible = opening.narration.concat(opening.fallbackLines).join('\n');
  expect(visible).not.toMatch(/%|\[Bond|Love:|Ishq:/i);
});

test('ships the exact-title portrait cover and eight native gallery JPEGs', () => {
  expect(story.title).toBe('Semester Wala Love');
  expect(story.media.gallery).toHaveLength(9);
  expect(story.media.gallery[0].label).toBe('Semester Wala Love');
  expect(jpegSize(readFileSync(join(DIR, 'assets', 'cover.jpg')))).toEqual({ w: 848, h: 1264 });
  story.media.gallery.slice(1).forEach((item: { file: string }, index: number) => {
    const expected = `assets/gallery/image-${String(index + 1).padStart(2, '0')}.jpg`;
    expect(item.file).toBe(expected);
    const file = join(DIR, expected);
    expect(existsSync(file)).toBe(true);
    expect(jpegSize(readFileSync(file))).toEqual({ w: 1376, h: 768 });
  });
});
