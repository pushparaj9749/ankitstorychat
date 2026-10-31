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
  'do-deewaniyan',
  'goa-ki-chingari',
  'khamoshi-ka-junoon',
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

describe('Do Deewaniyan: love triangle, two bold possessive girlfriends, open hero', () => {
  const id = 'do-deewaniyan';
  const b = load(id);
  const chars = b.characters as unknown as {
    playerVisualDesign: string;
    characters: { id: string; personality: string; knowledge: string[] }[];
  };
  const world = b.world as unknown as { rules: string[]; lore: string[] };
  const HERO_TRAIT = /\b(shy|timid|nervous|soft-spoken|flustered|blush\w*|brave|bold|confident|gentle|weak|playboy|cheater|flirt\w*)\b/i;

  test('the hero has no predefined personality or reasons', () => {
    expect(b.story.userRole).toMatch(/Nothing about his personality is predefined/);
    expect(b.story.userRole).toMatch(/why the two relationships began and what he truly feels/);
    expect(b.story.userRole).not.toMatch(HERO_TRAIT);
    expect(chars.playerVisualDesign).not.toMatch(HERO_TRAIT);
    expect(b.meta.tags).toContain('open-hero');
    expect(b.story.description).toMatch(/Tum kaun ho, kaise ho/);
  });

  test('two bold, possessive girlfriends who do not know about each other', () => {
    const tanya = chars.characters.find((c) => c.id === 'tanya')!;
    const mahira = chars.characters.find((c) => c.id === 'mahira')!;
    for (const h of [tanya, mahira]) {
      expect(h.personality).toMatch(/Bold in love/);
      expect(h.personality).toMatch(/Possessive/);
      expect(h.personality).toMatch(/a LOT of romance/);
    }
    expect(tanya.knowledge.join(' ')).toMatch(/does not know Mahira exists/);
    expect(mahira.knowledge.join(' ')).toMatch(/does not know Tanya exists/);
    expect(b.meta.tags).toEqual(expect.arrayContaining(['love-triangle', 'two-girlfriends', 'possessive-heroine', 'bold-heroine']));
  });

  test('the discovery is never scheduled, and possessiveness never turns on him', () => {
    expect(world.rules.join(' ')).toMatch(/never as a scheduled twist/);
    const safety = (b.story.safetyNotes as unknown as string[]).join(' ');
    expect(safety).toMatch(/never violence or threats against \{\{playerName\}\}/);
    expect(safety).toMatch(/never check his phone by force/);
  });

  test('ships a cover and eight gallery images, both heroines linked to the cast', () => {
    const gallery = (b.story as unknown as { media: { gallery: { characterId?: string }[] } }).media.gallery;
    expect(gallery).toHaveLength(9);
    const linked = gallery.map((g) => g.characterId).filter(Boolean);
    expect(linked).toEqual(expect.arrayContaining(['tanya', 'mahira']));
    const cast = new Set(chars.characters.map((c) => c.id));
    for (const c of linked) expect(cast.has(c as string)).toBe(true);
  });
});

describe('Goa Ki Chingari: bold thief heroine, heist romance, open hero', () => {
  const id = 'goa-ki-chingari';
  const b = load(id);
  const chars = b.characters as unknown as {
    playerVisualDesign: string;
    characters: { id: string; personality: string; knowledge: string[] }[];
  };
  const world = b.world as unknown as { rules: string[]; lore: string[] };
  const HERO_TRAIT = /\b(shy|timid|nervous|soft-spoken|flustered|blush\w*|brave|bold|confident|gentle|weak|playboy|cheater|flirt\w*)\b/i;

  test('the hero has no predefined personality, job or past', () => {
    expect(b.story.userRole).toMatch(/Nothing about his personality is predefined/);
    expect(b.story.userRole).toMatch(/his nature, temperament, job, past/);
    expect(b.story.userRole).not.toMatch(HERO_TRAIT);
    expect(chars.playerVisualDesign).not.toMatch(HERO_TRAIT);
    expect(b.meta.tags).toContain('open-hero');
    expect(b.story.description).toMatch(/Tum kaun ho, kaise ho/);
  });

  test('Selina is bold, flirty, possessive and dangerous as Chingari', () => {
    const selina = chars.characters.find((c) => c.id === 'selina')!;
    expect(selina.personality).toMatch(/Bold, flirtatious, fearless/);
    expect(selina.personality).toMatch(/Comically possessive/);
    expect(selina.personality).toMatch(/a LOT of romance/);
    expect(selina.personality).toMatch(/As Chingari she is cool, precise and dangerous/);
    expect(b.meta.tags).toEqual(expect.arrayContaining(['dangerous-girlfriend', 'bold-heroine', 'flirty-heroine', 'thief', 'heist']));
  });

  test('the heist stays player-led and never frames the hero', () => {
    expect(world.rules.join(' ')).toMatch(/happens only through play — nothing is scheduled/);
    expect(world.lore.join(' ')).toMatch(/never hidden on \{\{playerName\}\}/);
    const safety = (b.story.safetyNotes as unknown as string[]).join(' ');
    expect(safety).toMatch(/never steals from ordinary people/);
    expect(safety).toMatch(/never plants anything on \{\{playerName\}\}/);
    expect(safety).toMatch(/never tricks him into a crime/);
  });

  test('ships a cover and eight gallery images with linked cast portraits', () => {
    const gallery = (b.story as unknown as { media: { gallery: { characterId?: string }[] } }).media.gallery;
    expect(gallery).toHaveLength(9);
    const linked = gallery.map((g) => g.characterId).filter(Boolean);
    expect(linked).toEqual(expect.arrayContaining(['selina', 'ranjit']));
    const cast = new Set(chars.characters.map((c) => c.id));
    for (const c of linked) expect(cast.has(c as string)).toBe(true);
  });
});

describe('Khamoshi Ka Junoon: cute mast heroine, shy but clear, open hero', () => {
  const id = 'khamoshi-ka-junoon';
  const b = load(id);
  const chars = b.characters as unknown as {
    playerVisualDesign: string;
    characters: { id: string; personality: string }[];
  };
  const world = b.world as unknown as { rules: string[] };
  const HERO_TRAIT = /\b(shy|timid|nervous|soft-spoken|flustered|blush\w*|brave|bold|confident|gentle|weak|playboy|cheater|flirt\w*)\b/i;

  test('the hero has no predefined personality, job or past', () => {
    expect(b.story.userRole).toMatch(/Nothing about his personality is predefined/);
    expect(b.story.userRole).toMatch(/his nature, temperament, job, past and feelings/);
    expect(b.story.userRole).not.toMatch(HERO_TRAIT);
    expect(chars.playerVisualDesign).not.toMatch(HERO_TRAIT);
    expect(b.meta.tags).toContain('open-hero');
    expect(b.story.description).toMatch(/Tum kaun ho, kaise ho/);
  });

  test('Meher is cute, mast, dangerous and shy without being unclear or helpless', () => {
    const meher = chars.characters.find((c) => c.id === 'meher')!;
    expect(meher.personality).toMatch(/cute, mast/);
    expect(meher.personality).toMatch(/playfully shy, not helpless/);
    expect(meher.personality).toMatch(/says exactly what is on her mind/);
    expect(meher.personality).toMatch(/a LOT of romance/);
    expect(meher.personality).toMatch(/As Khamosh she is calm, patient and dangerous/);
    expect(b.meta.tags).toEqual(expect.arrayContaining(['dangerous-girlfriend', 'shy-heroine', 'cute-heroine', 'playful-heroine']));
  });

  test('opening has light context and a medium natural invitation, not a background dump', () => {
    const opening = b.scenes.scenes[0];
    const text = opening.narration.join('\n');
    expect(opening.narration).toHaveLength(6);
    expect(text.length).toBeGreaterThan(700);
    expect(text.length).toBeLessThan(1800);
    expect(opening.narration[0]).toMatch(/jaan-pehchaan abhi nayi/);
    expect(text).toMatch(/jhijhak rahi hoon/);
    expect(text).toMatch(/Mujhe tumhare saath thodi der aur rehna hai/);
    expect(text).toMatch(/tum chaho toh mera haath bhi pakad sakte ho/);
    expect(text).not.toMatch(/\bKhamosh\b|Rathore|whistleblower/);
    expect(text).not.toMatch(/lamba introduction|player decide/i);
  });

  test('danger and hidden identity are never scheduled after the opening', () => {
    expect(world.rules.join(' ')).toMatch(/Do not automatically introduce Rathore/);
    expect(world.rules.join(' ')).toMatch(/hidden identity remains in the background/);
    expect(b.scenes.scenes).toHaveLength(1);
    expect(b.scenes.endings).toEqual([]);
  });

  test('ships a cover and eight Meher gallery images', () => {
    const gallery = (b.story as unknown as { media: { gallery: { characterId?: string }[] } }).media.gallery;
    expect(gallery).toHaveLength(9);
    const linked = gallery.map((g) => g.characterId).filter(Boolean);
    expect(new Set(linked)).toEqual(new Set(['meher']));
  });
});
