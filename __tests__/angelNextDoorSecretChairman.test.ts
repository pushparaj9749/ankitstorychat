/**
 * Content acceptance checks for the remote story "The Angel Next Door Spoils Me
 * Rotten" — the secret-chairperson office romance published under the id
 * `angel-next-door-secret-chairman` (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * It is a NEW catalog entry that shares its (intentional) title with the
 * earlier neighbour story `the-angel-next-door-spoils-me-rotten`, which must
 * stay untouched. These tests assert the shipped package: schema validity,
 * catalog registration, the mandated inspection opening, the two-world
 * (office / private chat) rules, instant replies, slow-burn open-endedness,
 * player agency, the eight registered photorealistic media assets at their
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

const ID = 'angel-next-door-secret-chairman';
const NEIGHBOUR_ID = 'the-angel-next-door-spoils-me-rotten';
const TITLE = 'The Angel Next Door Spoils Me Rotten';
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
const anahita = bundle.characters.characters.find((c) => c.id === 'anahita')!;
const playerVisualDesign = (bundle.characters as unknown as { playerVisualDesign: string })
  .playerVisualDesign;
const opening = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId)!;
const openingText = opening.narration.join('\n');
const herLines = opening.narration.filter((line) => line.startsWith('Anahita Vardhan: "'));
const herChatLines = herLines.filter((line) => line.includes('📱'));
const herOfficeLines = herLines.filter((line) => !line.includes('📱'));

/**
 * Exact native size of every shipped image, as produced by the generator —
 * never cropped or resized (the Diwali full-length came from a model whose
 * native landscape canvas is 1376×768; every other file is 1408×768).
 */
const WIDE = { width: 1408, height: 768 };
const NATIVE: Record<string, { width: number; height: number }> = {
  'assets/cover.jpg': WIDE,
  'assets/gallery/image-01.jpg': WIDE,
  'assets/gallery/image-02.jpg': WIDE,
  'assets/gallery/image-03.jpg': WIDE,
  'assets/gallery/image-04.jpg': { width: 1376, height: 768 },
  'assets/gallery/image-05.jpg': WIDE,
  'assets/gallery/image-06.jpg': WIDE,
  'assets/gallery/image-07.jpg': WIDE,
};

const playthrough: Playthrough = {
  id: 'secret-chairman-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Vardhan Tower — Floor 32, Strategy & Analytics Bay'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
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

describe('The Angel Next Door Spoils Me Rotten (secret chairperson) — remote package', () => {
  test('is registered once in the existing catalog under its own stable id', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe(TITLE);
    expect(bundle.story.id).toBe(ID);
    expect(bundle.story.title).toBe(TITLE);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.creator?.name).toBe('Ankit');
    expect(meta.genres).toEqual([
      'Romance',
      'Slow Burn',
      'Office Drama',
      'Secret Identity',
      'Slice of Life',
      'Interactive Romance',
    ]);
    expect(bundle.story.genres).toEqual(meta.genres);
    expect(meta.tags).toEqual(
      expect.arrayContaining(['ongoing', 'dynamic-continuous', 'slow-burn', 'secret-identity', 'office-drama']),
    );
    expect(meta.characters).toEqual(['Anahita Vardhan', 'Nitin Bhalla', 'Tanmay Joshi', 'Meera Kulkarni']);
    expect(meta.ageRating).toBe(bundle.story.ageRating);
    expect(meta.contentLevel).toBe(bundle.story.contentLevel);
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(validateBundle(bundle).ok).toBe(true);
  });

  test('is added alongside — never over — the existing catalog and same-title story', () => {
    // The deploy verifier and the API smoke test both select manifest.stories[0].
    expect(manifest.stories[0].id).toBe('arranged-marriage-wala-love');
    expect(manifest.stories[1].id).toBe(ID);
    expect(manifest.contentVersion).toBeGreaterThan(38);
    expect(new Set(manifest.stories.map((entry) => entry.id)).size).toBe(manifest.stories.length);
    expect(manifest.stories.filter((entry) => entry.storyDir === ID)).toHaveLength(1);
    // The earlier neighbour story keeps its own id, directory, cover and lead.
    const neighbour = manifest.stories.find((entry) => entry.id === NEIGHBOUR_ID)!;
    expect(neighbour).toBeDefined();
    expect(neighbour.storyDir).toBe(NEIGHBOUR_ID);
    expect(neighbour.title).toBe(TITLE);
    expect(neighbour.coverUrl).toBe(`stories/${NEIGHBOUR_ID}/assets/cover.jpg`);
    expect(neighbour.characters).toEqual(['Hina Tachibana']);
    expect(neighbour.coverUrl).not.toBe(meta.coverUrl);
    expect(existsSync(join(ROOT, 'stories', NEIGHBOUR_ID, 'story.json'))).toBe(true);
    // Nothing from the neighbour story or the older office-boss story leaks in.
    expect(allText).not.toMatch(/Hina|Tachibana|Shivangi|Sharma Enterprises/);
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
    // With no bundled cover the app resolves the remote coverUrl from the manifest.
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
    expect(bundle.story.userRole).toMatch(/never sent her a photo of himself, never let her hear his voice/i);
    expect(bundle.story.userRole).toMatch(/recognises her face instantly/i);
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Kabir|Arjun|Rohan|Rahul)\b/);
    expect(allText).not.toMatch(/{{playerName}}\s*:/i);
    expect(rules).toContain('Only the player controls {{playerName}}');
    expect(rules).toMatch(/never decide how he feels about Anahita or what he does with the secret/i);
    expect(safety).toMatch(/never write his dialogue, texts, actions, inner feelings/i);
    // He never appears in any artwork.
    expect(playerVisualDesign).toMatch(/No artwork depicts {{playerName}}/);
    expect(playerVisualDesign).toMatch(/every gallery image shows Anahita alone/i);
  });

  test('the female lead has one elegant original name, used consistently', () => {
    expect(bundle.characters.characters.map((c) => c.id)).toEqual([
      'anahita',
      'nitin-bhalla',
      'tanmay',
      'meera',
    ]);
    expect(anahita.name).toBe('Anahita Vardhan');
    // Every mention of her is "Anahita" or "Anahita Vardhan" — no alternate surname.
    const mentions = allText.match(/Anahita(?: [A-Z][a-z]+)?/g) ?? [];
    expect(mentions.length).toBeGreaterThan(20);
    for (const m of mentions) expect(['Anahita', 'Anahita Vardhan']).toContain(m);
    expect(new Set(mentions.filter((m) => m.includes(' ')))).toEqual(new Set(['Anahita Vardhan']));
    // Every dialogue line uses an exact cast name, so the app shows the speaker.
    const names = bundle.characters.characters.map((c) => c.name);
    for (const line of opening.narration.concat(opening.fallbackLines)) {
      if (line.startsWith('*')) continue;
      const speaker = line.slice(0, line.indexOf(':'));
      expect(names).toContain(speaker);
    }
  });

  test('she is the adult owner-chairperson, with a locked written visual identity', () => {
    expect(anahita.role).toMatch(/^Chairperson of Vardhan Group — owner and head of the company/);
    expect(anahita.background).toMatch(/23-year-old adult woman/);
    expect(anahita.background).toMatch(/at 21 she took the chair of Vardhan Group/);
    expect(anahita.background).toMatch(/Written visual identity \(locked before any artwork and reused for every image of her\)/);
    expect(anahita.background).toMatch(/light hazel-amber irises/);
    expect(anahita.background).toMatch(/small beauty mark just below the outer corner of her left eye/);
    expect(anahita.background).toMatch(/dark espresso-brown hair with chestnut undertones/);
    expect(anahita.background).toMatch(/naturally curvy figure with a defined slim waist/);
    expect(anahita.background).toMatch(/tiny crescent-moon pendant/);
    expect(anahita.background).toMatch(/Keep this exact face, hair identity, apparent age and styling consistent/);
    // The identity is repeated in seed memory so the narrator keeps it stable.
    expect(seeds).toMatch(/light hazel-amber eyes, a small beauty mark just below the outer corner of her left eye/);
    expect(playerVisualDesign).toMatch(/photorealistic live-action photography — never anime, manga, cartoon, illustration/i);
  });

  test('two genuine personas: affectionate online, commanding and professional in public', () => {
    expect(anahita.personality).toMatch(/Two genuine sides of one woman/);
    expect(anahita.personality).toMatch(/ONLINE, in private text chats with {{playerName}}, she is extremely affectionate, cute, playful, caring and attentive/);
    expect(anahita.personality).toMatch(/pet names \(Mr\. Mystery, cutie, jaan\)/);
    expect(anahita.personality).toMatch(/happily sends her own selfies and photos/);
    expect(anahita.personality).toMatch(/remembers every chat, promise and joke, agrees to his reasonable requests and replies instantly/);
    expect(anahita.personality).toMatch(/PUBLIC, as Chairperson of Vardhan Group: confident, commanding, disciplined, intimidating and fiercely professional/);
    expect(anahita.personality).toMatch(/Neither side is an act/);
    expect(anahita.personality).toMatch(/at work she does not recognise, notice or single out {{playerName}}/);
    expect(rules).toMatch(/This is not an act, and she never slips into her chat personality at work/);
    expect(rules).toMatch(/no staring, no attraction, no curiosity, no suspicion and no special attention/);
  });

  test('opens on the inspection with the mandated beats and dramatic irony', () => {
    expect(bundle.story.openingSceneId).toBe('floor_32_inspection');
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    // His first days at the company, and the morning text from her.
    expect(openingText).toMatch(/Vardhan Group mein tumhari naukri ka teesra din/);
    expect(herChatLines.length).toBeGreaterThanOrEqual(2);
    expect(openingText).toMatch(/Aaj ki selfie/);
    // The manager announces the chairperson's inspection; tense preparation.
    expect(openingText).toContain(
      'Nitin Bhalla: "Attention, team! Chairperson ma\'am kal raat Singapore se lauti hain. Gyarah baje woh is floor ka inspection karengi',
    );
    expect(openingText).toMatch(/floor par toofan sa aa jaata hai/);
    // She arrives with her team.
    expect(openingText).toMatch(/Chief of Staff Meera Kulkarni, haath mein tablet, aur do assistants/);
    // He recognises her from her photos.
    expect(openingText).toMatch(/Ek hi nazar kaafi hai/);
    expect(openingText).toMatch(/wahi chehra hai jo aaj subah 7:40 par tumhare phone par muskura raha tha/);
    // She walks past him without special attention.
    expect(openingText).toMatch(/uski nazar ek pal ke liye bhi tum par nahi rukti/);
    expect(openingText).toMatch(/Uske liye tum bas ek aur naya chehra ho, ek aur employee ID/);
    // She asks the manager for the report, examines the department, addresses staff.
    expect(openingText).toContain('Anahita Vardhan: "Mr. Bhalla. Inspection report."');
    expect(openingText).toMatch(/Prepared for Ms\. Anahita Vardhan, Chairperson/);
    expect(openingText).toMatch(/Woh bay ka ek chakkar lagaati hai/);
    expect(openingText).toMatch(/Pehle hafte mein galti allowed hai\. Galti chhupana nahi/);
    expect(openingText).toMatch(/tum par bhi utni hi der jitni baaki sab par/);
    // Her office lines address the manager or the group — never him, never her chat self.
    expect(herOfficeLines.length).toBeGreaterThanOrEqual(3);
    for (const line of herOfficeLines) {
      expect(line).not.toMatch(/{{playerName}}|Mystery|jaan|cutie|📱/);
    }
    // She never recognises him, and nobody confesses or reveals anything.
    expect(openingText).not.toMatch(/woh tumhe pehchaan|usne tumhe pehchaan|pehchaan leti hai/i);
    expect(openingText).not.toMatch(/pyaar karti hoon|pyaar karta hoon|I love you|main hi Mr\. Mystery/i);
    expect(openingText).not.toMatch(/{{playerName}}:/);
  });

  test('ends at a natural decision point with open player choices', () => {
    expect(opening.narration[opening.narration.length - 1]).toMatch(/Teen second ki khamoshi/);
    expect(opening.choices.map((choice) => choice.id)).toEqual([
      'answer_her_question',
      'stay_silent',
      'text_her_secretly',
      'whisper_tanmay',
    ]);
    for (const choice of opening.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
      expect((choice.shortLabel ?? '').length).toBeGreaterThan(0);
      expect((choice.shortLabel ?? '').length).toBeLessThanOrEqual(20);
      // Choices are directions, not scripted lines spoken by {{playerName}}.
      expect(choice.text.startsWith('*')).toBe(true);
    }
  });

  test('renders the opening through the existing app engine with the reader name', () => {
    const { lines } = offlineOpening(bundle, 'Reader');
    const rendered = lines.map((l) => l.text).join('\n');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).toContain('Mr. Bhalla. Inspection report.');
    // Chat texts and in-person speech are attributed to the cast, not narration.
    expect(lines.filter((l) => l.speaker === 'Anahita Vardhan').length).toBe(herLines.length);
    expect(lines.some((l) => l.speaker === 'Nitin Bhalla')).toBe(true);
    expect(lines.some((l) => l.speaker === 'Tanmay Joshi')).toBe(true);
  });

  test('the online relationship is text-only and she replies immediately', () => {
    expect(rules).toMatch(/The relationship is text-only/);
    expect(rules).toMatch(/no voice calls, no video calls, no voice notes/);
    expect(rules).toMatch(/She has never seen his face or any photo of him and has never heard his voice/);
    expect(rules).toMatch(/Only the player can change that/);
    expect(rules).toMatch(/Anahita replies instantly/);
    expect(rules).toMatch(/her reply arrives immediately in the same response/);
    expect(rules).toMatch(/Never delay her, never leave him on seen, and never use busy, in a meeting or reply later as an excuse/);
    expect(rules).toMatch(/Anahita Vardhan: "📱 \.\.\."/);
    expect(seeds).toMatch(/always replies to {{playerName}}'s messages immediately/);
    expect(safety).toMatch(/replies to {{playerName}}'s messages immediately, every time/);
    expect(lore).toMatch(/Kalam has no voice or video calling and shows no phone numbers/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/Delayed replies, busy excuses, voice or video calls, or a face reveal that the player did not choose/);
    // Opening chat lines: warm, nicknamed, emoji-rich, and marked as texts.
    for (const line of herChatLines) expect(line).toMatch(/^Anahita Vardhan: "📱 /);
    expect(herChatLines.join('\n')).toMatch(/Mr\. Mystery/);
  });

  test('office knowledge and private chat knowledge stay separate', () => {
    const knowledge = anahita.knowledge.join('\n');
    expect(knowledge).toMatch(/She has no idea that {{playerName}} works at Vardhan Group/);
    expect(knowledge).toMatch(/she could pass him in a corridor without knowing/);
    expect(knowledge).toMatch(/he has not told her the company's name, his team, his floor or his manager/);
    expect(knowledge).toMatch(/did not learn any of their names/);
    expect(knowledge).toMatch(/never tried to trace who {{playerName}} is/);
    expect(rules).toMatch(/Keep knowledge separate/);
    expect(rules).toMatch(/She never magically knows his company, team, desk, schedule or location/);
    expect(rules).toMatch(/does not automatically connect office events with chat conversations/);
    expect(lore).toMatch(/nobody at Vardhan Group knows about Kalam or the relationship/);
    for (const id of ['nitin-bhalla', 'tanmay', 'meera']) {
      const c = bundle.characters.characters.find((x) => x.id === id)!;
      expect(c.knowledge.join('\n')).toMatch(/Kalam|private life|new-joiner list/);
      expect(c.relationshipWithUser).not.toMatch(/girlfriend|boyfriend|dating|friend|dost|yaar|married|wife|husband/i);
    }
    const hints = bundle.memory.extractionHints.join('\n');
    expect(hints).toMatch(/Keep two knowledge layers apart: PUBLIC office knowledge/);
    expect(hints).toMatch(/For every fact, record who knows it and how they learned it/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/Any fact Anahita could not plausibly know/);
    // No favouritism or punishment from the secret.
    expect(rules).toMatch(/The secret never creates favouritism, promotions, special treatment, special punishment or plot armour/);
  });

  test('slow burn with no forced reveal, several believable discovery paths, real consequences', () => {
    expect(rules).toMatch(/no fixed reveal date, no message-count trigger and no fixed ending/);
    expect(safety).toMatch(/Never force the reveal/);
    expect(rules).toMatch(/The truth can surface in more than one believable way/);
    for (const route of [
      /he tells her, in chat or in person/,
      /office detail that matches something she personally witnessed/,
      /his phone buzzes in front of her the instant she texts/,
      /VG cafeteria tray/,
      /hears his voice at work and later hears it again/,
      /Tanmay or office gossip/,
      /an HR record/,
    ]) {
      expect(rules).toMatch(route);
    }
    expect(rules).toMatch(/A single weak coincidence .* only causes a passing thought she dismisses/);
    expect(rules).toMatch(/she does not automatically forgive every deception/);
    expect(rules).toMatch(/Her chairperson identity does not collapse/);
    expect(rules).toMatch(/Anahita has her own secret/);
    expect(rules).toMatch(/secret_status=hidden, anahita_suspicion=0/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/A forced confession or reveal/);
  });

  test('keeps exactly one continuous story — no endings, arcs, chapters or stages', () => {
    const serialized = JSON.stringify(bundle.scenes);
    expect(serialized).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(serialized).not.toMatch(/"endStory"/);
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage|episode)\s*\d+/i);
    expect(openingText).not.toMatch(/\b(?:chapter|arc|phase|stage|episode)\b/i);
    expect(rules).toMatch(/This is an endless, dynamic story/);
    expect(bundle.story.tone).toMatch(/no chapters, acts, arcs, phases, stages or fixed ending/);
    expect(safety).toMatch(/do not artificially conclude the story after a set number of messages/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/arc\/chapter\/phase\/stage framing/);
    expect(rules).toMatch(/follow the persisted world state instead of re-staging the inspection/);
  });

  test('is original work, not a reproduction of any existing series', () => {
    expect(safety).toMatch(/This is an original interactive story\. The title is intentional/);
    expect(rules).toMatch(/This is an original work\. The title is intentional/);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/copied from an existing anime, manga, light novel/);
    expect(allText).not.toMatch(/Otonari|Tenshi-sama|Fujimiya|Mahiru|Amane|Shiina/i);
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
    expect(new Set(media.gallery.map((item) => item.file)).size).toBe(8);
    // Exactly the eight registered files exist — no extra or reference images.
    expect(gallery.map((item) => item.file)).toEqual(
      ['01', '02', '03', '04', '05', '06', '07'].map((n) => `assets/gallery/image-${n}.jpg`),
    );
    expect(existsSync(join(DIR, 'assets', 'references'))).toBe(false);
    for (const item of media.gallery) {
      expect(item.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
      expect((item.label ?? '').length).toBeLessThanOrEqual(80);
      const path = join(DIR, item.file);
      expect(existsSync(path)).toBe(true);
      // Native generated size — never cropped or forced into another ratio.
      expect(jpegSize(path)).toEqual(NATIVE[item.file]);
      expect(readFileSync(path).length).toBeGreaterThan(10_000);
    }
    // Every gallery image is a solo portrait of the female lead.
    for (const item of gallery) {
      expect(item.kind).toBe('character-portrait');
      expect(item.characterId).toBe('anahita');
    }
    // The seven requested shots, in the requested order.
    expect(gallery.map((item) => item.id)).toEqual([
      'selfie-good-morning',
      'home-sunday-chai',
      'playful-ice-cream',
      'diwali-full-length',
      'chairperson-office',
      'executive-stride',
      'personal-favourite',
    ]);
    // Every registered file has a recorded native size, and nothing else does.
    expect(Object.keys(NATIVE).sort()).toEqual(media.gallery.map((item) => item.file).sort());
    expect(gallery[0].label).toMatch(/Selfie/);
    expect(gallery[1].label).toMatch(/Casual Home Look/);
    expect(gallery[2].label).toMatch(/Playful/);
    expect(gallery[3].label).toMatch(/Full-Length Portrait/);
    expect(gallery[4].label).toMatch(/Chairperson .* Office/);
    expect(gallery[5].label).toMatch(/Executive Portrait/);
    expect(gallery[6].label).toMatch(/Favourite Photo/);
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
    expect(prompt).toContain('Anahita Vardhan');
    expect(prompt).toMatch(/Anahita replies instantly/);
    expect(prompt).toMatch(/The relationship is text-only/);
    expect(prompt).toMatch(/Keep knowledge separate/);
    expect(prompt).toMatch(/endless, dynamic story/);
    expect(prompt).toMatch(/Use Kissa's existing universal memory and conversation context/);
    expect(prompt).toMatch(/She has no idea that Reader works at Vardhan Group/);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory seeds the private relationship and her separate knowledge', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const result = await engine.migrate({ playthrough, bundle, messages: [], playerName: 'Reader' });
    expect(result.migrated).toBe(true);
    expect(result.knowledge).toBeGreaterThanOrEqual(10);

    // The private chat relationship is established canon from the first turn…
    const rel = await store.getRelationship(playthrough.id, pairKeyOf(PLAYER_ID, 'anahita'));
    expect(rel?.status).toBe('dating');
    // …while the office cast start with no invented personal relationship.
    for (const id of ['nitin-bhalla', 'tanmay', 'meera']) {
      const other = await store.getRelationship(playthrough.id, pairKeyOf(PLAYER_ID, id));
      expect(other?.status ?? 'none').not.toMatch(/dating|married|engaged|close_friend|friend/);
    }

    const knowledge = await store.listKnowledge(playthrough.id);
    const hers = knowledge.filter((k) => k.characterId === 'anahita').map((k) => k.fact).join('\n');
    expect(hers).toMatch(/has no idea that {{playerName}} works at Vardhan Group/);
    expect(hers).toMatch(/never seen {{playerName}}'s face/);
    const colleagues = knowledge.filter((k) => k.characterId !== 'anahita').map((k) => k.fact).join('\n');
    expect(colleagues).not.toMatch(/girlfriend|Mr\. Mystery|moon report/);
  });

  test('office and chat events persist across worlds and stay story-isolated', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const otherId = NEIGHBOUR_ID;
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
      id: 'neighbour-cross-check',
      storyId: otherId,
      state: createInitialState('Apartment corridor'),
    };

    // Office world — the inspection on Floor 32.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Maine haath uthaya aur Anahita Vardhan ko teen non-negotiables bataye: Sach pehle, Client ka bharosa, Apni galti khud batao.',
      assistantText: 'Anahita Vardhan: "Correct. Page four yaad rakhna kaafi nahi hai — usse kaam mein dikhana padega."',
      messageIds: ['s1', 's2'],
      location: 'Vardhan Tower — Floor 32, Strategy & Analytics Bay',
    });
    // Private chat world — a promise made over text that evening.
    await engine.writeTurn({
      playthrough: { ...playthrough, messageCount: 2 },
      bundle,
      playerName: 'Reader',
      userText: 'Maine Kalam par Anahita ko text kiya aur wada kiya ki kal lunch ki asli photo bhejunga.',
      assistantText: 'Anahita Vardhan: "📱 Pinky promise? Main wait karungi, Mr. Mystery 🤍"',
      messageIds: ['s3', 's4'],
      location: 'Kalam Chat (Private Messages)',
    });
    // A different story writes into the same store.
    await engine.writeTurn({
      playthrough: otherPlaythrough,
      bundle: otherBundle,
      playerName: 'Reader',
      userText: 'Hina ne garam khaane ka dabba diya aur wada kiya ki kal phir aayegi.',
      assistantText: 'Hina Tachibana: "Dabba kal tak wapas chahiye."',
      messageIds: ['h1', 'h2'],
      location: 'Apartment corridor',
    });

    const archive = await engine.loadArchive(playthrough.id);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.events.every((event) => event.storyId === ID)).toBe(true);
    const serialized = JSON.stringify(archive.events);
    expect(serialized).toMatch(/non-negotiables|Sach pehle/);
    expect(serialized).toMatch(/lunch|wada|promise/i);
    expect(serialized).not.toMatch(/Hina|dabba/i);

    const recall = await engine.memorySearch({
      storyId: ID,
      playthroughId: playthrough.id,
      query: 'Anahita lunch photo wada promise Kalam',
      characters: ['anahita'],
      limit: 20,
    });
    const block = engine.buildContextBlock(recall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'anahita' ? 'Anahita Vardhan' : id),
    });
    expect(block).toMatch(/Anahita/);
    expect(block).toMatch(/lunch|wada|promise/i);
    expect(block).not.toMatch(/Hina|dabba|corridor/i);

    const otherArchive = await engine.loadArchive(otherPlaythrough.id);
    expect(otherArchive.events.every((event) => event.storyId === otherId)).toBe(true);
    expect(JSON.stringify(otherArchive.events)).not.toMatch(/Anahita|Vardhan|Kalam/);
  });

  test('a believable discovery updates what she knows — and only then', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    await engine.migrate({ playthrough, bundle, messages: [], playerName: 'Reader' });
    const stale = (await store.listKnowledge(playthrough.id)).find((k) =>
      /has no idea that {{playerName}} works at Vardhan Group/.test(k.fact),
    )!;
    expect(stale.status).toBe('believed');

    // An ordinary office turn does not tell her anything about the chat world.
    await engine.writeTurn({
      playthrough: { ...playthrough, messageCount: 2 },
      bundle,
      playerName: 'Reader',
      userText: 'Maine corrected retention sheet Nitin Bhalla ko email kar di.',
      assistantText: 'Nitin Bhalla: "Good. 88 percent hi final hai. Ma\'am ko main bhej deta hoon."',
      messageIds: ['d1', 'd2'],
      location: 'Vardhan Tower — Floor 32, Strategy & Analytics Bay',
    });
    let current = (await store.listKnowledge(playthrough.id, { includeInvalidated: true })).find(
      (k) => k.id === stale.id,
    )!;
    expect(current.status).toBe('believed');

    // The truth surfaces through a believable channel: the lunch photo shows a
    // VG cafeteria tray and his ID lanyard, and she works it out.
    await engine.writeTurn({
      playthrough: { ...playthrough, messageCount: 4 },
      bundle,
      playerName: 'Reader',
      userText: 'Maine Anahita ko lunch ki photo bheji — tray par VG ka logo aur mera ID lanyard dikh raha tha.',
      assistantText:
        '*Photo dekhte hi Anahita ko sach pata chal gaya: Reader Vardhan Group mein kaam karta hai — Floor 32 ka naya junior associate.*\nAnahita Vardhan: "📱 Yeh tray… yeh lanyard… tum mere hi floor par ho?"',
      messageIds: ['d3', 'd4'],
      location: 'Kalam Chat (Private Messages)',
    });
    current = (await store.listKnowledge(playthrough.id, { includeInvalidated: true })).find(
      (k) => k.id === stale.id,
    )!;
    expect(current.status).toBe('invalidated');
    expect(current.invalidatedBy).toBeTruthy();
    // Their shared history survives the revelation.
    const live = await store.listKnowledge(playthrough.id);
    expect(live.some((k) => k.characterId === 'anahita' && /shared history exactly/.test(k.fact))).toBe(true);
  });

  test('the bundle context keeps the cast and the starting location for the narrator', () => {
    const ctx = contextFromBundle(bundle, {
      playerName: 'Reader',
      currentLocation: 'Vardhan Tower — Floor 32, Strategy & Analytics Bay',
    });
    expect(JSON.stringify(ctx)).toContain('Anahita Vardhan');
    expect(JSON.stringify(ctx)).toContain('Reader');
    expect(bundle.world.locations[0].name).toBe('Vardhan Tower — Floor 32, Strategy & Analytics Bay');
    expect(bundle.world.importantObjects.map((o) => o.id)).toEqual([
      'kalam_phone',
      'moon_pendant',
      'vg_tray',
      'inspection_report',
      'id_lanyard',
      'formal_shoes',
    ]);
  });
});
