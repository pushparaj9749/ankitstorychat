/**
 * Content acceptance checks for the remote story "Superstar Ki Chhutti" — a
 * glamorous, funny, slow-burn romance with a runaway Bollywood superstar hiding
 * in a South Goa fishing village, published under the id `superstar-ki-chhutti`
 * (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * These tests assert the shipped package: schema validity, catalog
 * registration, the opening hook (the paparazzi, the failed disguise, the
 * poster, the missing-star news, the plea for ten days), player agency,
 * slow-burn open-endedness, the hidden-truth discipline of the father and the
 * manager, the humane handling of fame and privacy, the eight registered photorealistic media assets at their
 * native size, remote-only delivery and universal-memory knowledge handling.
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

const ID = 'superstar-ki-chhutti';
const TITLE = 'Superstar Ki Chhutti';
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
const naina = bundle.characters.characters.find((c) => c.id === 'naina')!;
const agostinho = bundle.characters.characters.find((c) => c.id === 'agostinho')!;
const vicky = bundle.characters.characters.find((c) => c.id === 'vicky')!;
const playerVisualDesign = (bundle.characters as unknown as { playerVisualDesign: string })
  .playerVisualDesign;
const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId)!;
const openingText = opening.narration.join('\n');
const herLines = opening.narration.filter((line) => line.startsWith('Naina Sehgal: "'));

/** Exact native size of every shipped image, as produced by the generator. */
const NATIVE_SIZE = { width: 1376, height: 768 };
const FILES = [
  'assets/cover.jpg',
  ...['01', '02', '03', '04', '05', '06', '07'].map((n) => `assets/gallery/image-${n}.jpg`),
];

const playthrough: Playthrough = {
  id: 'superstar-ki-chhutti-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Kokum Shack'),
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

describe('Superstar Ki Chhutti — remote package', () => {
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
    expect(meta.genres).toEqual(['Romance', 'Slow Burn', 'Comedy', 'Drama', 'Slice of Life', 'Interactive Romance']);
    expect(bundle.story.genres).toEqual(meta.genres);
    expect(meta.tags).toEqual(bundle.story.tags);
    expect(meta.tags).toEqual(
      expect.arrayContaining(['ongoing', 'dynamic-continuous', 'hinglish', 'celebrity-romance', 'goa', 'glamorous-heroine']),
    );
    expect(meta.characters).toEqual([
      'Naina Sehgal',
      "Rosy D'Souza",
      'Joel Pinto',
      'Agostinho Fernandes',
      'Vicky Arora',
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
    expect(manifest.contentVersion).toBeGreaterThanOrEqual(44);
    expect(new Set(manifest.stories.map((entry) => entry.id)).size).toBe(manifest.stories.length);
    expect(manifest.stories.filter((entry) => entry.storyDir === ID)).toHaveLength(1);
    // The previous stories stay published and untouched alongside it.
    for (const neighbour of ['pehli-barf', 'meethi-dushmani', 'gyarah-mahine-ka-agreement', 'barish-boi-aur-tum', 'arranged-marriage-wala-love']) {
      const entry = manifest.stories.find((s) => s.id === neighbour)!;
      expect(entry).toBeDefined();
      expect(existsSync(join(ROOT, 'stories', entry.storyDir, 'story.json'))).toBe(true);
    }
    // Nothing from the neighbouring stories' casts leaks in.
    expect(allText).not.toMatch(/Gauri|Negi|Neelgaon|Mishri|Agarwal|Tanvi|Shetty|Ishani|Mitra Boi|Anahita|Rishabh/);
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

  test('uses {{playerName}} everywhere and leaves the player in full control', () => {
    expect(meta.userRole).toBe(bundle.story.userRole);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/controlled exclusively by the player/i);
    expect(bundle.story.userRole).toMatch(/aged 18–20/);
    expect(bundle.story.userRole).toMatch(/never assign him another name/i);
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Kabir|Arjun|Rohan|Rahul)\b/);
    expect(rules).toMatch(/Only the player controls {{playerName}}/);
    expect(safety).toMatch(/The player alone controls {{playerName}}/);
    expect(playerVisualDesign).toMatch(/No artwork depicts {{playerName}}/);
    expect(opening.narration.some((line) => line.startsWith('{{playerName}}:'))).toBe(false);
    expect(openingText).not.toMatch(/\bTum\s+\S+\s+(?:dikhate|kehte|bolte|karte|uthate)\s+ho\b/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/invented thoughts, feelings, words or actions for {{playerName}}/);
  });

  test('the female lead is a glamorous, very beautiful adult with a locked written visual identity', () => {
    expect(naina.name).toBe('Naina Sehgal');
    expect(naina.background).toMatch(/^LOCKED VISUAL IDENTITY/);
    expect(naina.background).toMatch(/20-year-old Indian girl from Dehradun/);
    expect(naina.background).toMatch(/strikingly glamorous Bollywood-heroine beauty/);
    expect(naina.background).toMatch(/tiny dark beauty mark on her left cheekbone/);
    expect(naina.background).toMatch(/big soft loose waves falling past her waist/);
    expect(naina.background).toMatch(/no bangs/);
    expect(naina.background).toMatch(/Unmarried — no sindoor, no mangalsutra/);
    expect(rules).toMatch(/Naina is glamorous and breathtakingly beautiful/);
    expect(rules).toMatch(/without ever reducing her to her looks/);
    expect(safety).toMatch(/\(18–20\) and Naina Sehgal \(20\) are adults/);
    expect(safety).toMatch(/non-explicit/);
    expect(safety).toMatch(/no sexualised presentation/);
    expect(safety).toMatch(/fictional and resemble no real actor or film/);
    expect(naina.personality).toMatch(/not instantly in love/);
    expect(naina.personality).toMatch(/no damsel/);
  });

  test('opens on the failed disguise in the beach shack with the mandated beats', () => {
    expect(opening.id).toBe('disguise_fail');
    expect(opening.title).toBe('Disguise Fail');
    expect(opening.narration[0].startsWith('*Subah ke 7:40.')).toBe(true);
    expect(openingText).toMatch(/Kokum Shack/);
    expect(openingText).toMatch(/Ishq Ka Season/);
    expect(openingText).toMatch(/Main\.\.\. main ek nariyal hoon/);
    expect(openingText).toMatch(/camera latkaye do aadmi/);
    expect(openingText).toMatch(/cap counter ke kone mein atak kar gir jaati hai/);
    expect(openingText).toMatch(/Autograph baad mein, selfie kabhi nahi/);
    expect(openingText).toMatch(/Vicky — 47 missed calls/);
    expect(openingText).toMatch(/1 November ko unki agli film Raat Rani ka mahurat/);
    expect(openingText).toMatch(/aa gayi Nikki baby\?/);
    expect(openingText).toMatch(/Sirf das din mujhe koi Naina nahi bulayega/);
    expect(herLines.length).toBeGreaterThanOrEqual(3);
    for (const line of opening.narration.concat(opening.fallbackLines)) {
      expect(line.split('"').length % 2).toBe(1);
      expect(line.split('*').length % 2).toBe(1);
      expect(line.startsWith('*') || /^[A-Z][a-z]+(?: [A-Z][A-Za-z']+){1,2}: "/.test(line)).toBe(true);
    }
  });

  test('ends at a natural decision point with open player choices', () => {
    expect(opening.narration[opening.narration.length - 1]).toMatch(/thaki hui, ghabraayi hui bees saal ki ladki/);
    expect(opening.choices.map((choice) => choice.id)).toEqual([
      'keep_quiet',
      'back_door',
      'chai_first',
      'poster_tease',
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
    expect(rendered).toContain('Kokum Shack');
    expect(lines.filter((l) => l.speaker === 'Naina Sehgal').length).toBe(herLines.length);
    expect(lines.some((l) => l.speaker === "Rosy D'Souza")).toBe(true);
  });

  test('the father and the manager keep their hidden truths narrator-only', () => {
    expect(lore).toMatch(/HIDDEN TRUTH \(narrator-only, reveal only through play\)/);
    expect(agostinho.background).toMatch(/HIDDEN TRUTH \(narrator-only/);
    expect(vicky.background).toMatch(/HIDDEN TRUTH \(narrator-only/);
    expect(lore).toMatch(/'Gus' is Agostinho Fernandes/);
    expect(rules).toMatch(/Never reveal them in one dump/);
    expect(safety).toMatch(/unfold only through believable discovery/);
    expect(openingText).not.toMatch(/Agostinho|Gus|father|Meera|advance|tipped/i);
    expect(seeds).not.toMatch(/Agostinho|Gus|father|Meera|advance|tipped/i);
    expect(naina.knowledge!.join('\n')).toMatch(/does not yet know who in the village he is/);
    expect(naina.knowledge!.join('\n')).toMatch(/does not know who tipped off the paparazzi/);
    expect(agostinho.knowledge!.join('\n')).toMatch(/does not know he has a daughter/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/narrator-only hidden truths/);
  });

  test('fame, privacy and her choices are handled with humanity and agency', () => {
    expect(safety).toMatch(/she makes her own choices — about her career, her secret and her heart/);
    expect(safety).toMatch(/stalking, surveillance, doxxing or invading her privacy are never framed as romantic/);
    expect(safety).toMatch(/Never force a confession, a kiss or a relationship/);
    expect(safety).toMatch(/search for her father is handled with tenderness and dignity/);
    expect(rules).toMatch(/Naina's affection is earned slowly/);
    expect(rules).toMatch(/the chapel feast and the 1 November mahurat are events inside the story, not the end of the story/);
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
    expect(bundle.story.tone).toMatch(/no chapters, acts, arcs, phases, stages or fixed ending/);
    expect(safety).toMatch(/do not artificially conclude the story after a set number of messages/);
  });

  test('is original work', () => {
    expect(safety).toMatch(/This is an original interactive story/);
    expect(allText).not.toMatch(/\b(?:season|episode)\s*\d+/i);
  });

  test('media library: one cover + exactly seven solo portraits of her, native JPEGs', () => {
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
    for (const item of gallery) {
      expect(item.kind).toBe('character-portrait');
      expect(item.characterId).toBe('naina');
    }
    expect(gallery.map((item) => item.id)).toEqual([
      'disguise-fail',
      'scooter-wali-subah',
      'fish-curry-rice',
      'chapel-ki-mombatti',
      'superstar-ka-aaina',
      'naav-pe-chaandni',
      'no-filter-subah',
    ]);
    expect(gallery[6].label).toMatch(/No Makeup, No Filter — Her Favourite Photo/);
    expect(safety).toMatch(/{{playerName}} never appears in any image/);
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
    expect(prompt).toContain('Naina Sehgal');
    expect(prompt).toMatch(/endless, dynamic story/);
    expect(prompt).toMatch(/Naina's affection is earned slowly/);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory seeds facts without inventing a romance', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const result = await engine.migrate({ playthrough, bundle, messages: [], playerName: 'Reader' });
    expect(result.migrated).toBe(true);
    expect(result.knowledge).toBeGreaterThan(0);
    for (const id of ['naina', 'rosy', 'joel', 'agostinho', 'vicky']) {
      const rel = await store.getRelationship(playthrough.id, pairKeyOf(PLAYER_ID, id));
      expect(rel?.status ?? 'none').not.toMatch(/dating|married|engaged/);
    }
    const knowledge = await store.listKnowledge(playthrough.id);
    const hers = knowledge.filter((k) => k.characterId === 'naina').map((k) => k.fact).join('\n');
    expect(hers).not.toMatch(/Agostinho|tipped off the paparazzi himself/);
  });

  test('the bundle context keeps the cast and the starting location for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'Kokum Shack' });
    expect(JSON.stringify(ctx)).toContain('Naina Sehgal');
    expect(JSON.stringify(ctx)).toContain('Reader');
    expect(bundle.world.locations[0].name).toBe('Kokum Shack');
    expect(bundle.world.importantObjects.map((o) => o.id)).toEqual([
      'meera_letters',
      'disguise_kit',
      'film_poster',
      'naina_phone',
      'guitar_case',
      'mint_scooter',
    ]);
  });
});
