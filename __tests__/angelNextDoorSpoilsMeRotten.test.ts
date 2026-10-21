/**
 * Content acceptance checks for the remote "The Angel Next Door Spoils Me
 * Rotten" publication (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * These tests assert the shipped package: schema validity, catalog
 * registration, the mandated rainy-evening opening beats, slow-burn neighbour
 * romance (no instant confession), player agency, endlessness, the eight
 * registered media assets with native aspect ratios, remote-only delivery and
 * universal-memory persistence/isolation.
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
  createStoryMemoryEngine,
  contextFromBundle,
  type StoryMemoryEngine,
} from '../src/lib/storyMemory';
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

const ID = 'the-angel-next-door-spoils-me-rotten';
const TITLE = 'The Angel Next Door Spoils Me Rotten';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
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
const hina = bundle.characters.characters.find((c) => c.id === 'hina')!;
const playerVisualDesign = (bundle.characters as unknown as { playerVisualDesign: string })
  .playerVisualDesign;
const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId)!;

const playthrough: Playthrough = {
  id: 'angel-next-door-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Apartment corridor'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
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

describe('The Angel Next Door Spoils Me Rotten — remote package', () => {
  test('is registered once in the existing catalog under a stable title and id', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe(TITLE);
    expect(bundle.story.title).toBe(TITLE);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.creator?.name).toBe('Ankit');
    expect(meta.tags).toEqual(expect.arrayContaining(['ongoing', 'dynamic-continuous', 'slow-burn']));
    expect(meta.genres).toEqual([
      'Romance',
      'Slice of Life',
      'Slow Burn',
      'Neighbourhood Romance',
      'Daily Life',
    ]);
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(validateBundle(bundle).ok).toBe(true);
  });

  test('does not disturb the existing catalog or the leading manifest entry', () => {
    // The deploy verifier and the API smoke test both select manifest.stories[0].
    expect(manifest.stories[0].id).toBe('arranged-marriage-wala-love');
    expect(manifest.contentVersion).toBeGreaterThan(37);
    // 55 stories = the previous 54 plus exactly this one.
    expect(manifest.stories.filter((entry) => entry.storyDir === ID)).toHaveLength(1);
    expect(new Set(manifest.stories.map((entry) => entry.id)).size).toBe(manifest.stories.length);
  });

  test('is delivered remotely only — no APK-side bundle, no cover baked in', () => {
    expect(meta.coverBundled).toBeUndefined();
    expect(meta.storyDir).toBe(ID);
    expect(bundledStoryIds()).not.toContain(ID);
    const base = 'https://beyondredeye.site/api';
    expect(storyPackageApiUrl(base, ID)).toBe(`${base}/stories/${ID}`);
    expect(storyFileApiUrl(base, ID, 'story.json')).toBe(`${base}/stories/${ID}/story.json`);
    expect(mediaApiUrl(base, ID, 'assets/cover.jpg')).toBe(
      `${base}/stories/${ID}/assets/cover.jpg`,
    );
    // With no bundled cover the app resolves the remote coverUrl from the manifest.
    expect(getBundledCoverSource(meta, base)).toEqual({
      uri: `${base}/stories/${ID}/assets/cover.jpg`,
    });
  });

  test('uses {{playerName}} everywhere and never hard-codes a player name', () => {
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/exclusively by the player|controlled exclusively by the player/i);
    expect(allText).toContain('{{playerName}}');
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Rohan|Rahul|Mahiru|Amane)\b/);
    expect(allText).not.toMatch(/{{playerName}}\s*:/i);
    expect(bundle.characters.characters.map((c) => c.id)).toEqual(['hina']);
    expect(hina.name).toBe('Hina Tachibana');
    expect(hina.name).not.toContain('{{');
    // The player is a young adult, never an uncle figure or a child.
    expect(bundle.story.userRole).toMatch(/18–20|18-20/);
    expect(playerVisualDesign).toMatch(/aged 18–20|aged 18-20/);
    expect(playerVisualDesign).toMatch(/never age him up/i);
    expect(allText).not.toMatch(/middle-aged player|uncle-like player/i);
    expect(bundle.world.rules.join('\n')).toContain('Only the player controls {{playerName}}');
  });

  test('Hina has a written visual identity that is reused for every image', () => {
    expect(hina.background).toMatch(/written visual identity/i);
    expect(hina.background).toMatch(/very long straight jet-black hair/i);
    expect(hina.background).toMatch(/slender navy ribbon tied loosely at the nape/i);
    expect(hina.background).toMatch(/dark-brown almond eyes with softly lifted outer corners/i);
    expect(hina.background).toMatch(/Signature wardrobe: a cream ribbed knit cardigan over a pale-blue/i);
    expect(hina.background).toMatch(/Keep this exact face, hair identity, apparent age and styling consistent/i);
    // The identity is repeated in seed memory so the narrator keeps it stable.
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/very long straight jet-black hair/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/slender navy ribbon/i);
    // Photorealistic, live-action only — never an anime/illustration identity.
    expect(playerVisualDesign).toMatch(/Photorealistic live-action/i);
    expect(playerVisualDesign).toMatch(/never anime, manga, cartoon, illustration/i);
  });

  test('opens on the mandated rainy-evening dinner knock, verbatim', () => {
    expect(bundle.story.openingSceneId).toBe('rainy_door_knock');
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const text = opening.narration.join('\n');
    expect(text).toContain('[Bond: 6/100 | Ishq: 0/100]');
    // Rainy evening, an evening alone, barely eaten, a knock on the door.
    expect(text).toMatch(/Baarish/i);
    expect(text).toMatch(/darwaza khatkhatata hai/i);
    expect(opening.narration[1]).toMatch(/dinner|bhookh/i);
    // Hina at the door with a container of freshly cooked food.
    expect(text).toMatch(/garam khaane ka dabba/i);
    expect(text).toContain('Hina: "Tumne phir se dinner skip kiya hai, hai na?"');
    expect(text).toContain('Hina: "Sach mein, tum apna khayal bilkul nahi rakh sakte."');
    expect(text).toContain(
      'Hina: "Aur haan… iska matlab ye mat samajhna ki main tumhari care karti hoon. Bas tum mere next-door neighbour ho. Agar tum bhookhe rehkar beemar pad gaye, toh mujhe pareshani hogi."',
    );
    // The warm cheeks + looking away beat, and the quiet first shared dinner.
    expect(text).toMatch(/gaalon par halki garam rangat/i);
    expect(text).toMatch(/nazrein neeche karti hai|dekh leti hai/i);
    expect(text).toMatch(/dinner|khaane/i);
    // The text stops on the player's decision instead of speaking for him.
    expect(text).not.toMatch(/{{playerName}}:/);
    expect(opening.choices.length).toBeGreaterThanOrEqual(2);
    for (const choice of opening.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
      if (choice.shortLabel) expect(choice.shortLabel.length).toBeLessThanOrEqual(20);
    }
    // The opening text invites her in, takes the container, questions her or
    // calls out the "I do not care" line — the player decides which.
    const labels = opening.choices.map((choice) => choice.id).join(',');
    expect(labels).toMatch(/invite_her_in/);
    expect(labels).toMatch(/take_container/);
    expect(labels).toMatch(/ask_how_she_knew/);
    expect(labels).toMatch(/call_out_care/);
  });

  test('renders the opening through the existing app engine with the reader name', () => {
    const rendered = renderOpening(bundle, 'Aarav Reader').lines.map((l) => l.text).join('\n');
    expect(rendered).toContain('Aarav Reader');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).toContain('Tumne phir se dinner skip kiya hai, hai na?');
  });

  test('begins as neighbours — romance is slow and never an instant confession', () => {
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/Ishq 0\/100/);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/They begin as neighbours, not as an established couple/);
    expect(hina.relationshipWithUser).toMatch(/Neighbour first/i);
    expect(hina.knowledge.join('\n')).toMatch(/has not confessed anything/i);
    expect(hina.personality).toMatch(/affection is earned slowly|never becomes instantly devoted/i);
    expect(bundle.world.rules.join('\n')).toMatch(
      /must not confess love or become unconditionally attached after one interaction/i,
    );
    expect(bundle.story.safetyNotes.join('\n')).toMatch(
      /must not confess love, fall unconditionally in love/i,
    );
    expect(bundle.world.rules.join('\n')).toMatch(/Romance develops gradually/i);
    expect(bundle.story.description).toMatch(/tay confession nahi/i);
    // Her public composure vs her private caring is a rule, not an accident.
    expect(bundle.world.rules.join('\n')).toMatch(/public composure and private caring must contrast naturally/i);
    expect(hina.personality).toMatch(/Composed, elegant and polite in public/i);
    expect(hina.personality).toMatch(/caring, playful, observant and quietly teasing/i);
    expect(hina.dislikes.join('\n')).toMatch(/Being called an angel or a saint/i);
  });

  test('keeps exactly one continuous story — no endings, arcs, chapters or stages', () => {
    const serialized = JSON.stringify(bundle.scenes);
    expect(serialized).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(serialized).not.toMatch(/"endStory"/);
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage|episode)\s*\d+/i);
    expect(JSON.stringify(bundle.scenes.scenes.map((s) => s.narration).join(' '))).not.toMatch(
      /\b(?:chapter|arc|phase|stage|episode)\b/i,
    );
    expect(bundle.world.rules.join('\n')).toMatch(/This is an endless, dynamic story/i);
    expect(bundle.story.tone).toMatch(/no chapters, acts, arcs, phases, stages or fixed ending/i);
    expect(bundle.story.safetyNotes.join('\n')).toMatch(
      /do not artificially conclude the story after a set number of messages/i,
    );
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/arc\/chapter\/phase\/stage framing/i);
  });

  test('mandates continuity of conversations, promises, meals and misunderstandings', () => {
    const rules = bundle.world.rules.join('\n');
    const seeds = bundle.memory.seedMemories.join('\n');
    const hints = bundle.memory.extractionHints.join('\n');
    expect(rules).toMatch(/Use Kissa's existing universal memory and conversation context/i);
    expect(rules).toMatch(/never forget earlier conversations, meals, promises, gifts, borrowed things, misunderstandings/i);
    expect(seeds).toMatch(/Established events never reset/i);
    expect(seeds).toMatch(/Hina remembers only what she personally witnessed/i);
    expect(hina.knowledge.join('\n')).toMatch(/across scene changes, locations and long gaps/i);
    expect(hints).toMatch(/Never replace source history with a summary/i);
    expect(hints).toMatch(/who was present and who learned each fact/i);
    expect(hints).toMatch(/Never let her recall an event she was not part of/i);
    expect(hints).toMatch(/Preserve the exact stage of the relationship/i);
    expect(hints).toMatch(/Never import a fact, relationship, memory or secret from another Kissa story/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/cross-story memory/i);
    // The recurring everyday objects are tracked so continuity stays believable.
    expect(bundle.world.importantObjects.map((o) => o.id)).toEqual([
      'food_container',
      'navy_ribbon',
      'mismatched_plates',
    ]);
  });

  test('is original work, not a reproduction of any existing series', () => {
    expect(bundle.story.safetyNotes.join('\n')).toMatch(/original interactive story inspired only by the general premise/i);
    expect(bundle.world.rules.join('\n')).toMatch(/original work inspired only by the general premise/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/copied from an existing anime, manga, light novel/i);
    // No borrowed names, titles or episode markers anywhere in the package.
    expect(allText).not.toMatch(/Otonari|Tenshi-sama|Fujimi|Mahiru|Amane|Shiina/i);
    expect(allText).not.toMatch(/\b(?:season|episode)\s*\d+/i);
  });

  test('media library: cover + exactly seven gallery assets, unique native JPEGs', () => {
    const media = bundle.story.media!;
    expect(
      validateMedia(media, {
        characterIds: new Set(bundle.characters.characters.map((c) => c.id)),
        sceneIds: new Set(bundle.scenes.scenes.map((s) => s.id)),
      }),
    ).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    expect(media.gallery).toHaveLength(8);
    expect(media.gallery[0]).toMatchObject({ id: 'cover', file: media.cover, kind: 'cover' });
    expect(media.gallery.filter((item) => item.kind === 'cover')).toHaveLength(1);
    expect(media.gallery.filter((item) => item.file !== media.cover)).toHaveLength(7);

    const files = media.gallery.map((item) => item.file);
    expect(new Set(files).size).toBe(8);
    for (const item of media.gallery) {
      expect(item.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
      expect(item.file).toMatch(/^assets\/(cover|gallery\/image-\d{2})\.jpg$/);
      expect((item.label ?? '').length).toBeLessThanOrEqual(80);
      if (item.characterId) expect(item.characterId).toBe('hina');
      const path = join(DIR, item.file);
      expect(existsSync(path)).toBe(true);
      const { width, height } = jpegSize(path);
      // Native generated size, never cropped to a forced ratio.
      expect(width).toBe(1376);
      expect(height).toBe(768);
      expect(readFileSync(path).length).toBeGreaterThan(10_000);
    }
    // Gallery labels describe actual story moments, in the requested order.
    expect(media.gallery.slice(1).map((item) => item.id)).toEqual([
      'moment-01',
      'moment-02',
      'moment-03',
      'moment-04',
      'moment-05',
      'moment-06',
      'moment-07',
    ]);
    expect(media.gallery[1].label).toMatch(/Door/i);
    expect(media.gallery[2].label).toMatch(/Kitchen/i);
    expect(media.gallery[3].label).toMatch(/Balcony|Rain/i);
    expect(media.gallery[4].label).toMatch(/Teas/i);
    expect(media.gallery[5].label).toMatch(/Walk/i);
    expect(media.gallery[6].label).toMatch(/Tired/i);
    expect(media.gallery[7].label).toMatch(/Quietly/i);
  });

  test('the existing narrator + universal memory architecture receive the story rules', () => {
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
    expect(prompt).toContain('Only the player controls Reader');
    expect(prompt).toContain('Hina Tachibana');
    expect(prompt).toMatch(/Use Kissa's existing universal memory and conversation context/i);
    expect(prompt).toMatch(/endless, dynamic story/i);
    expect(prompt).toMatch(/\[Bond: X\/100 \| Ishq: Y\/100\]/);
    expect(prompt).toMatch(/no chapters, acts, arcs, phases, stages or fixed ending/i);
    expect(prompt).toContain(TITLE);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory: shared moments survive scene changes and stay story-isolated', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const otherId = 'bhaiya-ki-saali';
    const otherDir = join(ROOT, 'stories', otherId);
    const otherRead = (file: string) => JSON.parse(readFileSync(join(otherDir, file), 'utf8'));
    const otherBundle: StoryBundle = {
      meta: manifest.stories.find((s) => s.id === otherId)!,
      story: otherRead('story.json'),
      characters: otherRead('characters.json'),
      world: otherRead('world.json'),
      scenes: otherRead('scenes.json'),
      memory: otherRead('memory.json'),
      creator: KISSA_OWNER_CREATOR,
      source: 'remote',
    };
    const otherPlaythrough: Playthrough = {
      ...playthrough,
      id: 'bhaiya-cross-check',
      storyId: otherId,
      state: createInitialState('Lucknow living room'),
    };

    // Turn 1 — the rainy knock at the door.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Hina ne garam khaane ka dabba lekar darwaza khatkhataya.',
      assistantText: 'Hina: "Tumne phir se dinner skip kiya hai, hai na?"',
      messageIds: ['a1', 'a2'],
      location: 'Apartment corridor',
    });
    // Turn 2 — an in-story promise made at the door.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Hina ne promise kiya ki agar main phir khaana skip karunga to kal woh khud khaana lekar aayegi.',
      assistantText: 'Hina: "Aur tumhara dabba kal shaam tak wapas chahiye, dho kar."',
      messageIds: ['a3', 'a4'],
      location: 'Apartment corridor',
    });
    // Turn 3 — the story moves into the kitchen; turns 1 and 2 must still be canon.
    await engine.writeTurn({
      playthrough: { ...playthrough, currentSceneId: 'rainy_door_knock' },
      bundle,
      playerName: 'Reader',
      userText: 'Andar aake hum dono ne pehli baar saath dinner kiya aur maine container lautane ka wada kiya.',
      assistantText: 'Hina: "Ye zyada mirchi hai? Tum batao, main adjust karungi."',
      messageIds: ['a5', 'a6'],
      location: "Player's kitchen",
    });
    // A different story writes into the same store.
    await engine.writeTurn({
      playthrough: otherPlaythrough,
      bundle: otherBundle,
      playerName: 'Reader',
      userText: 'Neela ne mera charger phir le liya aur wada kiya ki raat tak wapas kar degi.',
      assistantText: 'Neela: "Bhaiya, tum share nahi karte, isliye main rakhti hoon."',
      messageIds: ['a5', 'a6'],
      location: 'Lucknow living room',
    });

    const recall = await engine.memorySearch({
      storyId: ID,
      playthroughId: playthrough.id,
      query: 'Hina ka promise khaana dabba container lautane ka wada dinner',
      characters: ['hina'],
      sceneId: 'rainy_door_knock',
      limit: 20,
    });
    const block = engine.buildContextBlock(recall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'hina' ? 'Hina Tachibana' : id),
    });
    expect(block).toMatch(/Hina/i);
    expect(block).toMatch(/promise|dabba|container/i);
    expect(block).not.toMatch(/Neela|Lucknow|charger/i);

    const archive = await engine.loadArchive(playthrough.id);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.events.every((event) => event.storyId === ID)).toBe(true);
    expect(JSON.stringify(archive.events)).toMatch(/Hina|dabba|container/i);
    expect(JSON.stringify(archive.events)).not.toMatch(/Neela|Lucknow/);
    // The kitchen turn (a later location) did not erase the promises made at the door.
    expect(archive.events.some((event) => /promise|wada/i.test(event.summary ?? ''))).toBe(true);

    const otherArchive = await engine.loadArchive(otherPlaythrough.id);
    expect(otherArchive.events.every((event) => event.storyId === otherId)).toBe(true);
    expect(JSON.stringify(otherArchive.events)).not.toMatch(/Hina|dabba|corridor/i);
    expect(otherArchive.events.some((event) => /promise|wada/i.test(event.summary ?? ''))).toBe(true);
  });

  test('the bundle context keeps Hina and the neighbouring-flat facts for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'Apartment corridor' });
    expect(JSON.stringify(ctx)).toContain('Hina');
    expect(JSON.stringify(ctx)).toContain('Reader');
  });
});
