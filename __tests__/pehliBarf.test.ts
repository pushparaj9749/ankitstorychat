/**
 * Content acceptance checks for the remote story "Pehli Barf" — a soft, cosy,
 * snowed-in slow-burn romance in a Himalayan village above Manali, published
 * under the id `pehli-barf` (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * These tests assert the shipped package: schema validity, catalog
 * registration, the opening hook (the first snow, the lantern, the puppy, the
 * closed road, the admission letter), player agency, slow-burn open-endedness,
 * the hidden-truth discipline of the family secrets, the loving handling of
 * the art-school dilemma, the eight registered photorealistic media assets at their
 * native size, remote-only delivery and universal-memory knowledge handling.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import { buildSystemPrompt } from '../src/lib/engine';
import { offlineOpening } from '../src/lib/offlineEngine';
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
  recordDownload: jest.fn(async () => undefined),
  removeDownloadRecord: jest.fn(async () => undefined),
}));

const ID = 'pehli-barf';
const TITLE = 'Pehli Barf';
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
const gauri = bundle.characters.characters.find((c) => c.id === 'gauri')!;
const prem = bundle.characters.characters.find((c) => c.id === 'prem')!;
const kartik = bundle.characters.characters.find((c) => c.id === 'kartik')!;
const playerVisualDesign = (bundle.characters as unknown as { playerVisualDesign: string })
  .playerVisualDesign;
const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId)!;
const openingText = opening.narration.join('\n');
const herLines = opening.narration.filter((line) => line.startsWith('Gauri Negi: "'));

/** Exact native size of every shipped image, as produced by the generator. */
const NATIVE_SIZE = { width: 1376, height: 768 };
const FILES = [
  'assets/cover.jpg',
  ...['01', '02', '03', '04', '05', '06', '07'].map((n) => `assets/gallery/image-${n}.jpg`),
];

const playthrough: Playthrough = {
  id: 'pehli-barf-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Seb Bagicha Homestay'),
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

describe('Pehli Barf — remote package', () => {
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
    expect(meta.genres).toEqual(['Romance', 'Slow Burn', 'Slice of Life', 'Family Drama', 'Cozy', 'Interactive Romance']);
    expect(bundle.story.genres).toEqual(meta.genres);
    expect(meta.tags).toEqual(bundle.story.tags);
    expect(meta.tags).toEqual(
      expect.arrayContaining(['ongoing', 'dynamic-continuous', 'hinglish', 'snowed-in', 'himachal', 'shy-heroine']),
    );
    expect(meta.characters).toEqual([
      'Gauri Negi',
      'Prem Singh Negi',
      'Sunita Negi',
      'Kartik Thakur',
      'Tashi Dolma',
      'Bholu',
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
    expect(manifest.contentVersion).toBeGreaterThanOrEqual(43);
    expect(new Set(manifest.stories.map((entry) => entry.id)).size).toBe(manifest.stories.length);
    expect(manifest.stories.filter((entry) => entry.storyDir === ID)).toHaveLength(1);
    for (const neighbour of ['meethi-dushmani', 'gyarah-mahine-ka-agreement', 'barish-boi-aur-tum', 'arranged-marriage-wala-love']) {
      const entry = manifest.stories.find((s) => s.id === neighbour)!;
      expect(entry).toBeDefined();
      expect(existsSync(join(ROOT, 'stories', entry.storyDir, 'story.json'))).toBe(true);
    }
    // Nothing from the neighbouring stories' casts leaks in.
    expect(allText).not.toMatch(/Mishri|Agarwal|Tanvi|Shetty|Ishani|Mitra Boi|Anahita|Rishabh/);
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

  test('the female lead is a soft, cute, very beautiful adult with a locked written visual identity', () => {
    expect(gauri.name).toBe('Gauri Negi');
    expect(gauri.background).toMatch(/^LOCKED VISUAL IDENTITY/);
    expect(gauri.background).toMatch(/20-year-old pahadi girl from the Kullu valley/);
    expect(gauri.background).toMatch(/soft, gentle and very beautiful/);
    expect(gauri.background).toMatch(/rosy-pink cheeks/);
    expect(gauri.background).toMatch(/soft wispy see-through bangs/);
    expect(gauri.background).toMatch(/tiny beauty mole near the corner of her lips/);
    expect(gauri.background).toMatch(/pastel pink pompom beanie/);
    expect(gauri.background).toMatch(/Unmarried\./);
    expect(rules).toMatch(/Gauri is soft, gentle and very beautiful/);
    expect(rules).toMatch(/without ever reducing her to her looks/);
    expect(safety).toMatch(/\(18–20\) and Gauri Negi \(20\) are adults/);
    expect(safety).toMatch(/non-explicit/);
    expect(safety).toMatch(/no sexualised presentation/);
    expect(gauri.personality).toMatch(/not instantly in love/);
    expect(gauri.personality).toMatch(/no pushover/);
  });

  test('opens on the first snow, the lantern and the puppy with the mandated beats', () => {
    expect(opening.id).toBe('pehli_barf_ki_shaam');
    expect(opening.title).toBe('Pehli Barf Ki Shaam');
    expect(opening.narration[0].startsWith('*Shaam ke 6:15.')).toBe(true);
    expect(openingText).toMatch(/pehli barf teen hafte pehle/);
    expect(openingText).toMatch(/landslide/);
    expect(openingText).toMatch(/Seb Bagicha Homestay/);
    expect(openingText).toMatch(/laltain/);
    expect(openingText).toMatch(/aap Dilli wale guest\?/);
    expect(openingText).toMatch(/Bholu, wapas aao!/);
    expect(openingText).toMatch(/Sadak kam se kam do hafte band/);
    expect(openingText).toMatch(/adrak wali, cheeni zyada/);
    expect(openingText).toMatch(/Last date to accept: 15 November/);
    expect(herLines.length).toBeGreaterThanOrEqual(3);
    for (const line of opening.narration.concat(opening.fallbackLines)) {
      expect(line.split('"').length % 2).toBe(1);
      expect(line.split('*').length % 2).toBe(1);
      expect(line.startsWith('*') || /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}: "/.test(line)).toBe(true);
    }
  });

  test('ends at a natural decision point with open player choices', () => {
    expect(opening.narration[opening.narration.length - 1]).toMatch(/Papa ko mat batana\. Abhi nahi\./);
    expect(opening.choices.map((choice) => choice.id)).toEqual([
      'keep_secret',
      'ask_paintings',
      'pick_up_bholu',
      'help_papa',
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
    const { lines } = offlineOpening(bundle, 'Reader');
    const rendered = lines.map((l) => l.text).join('\n');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).toContain('Seb Bagicha Homestay');
    expect(lines.filter((l) => l.speaker === 'Gauri Negi').length).toBe(herLines.length);
    expect(lines.some((l) => l.speaker === 'Prem Singh Negi')).toBe(true);
    expect(lines.some((l) => l.speaker === 'Sunita Negi')).toBe(true);
  });

  test('the family secrets keep their hidden truths narrator-only', () => {
    expect(lore).toMatch(/HIDDEN TRUTH \(narrator-only, reveal only through play\)/);
    expect(prem.background).toMatch(/HIDDEN TRUTH \(narrator-only/);
    expect(kartik.background).toMatch(/HIDDEN TRUTH \(narrator-only/);
    expect(lore).toMatch(/anonymous buyer of Gauri's paintings/);
    expect(rules).toMatch(/Never reveal them in one dump/);
    expect(safety).toMatch(/unfold only through believable discovery/);
    expect(openingText).not.toMatch(/buyer|trunk|Austria|saving/i);
    expect(seeds).not.toMatch(/buyer|trunk|Austria|saving/i);
    expect(gauri.knowledge!.join('\n')).toMatch(/does not know who buys her paintings/);
    expect(gauri.knowledge!.join('\n')).not.toMatch(/Austria|trunk/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/narrator-only hidden truths/);
  });

  test('the art-school dilemma is handled with love and agency', () => {
    expect(safety).toMatch(/she makes her own choices — including about art school/);
    expect(safety).toMatch(/no one forbids her by force, no threats, no running away/);
    expect(safety).toMatch(/Never force a confession, a kiss or a relationship/);
    expect(safety).toMatch(/No stalking, surveillance, snooping/);
    expect(rules).toMatch(/Gauri's affection is earned slowly/);
    expect(rules).toMatch(/the Jatra and the 15 November deadline are events inside the story, not the end of the story/);
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
      expect(item.characterId).toBe('gauri');
    }
    expect(gallery.map((item) => item.id)).toEqual([
      'bholu-ki-barf',
      'angithi-ki-chai',
      'khidki-ke-rang',
      'mannat-ka-ribbon',
      'jatra-ka-pattu',
      'taaron-wali-raat',
      'barf-ke-phahe',
    ]);
    expect(gallery[6].label).toMatch(/Catching Snowflakes — Her Favourite Photo/);
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
    expect(prompt).toContain('Gauri Negi');
    expect(prompt).toMatch(/endless, dynamic story/);
    expect(prompt).toMatch(/Gauri's affection is earned slowly/);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory seeds facts without inventing a romance', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const result = await engine.migrate({ playthrough, bundle, messages: [], playerName: 'Reader' });
    expect(result.migrated).toBe(true);
    expect(result.knowledge).toBeGreaterThan(0);
    for (const id of ['gauri', 'prem', 'sunita', 'kartik', 'tashi', 'bholu']) {
      const rel = await store.getRelationship(playthrough.id, pairKeyOf(PLAYER_ID, id));
      expect(rel?.status ?? 'none').not.toMatch(/dating|married|engaged/);
    }
    const knowledge = await store.listKnowledge(playthrough.id);
    const hers = knowledge.filter((k) => k.characterId === 'gauri').map((k) => k.fact).join('\n');
    expect(hers).not.toMatch(/Austria|trunk|saving for her fees/);
  });

  test('the bundle context keeps the cast and the starting location for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'Seb Bagicha Homestay' });
    expect(JSON.stringify(ctx)).toContain('Gauri Negi');
    expect(JSON.stringify(ctx)).toContain('Reader');
    expect(bundle.world.locations[0].name).toBe('Seb Bagicha Homestay');
    expect(bundle.world.importantObjects.map((o) => o.id)).toEqual([
      'admission_letter',
      'sketchbook',
      'hurricane_lantern',
      'red_ribbon',
      'tin_trunk',
      'kullu_shawl',
    ]);
  });
});
