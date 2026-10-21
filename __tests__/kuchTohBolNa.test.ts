/**
 * Content acceptance checks for the remote story "Kuch Toh Bol Na" — a flirty,
 * funny slow-burn college romance between an introverted hero and a naughty,
 * teasing heroine in Pune, published under the id `kuch-toh-bol-na`
 * (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * These tests assert the shipped package: schema validity, catalog
 * registration, the opening hook (the late entry, the stolen earbud, the
 * project pairing, the balcony note), introvert player agency, slow-burn
 * open-endedness, the hidden-truth discipline of the dare, the approved fixed
 * look for the player in artwork, the eight registered photorealistic media
 * assets at their native size, remote-only delivery and universal-memory
 * knowledge handling.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import { buildSystemPrompt } from '../src/lib/engine';
import { renderOpening } from './helpers/opening';
import { validateBundle, validateMedia } from '../src/lib/validate';
import { mediaApiUrl, storyFileApiUrl, storyPackageApiUrl } from '../src/content/api';
import { getBundledCoverSource } from '../src/content/loader';
import { bundledStoryIds } from '../src/content/bundled';
import {
  PLAYER_ID,
  createStoryMemoryEngine,
  contextFromBundle,
  type StoryMemoryEngine,
} from '../src/lib/storyMemory';
import { pairKeyOf } from '../src/lib/storyMemoryCore';
import {
  createInMemoryStoryMemoryStore,
  type InMemoryStoryMemoryStore,
} from '../src/lib/storyMemoryStore';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

// loader.ts touches the device filesystem/db at import time; the assertions
// below only need its pure URL helpers, so both are stubbed here.
jest.mock('../src/lib/files', () => ({
  CONTENT_DIR: 'kissa-content/',
  STORIES_DIR: 'kissa-content/stories/',
  docPath: (...p: string[]) => p.join(''),
  exists: jest.fn(async () => false),
  readJson: jest.fn(async () => null),
  readText: jest.fn(async () => null),
  writeText: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  ensureDir: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/db', () => ({
  getDownloadRecord: jest.fn(async () => null),
  listDownloads: jest.fn(async () => []),
  removeDownloadRecord: jest.fn(async () => undefined),
}));

const ID = 'kuch-toh-bol-na';
const TITLE = 'Kuch Toh Bol Na';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  minAppVersion: string;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((s) => s.id === ID)!;
const bundle: StoryBundle = {
  meta,
  story: read('story.json'),
  characters: read('characters.json'),
  world: read('world.json'),
  scenes: read('scenes.json'),
  memory: read('memory.json'),
  creator: meta.creator ?? KISSA_OWNER_CREATOR,
  source: 'remote',
};
// Creator attribution is metadata ("Ankit"), not story content — excluded here.
const corpus = [bundle.story, bundle.characters, bundle.world, bundle.scenes, bundle.memory].map(
  (value, index) =>
    index === 0 ? { ...(value as unknown as Record<string, unknown>), creator: undefined } : value,
);
const allText = corpus.map((value) => JSON.stringify(value)).join('\n');
const rules = bundle.world.rules.join('\n');
const lore = bundle.world.lore.join('\n');
const seeds = bundle.memory.seedMemories.join('\n');
const safety = (bundle.story.safetyNotes as unknown as string[]).join('\n');
const mahi = bundle.characters.characters.find((c) => c.id === 'mahi')!;
const nani = bundle.characters.characters.find((c) => c.id === 'nani')!;
const sameer = bundle.characters.characters.find((c) => c.id === 'sameer')!;
const playerVisualDesign = (bundle.characters as unknown as { playerVisualDesign: string })
  .playerVisualDesign;
const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId)!;
const openingText = opening.narration.join('\n');
const herLines = opening.narration.filter((line) => line.startsWith('Mahi Khurana: "'));

/** Exact native size of every shipped image, as produced by the generator. */
const NATIVE_SIZE = { width: 1376, height: 768 };
const FILES = [
  'assets/cover.jpg',
  ...['01', '02', '03', '04', '05', '06', '07'].map((n) => `assets/gallery/image-${n}.jpg`),
];

const playthrough: Playthrough = {
  id: 'kuch-toh-bol-na-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Second-Year Classroom'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
};

function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Not a JPEG: ${path}`);
  const sof = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (sof.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    if (segmentLength < 2) break;
    offset += segmentLength;
  }
  throw new Error(`JPEG dimensions not found: ${path}`);
}

describe('Kuch Toh Bol Na — remote package', () => {
  test('is registered once in the existing catalog under its own stable id', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(manifest.stories.filter((entry) => entry.title === TITLE)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe(TITLE);
    expect(bundle.story.id).toBe(ID);
    expect(bundle.story.title).toBe(TITLE);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.isNew).toBe(true);
    expect(meta.creator?.name).toBe('Ankit');
    expect(meta.genres).toEqual(['Romance', 'Slow Burn', 'Comedy', 'College', 'Slice of Life', 'Interactive Romance']);
    expect(bundle.story.genres).toEqual(meta.genres);
    expect(meta.tags).toEqual(bundle.story.tags);
    expect(meta.tags).toEqual(
      expect.arrayContaining(['ongoing', 'dynamic-continuous', 'hinglish', 'introvert-hero', 'naughty-heroine', 'pune']),
    );
    expect(meta.characters).toEqual([
      'Mahi Khurana',
      'Shakuntala Bhatia',
      'Sameer Oberoi',
      'Ira Deshpande',
      'Medha Kulkarni',
    ]);
    expect(meta.characters).toEqual(bundle.characters.characters.map((c) => c.name));
    expect(meta.ageRating).toBe(bundle.story.ageRating);
    expect(meta.contentLevel).toBe(bundle.story.contentLevel);
    expect(meta.description).toBe(bundle.story.description);
    expect(meta.setting).toBe(bundle.story.setting);
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(validateBundle(bundle).ok).toBe(true);
  });

  test('is added alongside — never over — the existing catalog', () => {
    // The deploy verifier and the API smoke test both select manifest.stories[0].
    expect(manifest.stories[0].id).toBe('arranged-marriage-wala-love');
    expect(manifest.stories.findIndex((entry) => entry.id === ID)).toBeGreaterThan(0);
    expect(manifest.contentVersion).toBeGreaterThanOrEqual(45);
    expect(new Set(manifest.stories.map((entry) => entry.id)).size).toBe(manifest.stories.length);
    expect(manifest.stories.filter((entry) => entry.storyDir === ID)).toHaveLength(1);
    // The previous stories stay published and untouched alongside it.
    for (const neighbour of ['superstar-ki-chhutti', 'pehli-barf', 'meethi-dushmani', 'gyarah-mahine-ka-agreement', 'arranged-marriage-wala-love']) {
      const entry = manifest.stories.find((s) => s.id === neighbour)!;
      expect(entry).toBeDefined();
      expect(existsSync(join(ROOT, 'stories', entry.storyDir, 'story.json'))).toBe(true);
    }
    // Nothing from the neighbouring stories' casts leaks in.
    expect(allText).not.toMatch(/Naina|Sehgal|Gauri|Negi|Mishri|Agarwal|Tanvi|Ishani|Anahita|Rishabh/);
  });

  test('is delivered remotely only — no APK-side bundle, no cover baked in', () => {
    expect(meta.coverBundled).toBeUndefined();
    expect(bundledStoryIds()).not.toContain(ID);
    const base = 'https://beyondredeye.site/api';
    expect(storyPackageApiUrl(base, ID)).toBe(`${base}/stories/${ID}`);
    expect(storyFileApiUrl(base, ID, 'story.json')).toBe(`${base}/stories/${ID}/story.json`);
    expect(mediaApiUrl(base, ID, 'assets/gallery/image-07.jpg')).toBe(
      `${base}/stories/${ID}/assets/gallery/image-07.jpg`,
    );
    expect(getBundledCoverSource(meta, base)).toEqual({
      uri: `${base}/stories/${ID}/assets/cover.jpg`,
    });
  });

  test('never introduces a version-number string into the story content', () => {
    expect(allText).not.toMatch(/\bv?\d+\.\d+\.\d+\b/);
    expect(JSON.stringify(meta)).not.toMatch(/\bv?\d+\.\d+\.\d+\b/);
  });

  test('the introvert hero is defined as a starting point while the player keeps full control', () => {
    expect(meta.userRole).toBe(bundle.story.userRole);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/controlled exclusively by the player/i);
    expect(bundle.story.userRole).toMatch(/aged 19–20/);
    expect(bundle.story.userRole).toMatch(/quietest boy in class: an introvert/);
    expect(bundle.story.userRole).toMatch(/whether, when and how he finds his voice is entirely the player's choice/);
    expect(bundle.story.userRole).toMatch(/Never assign him another name/);
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Kabir|Arjun|Rohan|Rahul)\b/);
    expect(rules).toMatch(/Only the player controls {{playerName}}/);
    expect(rules).toMatch(/Introvert agency: whatever the player writes is exactly what {{playerName}} says or does/);
    expect(rules).toMatch(/Never make him suddenly eloquent or suddenly speechless against the player's input/);
    expect(safety).toMatch(/The player alone controls {{playerName}}/);
    expect(safety).toMatch(/his introversion is never mocked cruelly/);
    expect(opening.narration.some((line) => line.startsWith('{{playerName}}:'))).toBe(false);
    expect(openingText).not.toMatch(/\bTum\s+\S+\s+(?:dikhate|kehte|bolte|karte|uthate)\s+ho\b/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/invented thoughts, feelings, words or actions for {{playerName}}/);
  });

  test('the player has one fixed approved look in artwork that never decides his actions', () => {
    expect(playerVisualDesign).toMatch(/^Artwork depicts {{playerName}} with one fixed look approved for this story/);
    expect(playerVisualDesign).toMatch(/strikingly handsome like a Bollywood hero/);
    expect(playerVisualDesign).toMatch(/clean-shaven/);
    expect(playerVisualDesign).toMatch(/quiet, shy expression/);
    expect(playerVisualDesign).toMatch(/white crew-neck T-shirt under an open black bomber jacket/);
    expect(playerVisualDesign).toMatch(/never decide his words, feelings or actions/);
    expect(playerVisualDesign).toMatch(/photorealistic live-action photography/);
    expect(safety).toMatch(/appears in some artwork with one fixed look approved for this story/);
  });

  test('the female lead is a naughty, very beautiful adult with a locked written visual identity', () => {
    expect(mahi.name).toBe('Mahi Khurana');
    expect(mahi.background).toMatch(/^LOCKED VISUAL IDENTITY/);
    expect(mahi.background).toMatch(/20-year-old Punjabi girl from Delhi/);
    expect(mahi.background).toMatch(/extremely beautiful and cute with a naughty, mischievous face/);
    expect(mahi.background).toMatch(/tiny silver nose stud/);
    expect(mahi.background).toMatch(/high, slightly messy ponytail/);
    expect(mahi.background).toMatch(/light-blue oversized denim jacket/);
    expect(mahi.background).toMatch(/Unmarried — no sindoor, no mangalsutra/);
    expect(rules).toMatch(/Mahi is naughty, cheeky and very beautiful/);
    expect(rules).toMatch(/without ever reducing her to her looks/);
    expect(rules).toMatch(/Her naughtiness is playful teasing and dares, never explicit/);
    expect(safety).toMatch(/\(19–20\) and Mahi Khurana \(20\) are adults/);
    expect(safety).toMatch(/non-explicit/);
    expect(safety).toMatch(/no sexualised presentation/);
    expect(mahi.personality).toMatch(/not instantly in love/);
    expect(mahi.personality).toMatch(/never pushes past\s+real discomfort/);
  });

  test('opens on the last bench with the mandated beats', () => {
    expect(opening.id).toBe('last_bench_wali_ladki');
    expect(opening.title).toBe('Last Bench Wali Ladki');
    expect(opening.narration[0].startsWith('*Somvaar, subah ke 9:05.')).toBe(true);
    expect(openingText).toMatch(/Sahyadri College/);
    expect(openingText).toMatch(/bina poochhe tumhare kaan se earbud nikaal kar/);
    expect(openingText).toMatch(/Subah ke nau baje sad songs\? Kaun dil tod gaya, partner\?/);
    expect(openingText).toMatch(/Ya battery low hai\?/);
    expect(openingText).toMatch(/Pune Ki Awaaz/);
    expect(openingText).toMatch(/narration aapki apni awaaz mein/);
    expect(openingText).toMatch(/Mr\. Mute/);
    expect(openingText).toMatch(/Shanti Kunj, B-wing, flat 402/);
    expect(openingText).toMatch(/Kuch toh bol na\. — M\./);
    expect(herLines.length).toBeGreaterThanOrEqual(3);
    for (const line of opening.narration.concat(opening.fallbackLines)) {
      expect(line.split('"').length % 2).toBe(1);
      expect(line.split('*').length % 2).toBe(1);
      expect(line.startsWith('*') || /^[A-Z][a-z]+(?: [A-Z][A-Za-z']+){1,2}: "/.test(line)).toBe(true);
    }
  });

  test('ends at a natural decision point with open choices that include silent, non-verbal answers', () => {
    expect(opening.narration[opening.narration.length - 1]).toMatch(/ek aankh maar deti hai/);
    expect(opening.choices.map((choice) => choice.id)).toEqual([
      'write_back',
      'say_something',
      'change_song',
      'balcony_ten',
    ]);
    for (const choice of opening.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
      expect((choice.shortLabel ?? '').length).toBeGreaterThan(0);
      expect((choice.shortLabel ?? '').length).toBeLessThanOrEqual(20);
      expect(choice.text.startsWith('*')).toBe(true);
    }
  });

  test('renders the opening through the existing app engine with the reader name', () => {
    const { lines } = renderOpening(bundle, 'Reader');
    const rendered = lines.map((l) => l.text).join('\n');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).toContain('Sahyadri College');
    expect(lines.filter((l) => l.speaker === 'Mahi Khurana').length).toBe(herLines.length);
    expect(lines.some((l) => l.speaker === 'Medha Kulkarni')).toBe(true);
  });

  test('the dare and her family pain keep their hidden truths narrator-only', () => {
    expect(lore).toMatch(/HIDDEN TRUTH \(narrator-only, reveal only through play\)/);
    expect(lore).toMatch(/accepted a dare from Sameer Oberoi's group/);
    expect(rules).toMatch(/Never reveal them in one dump/);
    expect(safety).toMatch(/unfold only through believable discovery/);
    expect(safety).toMatch(/The dare among Mahi's new friends is handled with care/);
    expect(openingText).not.toMatch(/dare|shart|bet\b|divorce|separat/i);
    expect(seeds).not.toMatch(/dare|shart|bet\b|divorce|separat/i);
    expect(sameer.knowledge!.join('\n')).toMatch(/He set the dare/);
    expect(nani.knowledge!.join('\n')).toMatch(/does not know about the dare/);
    expect(mahi.knowledge!.join('\n')).toMatch(/has told {{playerName}} nothing/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/narrator-only hidden truths/);
  });

  test('keeps exactly one continuous story — no endings, arcs, chapters or stages', () => {
    const serialized = JSON.stringify(bundle.scenes);
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    expect((bundle.story as unknown as { endings: unknown[] }).endings).toEqual([]);
    expect(serialized).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(serialized).not.toMatch(/"endStory"/);
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage|episode)\s*\d+/i);
    expect(openingText).not.toMatch(/\b(?:chapter|arc|phase|stage|episode)\b/i);
    expect(rules).toMatch(/This is an endless, dynamic story/);
    expect(rules).toMatch(/Dandiya night and the project presentation are events inside the story, not the end of the story/);
    expect(bundle.story.tone).toMatch(/no chapters, acts, arcs, phases, stages or fixed ending/);
    expect(safety).toMatch(/do not artificially conclude the story after a set number of messages/);
  });

  test('is original work', () => {
    expect(safety).toMatch(/This is an original interactive story/);
    expect(allText).not.toMatch(/\b(?:season|episode)\s*\d+/i);
  });

  test('media library: one cover + seven native JPEGs — her portraits, him, and the two of them', () => {
    const media = bundle.story.media!;
    expect(
      validateMedia(media, {
        characterIds: new Set(bundle.characters.characters.map((c) => c.id)),
        sceneIds: new Set(bundle.scenes.scenes.map((s) => s.id)),
      }),
    ).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    expect(media.gallery).toHaveLength(8);
    expect(media.gallery[0]).toMatchObject({ id: 'cover', file: media.cover, kind: 'cover', label: TITLE });
    expect(media.gallery.filter((item) => item.kind === 'cover')).toHaveLength(1);
    const gallery = media.gallery.filter((item) => item.file !== media.cover);
    expect(gallery).toHaveLength(7);
    expect(media.gallery.map((item) => item.file)).toEqual(FILES);
    expect(existsSync(join(DIR, 'assets', 'references'))).toBe(false);
    for (const item of media.gallery) {
      expect(item.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
      expect((item.label ?? '').length).toBeLessThanOrEqual(80);
      const path = join(DIR, item.file);
      expect(existsSync(path)).toBe(true);
      expect(jpegSize(path)).toEqual(NATIVE_SIZE);
      expect(readFileSync(path).length).toBeGreaterThan(10_000);
    }
    expect(gallery.map((item) => [item.id, item.kind, item.characterId ?? null])).toEqual([
      ['last-bench', 'scene', null],
      ['mr-mute', 'other', null],
      ['cafe-ki-shararat', 'character-portrait', 'mahi'],
      ['ek-chhata', 'scene', null],
      ['balcony-wave', 'character-portrait', 'mahi'],
      ['scooty-ride', 'scene', null],
      ['dandiya-wink', 'character-portrait', 'mahi'],
    ]);
    expect(gallery[6].label).toMatch(/Dandiya Night Wink — Her Favourite Photo/);
  });

  test('the existing narrator receives the story rules with the reader name resolved', () => {
    const prompt = buildSystemPrompt(
      {
        bundle,
        playthrough,
        profile: { nickname: 'Reader', ageGroup: '18+', createdAt: playthrough.createdAt },
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(prompt).toContain(TITLE);
    expect(prompt).toContain('Only the player controls Reader');
    expect(prompt).toContain('Mahi Khurana');
    expect(prompt).toMatch(/endless, dynamic story/);
    expect(prompt).toMatch(/Mahi's affection is earned slowly/);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory seeds facts without inventing a romance', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const result = await engine.migrate({ playthrough, bundle, messages: [], playerName: 'Reader' });
    expect(result.migrated).toBe(true);
    expect(result.knowledge).toBeGreaterThan(0);
    for (const id of ['mahi', 'nani', 'sameer', 'ira', 'medha']) {
      const rel = await store.getRelationship(playthrough.id, pairKeyOf(PLAYER_ID, id));
      expect(rel?.status ?? 'none').not.toMatch(/dating|married|engaged/);
    }
  });

  test('the bundle context keeps the cast and the starting location for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'The Second-Year Classroom' });
    expect(JSON.stringify(ctx)).toContain('Mahi Khurana');
    expect(JSON.stringify(ctx)).toContain('Reader');
    expect(bundle.world.locations[0].name).toBe('The Second-Year Classroom');
    expect(bundle.world.importantObjects.map((o) => o.id)).toEqual([
      'earbud',
      'notebook',
      'project_camera',
      'balcony_lights',
      'pink_scooty',
      'dandiya_sticks',
    ]);
  });
});
