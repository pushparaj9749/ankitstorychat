/**
 * Acceptance checks for the "dangerous heroine" OTA series (Oct 2026):
 * a soft, shy hero and a girlfriend/wife who is dangerous to the world,
 * never to him, and who takes the romantic initiative.
 *
 * Content-only stories delivered through the existing remote pipeline.
 * Every story in SERIES that is present in content/ must:
 *  - validate as a bundle and be registered in the manifest,
 *  - be free-form: ONE opening moment, starter suggestions with next=null,
 *    no extra scenes and no endings (README "Owner's story rules"),
 *  - show no numbers / percentages in its opening,
 *  - keep the heroine dangerous to others but never to the player,
 *  - ship a 2:3 portrait cover (docs/COVER_GUIDE.md) and seven 1376x768
 *    gallery JPEGs registered in story.media.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryBundle, StoryMeta } from '../src/types';
import { KISSA_OWNER_CREATOR } from '../src/types';
import { validateBundle } from '../src/lib/validate';
import { readerRoleText } from '../src/lib/playerName';

const SERIES = [
  'biwi-ek-supari-killer',
  'meri-wali-ips',
  'don-ki-beti-mera-dil',
  'commando-wife',
  'meri-hacker-girlfriend',
  'thakurain',
  'chudail-nahi-biwi-hai',
  'ring-ki-rani',
  'dil-ki-wasooli',
  'madam-sarkar',
  'jungle-ki-rani',
  'heros-party',
];

const ROOT = join(__dirname, '..', 'content');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const present = SERIES.filter((id) => existsSync(join(ROOT, 'stories', id, 'story.json')));

function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

function load(id: string): StoryBundle {
  const dir = join(ROOT, 'stories', id);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const meta = manifest.stories.find((s) => s.id === id)!;
  return {
    meta,
    story: read('story.json'),
    characters: read('characters.json'),
    world: read('world.json'),
    scenes: read('scenes.json'),
    memory: read('memory.json'),
    creator: meta?.creator ?? KISSA_OWNER_CREATOR,
    source: 'remote',
  };
}

test('all seven stories of the series are published in one content release', () => {
  expect(present).toEqual(SERIES);
  // contentVersion 46 is the release that ships the whole series OTA.
  expect(manifest.contentVersion).toBeGreaterThan(45);
});

describe.each(present)('%s', (id) => {
  const b = load(id);
  const dir = join(ROOT, 'stories', id);

  test('is registered in the manifest and validates', () => {
    expect(b.meta).toBeDefined();
    expect(b.meta.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
    expect(b.meta.ageRating).toBe('18+');
    expect(validateBundle(b).issues).toEqual([]);
  });

  test('is free-form: one opening moment, no plot, no endings', () => {
    expect(b.scenes.scenes).toHaveLength(1);
    expect(b.scenes.endings).toEqual([]);
    expect((b.story as unknown as { endings: unknown[] }).endings).toEqual([]);
    expect(b.meta.tags).toContain('ongoing');
    const opening = b.scenes.scenes[0];
    expect(opening.id).toBe(b.story.openingSceneId);
    expect(opening.choices.length).toBeGreaterThanOrEqual(2);
    for (const c of opening.choices) {
      expect(c.next ?? null).toBeNull();
      expect(c.effects?.scene).toBeUndefined();
      expect(c.effects?.endStory).toBeUndefined();
    }
  });

  test('opening shows no numbers, percentages or stat lines', () => {
    const text = b.scenes.scenes[0].narration.concat(b.scenes.scenes[0].fallbackLines).join('\n');
    expect(text).not.toMatch(/\d+\s*\/\s*100|%|\[Bond|Ishq:/);
  });

  test('heroine is dangerous to the world, never to the player', () => {
    const safety = (b.story.safetyNotes as unknown as string[]).join('\n');
    expect(safety).toMatch(/never to \{\{playerName\}\}/);
    expect(safety).toMatch(/respects it at once/);
    expect(safety).toMatch(/non-explicit/);
  });

  test('reader card shows only a clean description', () => {
    const shown = readerRoleText(b.story.userRole);
    expect(shown).toMatch(/^\{\{playerName\}\} — an adult Indian man/);
    expect(shown).not.toMatch(/controlled exclusively|never assign/i);
  });

  test('ships a 2:3 portrait cover and seven 1376x768 gallery images', () => {
    const cover = jpegSize(readFileSync(join(dir, 'assets', 'cover.jpg')));
    expect(cover.h).toBeGreaterThanOrEqual(cover.w * 1.3);
    const media = (b.story as unknown as { media: { gallery: { file: string }[] } }).media;
    expect(media.gallery).toHaveLength(8);
    for (const n of ['01', '02', '03', '04', '05', '06', '07']) {
      const f = `assets/gallery/image-${n}.jpg`;
      expect(media.gallery.map((g) => g.file)).toContain(f);
      expect(jpegSize(readFileSync(join(dir, f)))).toEqual({ w: 1376, h: 768 });
    }
  });
});
