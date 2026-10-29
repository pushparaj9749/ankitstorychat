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
  'sharmili-shooter',
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

  test('ships a 2:3 portrait cover and 7-49 numbered 1376x768 gallery images', () => {
    const cover = jpegSize(readFileSync(join(dir, 'assets', 'cover.jpg')));
    expect(cover.h).toBeGreaterThanOrEqual(cover.w * 1.3);
    const media = (b.story as unknown as { media: { gallery: { file: string }[] } }).media;
    // v2.12: up to 50 media items (cover + 49). At least the original seven.
    expect(media.gallery.length).toBeGreaterThanOrEqual(8);
    expect(media.gallery.length).toBeLessThanOrEqual(50);
    expect(media.gallery[0].file).toBe('assets/cover.jpg');
    media.gallery.slice(1).forEach((g, i) => {
      const f = `assets/gallery/image-${String(i + 1).padStart(2, '0')}.jpg`;
      expect(g.file).toBe(f);
      expect(jpegSize(readFileSync(join(dir, f)))).toEqual({ w: 1376, h: 768 });
    });
  });
});

describe("Hero's Party gallery batches", () => {
  const dir = join(ROOT, 'stories', 'heros-party');
  const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8')) as {
    version: number;
    media: { gallery: { id: string; kind: string; characterId?: string }[] };
  };
  const cast = (JSON.parse(readFileSync(join(dir, 'characters.json'), 'utf8')) as { characters: { id: string }[] }).characters.map((c) => c.id);

  test('batch 2 (images 08-17) is published with its own heroines', () => {
    expect(story.version).toBeGreaterThanOrEqual(2);
    const linked = story.media.gallery.map((g) => g.characterId).filter(Boolean);
    for (const id of ['chandrika', 'kalindi', 'saanvi', 'bhairavi', 'nagina', 'zoya', 'chakori', 'meghna', 'mehrunissa', 'rehana']) {
      expect(linked).toContain(id);
    }
    for (const id of linked) expect(cast).toContain(id);
  });

  test('batch 3 (images 18-27) is published with its own heroines', () => {
    expect(story.version).toBeGreaterThanOrEqual(3);
    expect(story.media.gallery.length).toBeGreaterThanOrEqual(28);
    const linked = story.media.gallery.map((g) => g.characterId).filter(Boolean);
    for (const id of ['veera', 'neelambari', 'tamasi', 'damini', 'vasudha', 'gulnaar', 'suryaprabha', 'shehnaz', 'rubina', 'ahilya']) {
      expect(linked).toContain(id);
    }
  });

  test('batch 4 (images 28-34) completes the gallery: every heroine has her own image', () => {
    expect(story.version).toBeGreaterThanOrEqual(4);
    expect(story.media.gallery.length).toBe(35);
    const linked = new Set(story.media.gallery.map((g) => g.characterId).filter(Boolean));
    for (const id of cast) expect([id, linked.has(id)]).toEqual([id, true]);
    expect(new Set(story.media.gallery.map((g) => g.id)).size).toBe(story.media.gallery.length);
  });
});

describe('Sharmili Shooter: dangerous + shy heroine, open hero', () => {
  const id = 'sharmili-shooter';
  const b = load(id);
  const chars = b.characters as unknown as {
    playerVisualDesign: string;
    characters: { id: string; personality: string }[];
  };
  const HERO_TRAIT = /\b(shy|timid|nervous|soft-spoken|flustered|blush\w*|brave|bold|confident|gentle|weak)\b/i;

  test('the hero has no predefined personality anywhere', () => {
    expect(b.story.userRole).not.toMatch(HERO_TRAIT);
    expect(b.story.userRole).toMatch(/Nothing about his personality is predefined/);
    expect(readerRoleText(b.story.userRole)).toMatch(/entirely up to you/);
    expect(chars.playerVisualDesign).not.toMatch(HERO_TRAIT);
    expect(b.meta.tags).not.toContain('shy-hero');
    expect(b.meta.tags).toContain('open-hero');
    // The Hinglish blurb never tells the reader what kind of man he is.
    expect(b.story.description).not.toMatch(/tum (ek )?(sharmile|seedhe|darpok|kamzor|bahadur)/i);
    expect(b.story.description).toMatch(/Tum kaun ho, kaise ho/);
  });

  test('the heroine is both dangerous and shy', () => {
    const ruhi = chars.characters.find((c) => c.id === 'ruhi')!;
    expect(ruhi.personality).toMatch(/shy/);
    expect(ruhi.personality).toMatch(/Saaya/);
    expect(b.meta.tags).toEqual(expect.arrayContaining(['dangerous-girlfriend', 'shy-heroine']));
  });

  test('ships a cover and eight gallery images, each portrait linked to the cast', () => {
    const gallery = (b.story as unknown as { media: { gallery: { characterId?: string }[] } }).media.gallery;
    expect(gallery).toHaveLength(9);
    const cast = new Set(chars.characters.map((c) => c.id));
    for (const g of gallery) if (g.characterId) expect(cast.has(g.characterId)).toBe(true);
  });
});
