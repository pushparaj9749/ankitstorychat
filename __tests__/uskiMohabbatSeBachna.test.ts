/**
 * Content acceptance checks for the remote "Uski Mohabbat Se Bachna Namumkin Tha"
 * publication (content-only OTA story; no app/APK change, no new app version).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app
 * (existing v2.5.x discovers it via the remote manifest with no update).
 *
 * These tests assert the shipped package: schema validity, catalog
 * registration, the obsessed-girlfriend premise with its hidden-identity
 * mystery, the normal-first opening with one small unexplained clue,
 * player-controlled MC, exactly 8 media assets (1 cover + 7 gallery),
 * wholesome/non-graphic guardrails, endless continuity, and universal-memory
 * persistence with storyId isolation.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import { buildSystemPrompt } from '../src/lib/engine';
import { offlineOpening } from '../src/lib/offlineEngine';
import { validateBundle, validateMedia } from '../src/lib/validate';
import {
  createStoryMemoryEngine,
  contextFromBundle,
  type StoryMemoryEngine,
} from '../src/lib/storyMemory';
import {
  createInMemoryStoryMemoryStore,
  type InMemoryStoryMemoryStore,
} from '../src/lib/storyMemoryStore';

const ID = 'uski-mohabbat-se-bachna-namumkin-tha';
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
  (value, index) => (index === 0 ? { ...(value as unknown as Record<string, unknown>), creator: undefined } : value),
);
const allText = corpus.map((value) => JSON.stringify(value)).join('\n');

const playthrough: Playthrough = {
  id: 'uski-mohabbat-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Lakeside cafe, the usual table'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
};

function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Not a JPEG: ${path}`);
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
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

describe('Uski Mohabbat Se Bachna Namumkin Tha — remote package', () => {
  test('is registered once in the existing catalog under a stable title and id', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe('Uski Mohabbat Se Bachna Namumkin Tha');
    expect(bundle.story.title).toBe(meta.title);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.tags).toContain('ongoing');
    expect(meta.tags).toContain('player-agency');
    expect(meta.tags).toContain('hinglish');
    expect(meta.genres).toEqual([
      'Psychological Romance',
      'Mystery',
      'Crime Thriller',
      'Obsession',
      'Suspense',
    ]);
    expect(meta.characters).toEqual(['Aarohi', 'Riya Sharma', 'Vikram Rathore']);
    expect(meta.creator?.name).toBe('Ankit');
    expect(meta.creator?.verified).toBe(true);
    expect(bundle.story.creator?.name).toBe('Ankit');
    expect(validateBundle(bundle).issues).toEqual([]);
  });

  test('uses {{playerName}} everywhere and never hard-codes a player name', () => {
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/exclusively.*player|player.*exclusively/i);
    expect(allText).toContain('{{playerName}}');
    expect(allText).not.toMatch(/{{playerName}}:\s*["*]/i);
    expect(bundle.characters.characters.map((c) => c.id)).toEqual([
      'aarohi',
      'riya-sharma',
      'vikram-rathore',
    ]);
    for (const character of bundle.characters.characters) {
      expect(character.name).not.toContain('{{');
    }
    // MC is an 18–20 young adult, youthful and natural — never middle-aged.
    expect(bundle.story.userRole).toMatch(/18-20/);
    expect(bundle.story.userRole).toMatch(/youthful/i);
    expect(allText).toMatch(/never.*middle-aged.*uncle-like|never middle-aged/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never.*middle-aged, older or uncle-like/i);
  });

  test('Aarohi is established as the loving girlfriend with a hidden powerful side', () => {
    const aarohi = bundle.characters.characters.find((c) => c.id === 'aarohi')!;
    expect(aarohi.role).toMatch(/\{\{playerName\}\}.*girlfriend/i);
    expect(aarohi.personality).toMatch(/cute.*affectionate.*playful.*caring/i);
    expect(aarohi.personality).toMatch(/genuinely loving/i);
    expect(aarohi.personality).toMatch(/never a cartoon villain/i);
    expect(aarohi.personality).toMatch(/extremely possessive|intensely jealous/i);
    expect(aarohi.relationshipWithUser).toMatch(/established girlfriend|already.*boyfriend and girlfriend/i);
    // Secret identity exists for the narrator but is flagged unknown-to-MC.
    expect(aarohi.background).toMatch(/secretly leads/i);
    expect(aarohi.background).toMatch(/almost nobody knows/i);
    expect(aarohi.knowledge.join('\n')).toMatch(/unknown to \{\{playerName\}\}/i);
    expect(aarohi.knowledge.join('\n')).toMatch(/never confesses this immediately/i);
    // Visual identity is locked in words (cover is the canonical reference).
    expect(aarohi.background).toMatch(/canonical visual identity/i);
    expect(aarohi.background).toMatch(/keep her exact face/i);
  });

  test('Riya and Vikram play their intended clue-bearing roles', () => {
    const riya = bundle.characters.characters.find((c) => c.id === 'riya-sharma')!;
    const vikram = bundle.characters.characters.find((c) => c.id === 'vikram-rathore')!;
    expect(riya.role).toMatch(/classmate/i);
    expect(riya.role).toMatch(/triggers Aarohi's jealousy/i);
    expect(riya.personality).toMatch(/ordinary/i);
    expect(riya.knowledge.join('\n')).toMatch(/knows nothing about Aarohi's secret/i);
    expect(vikram.role).toMatch(/unknown to \{\{playerName\}\}/i);
    expect(vikram.personality).toMatch(/discreet/i);
    expect(vikram.sampleLine).toMatch(/Ma'am, jaisa aap kahein/);
  });

  test('opening is normal-first: affection, subtle possessiveness, one small clue, no reveal', () => {
    expect(bundle.story.openingSceneId).toBe('lakeside_cafe_evening');
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const [scene] = bundle.scenes.scenes;
    expect(scene.isEnding).not.toBe(true);
    const opening = scene.narration.join('\n');
    // Relationship + affection + playfulness.
    expect(opening).toContain('{{playerName}}');
    expect(opening).toContain('cold coffee');
    expect(opening).toContain('Aarohi: "Tum mere saath ho na... hamesha rahoge na?"');
    // The jealousy trigger and the small unexplained clue.
    expect(opening).toContain('Riya');
    expect(opening).toContain('notes');
    expect(opening).toContain('Economics');
    expect(opening).toContain('Unknown number');
    expect(opening).toContain('sir jhukata hai');
    // The secret is NOT revealed in the opening.
    expect(opening).not.toMatch(/criminal organization|mafia|don |underworld|syndicate|kingpin/i);
    expect(opening).not.toMatch(/leads .*organization|secret leader/i);
    // Choices stay open and endless.
    expect(scene.choices.length).toBeGreaterThanOrEqual(2);
    for (const choice of scene.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
      if (choice.shortLabel) expect(choice.shortLabel.length).toBeLessThanOrEqual(20);
    }
    const rendered = offlineOpening(bundle, 'Test Reader').lines.map((l) => l.text).join('\n');
    expect(rendered).toContain('Test Reader');
    expect(rendered).not.toContain('{{playerName}}');
  });

  test('is endless and continuous: no arcs, acts, chapters, stages or fixed ending', () => {
    const serialized = [bundle.story, bundle.characters, bundle.world, bundle.scenes, bundle.memory]
      .map((value) => JSON.stringify(value))
      .join('\n');
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage)\s*\d+/i);
    expect(bundle.scenes.endings).toEqual([]);
    expect(JSON.stringify(bundle.scenes)).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(JSON.stringify(bundle.scenes)).not.toMatch(/"endStory"/);
    expect(bundle.world.rules.join('\n')).toMatch(/endless, continuous, dynamic story/i);
    expect(bundle.world.rules.join('\n')).toMatch(/predetermined final confession/i);
    expect(bundle.world.rules.join('\n')).toMatch(/predetermined final outcome/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/predetermined ending/i);
  });

  test('safety: non-graphic, no harm instructions, wholesome intimacy, no glorified abuse', () => {
    const safety = bundle.story.safetyNotes.join('\n');
    expect(safety).toMatch(/non-explicit, fully-clothed/i);
    expect(safety).toMatch(/wholesome domestic moments only/i);
    expect(safety).toMatch(/no sexual posing/i);
    expect(safety).toMatch(/non-graphic/i);
    expect(safety).toMatch(/never provide instructions for harming, kidnapping, attacking/i);
    expect(safety).toMatch(/never glorify manipulation, stalking, emotional pressure/i);
    expect(safety).toMatch(/not a cartoon villain/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never depict graphic violence/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never give practical instructions/i);
    // No operative violence instructions anywhere in the package.
    expect(allText).not.toMatch(/how to (kidnap|strangle|stab|poison|dispose of|hide a body)/i);
  });

  test('media library: exactly 1 cover + 7 gallery scenes as 8 native JPEG assets', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media, {
      characterIds: new Set(bundle.characters.characters.map((c) => c.id)),
      sceneIds: new Set(bundle.scenes.scenes.map((s) => s.id)),
    })).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    expect(media.gallery).toHaveLength(8);
    expect(media.gallery.filter((item) => item.kind === 'cover')).toHaveLength(1);
    expect(media.gallery.filter((item) => item.kind === 'scene')).toHaveLength(7);
    expect(media.gallery[0]).toMatchObject({ id: 'cover', file: media.cover, kind: 'cover' });
    const refs = media.gallery.map((item) => item.file);
    expect(new Set(refs).size).toBe(8);
    expect(refs).toContain(media.cover);
    // Files on disk match the registry exactly — nothing more, nothing less.
    expect(readdirSync(join(DIR, 'assets')).sort()).toEqual(['cover.jpg', 'gallery']);
    expect(readdirSync(join(DIR, 'assets', 'gallery')).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => `image-${String(i + 1).padStart(2, '0')}.jpg`),
    );
    expect(existsSync(join(DIR, 'assets', 'references'))).toBe(false);
    const sizes = refs.map((file) => {
      expect(existsSync(join(DIR, file))).toBe(true);
      const bytes = readFileSync(join(DIR, file));
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(bytes.length).toBeGreaterThan(10_000);
      return jpegSize(join(DIR, file));
    });
    // Native generated ratios preserved — every asset is a real image.
    for (const { width, height } of sizes) {
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    }
  });

  test('memory guidance persists clues, pattern, confrontations and who-knows-what', () => {
    expect(bundle.memory.storyId).toBe(ID);
    expect(bundle.memory.shortTermWindow).toBe(24);
    const seeds = bundle.memory.seedMemories.join('\n');
    expect(seeds).toMatch(/already boyfriend and girlfriend/i);
    expect(seeds).toMatch(/SECRET NARRATOR TRUTH/i);
    expect(seeds).toMatch(/unknown to \{\{playerName\}\}/i);
    expect(seeds).toMatch(/never let her confess it immediately/i);
    expect(seeds).toMatch(/disturbing pattern may emerge/i);
    expect(seeds).toMatch(/non-graphic/i);
    const hints = bundle.memory.extractionHints.join('\n');
    expect(hints).toMatch(/obsession, jealousy and possessiveness/i);
    expect(hints).toMatch(/clues and discoveries/i);
    expect(hints).toMatch(/confirmed facts strictly separate from suspicions/i);
    expect(hints).toMatch(/pattern around other girls/i);
    expect(hints).toMatch(/confrontations and revelations/i);
    expect(hints).toMatch(/who-knows-what/i);
    const never = bundle.memory.neverRemember.join('\n');
    expect(never).toMatch(/unconfirmed suspicion or theory/i);
    expect(never).toMatch(/gallery moment/i);
  });

  test('every package file is isolated to this storyId', () => {
    expect(bundle.story.id).toBe(ID);
    expect(bundle.characters.storyId).toBe(ID);
    expect(bundle.world.storyId).toBe(ID);
    expect(bundle.scenes.storyId).toBe(ID);
    expect(bundle.memory.storyId).toBe(ID);
    expect(meta.storyDir).toBe(ID);
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
    expect(prompt).toContain('Aarohi');
    expect(prompt).toMatch(/universal story memory/i);
    expect(prompt).toMatch(/endless, continuous, dynamic story/i);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory: a discovered clue survives scene changes and stays story-isolated', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const otherBundle: StoryBundle = {
      meta: manifest.stories.find((s) => s.id === 'tumhe-kabhi-pata-hi-nahi-chala')!,
      story: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'story.json'), 'utf8')),
      characters: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'characters.json'), 'utf8')),
      world: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'world.json'), 'utf8')),
      scenes: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'scenes.json'), 'utf8')),
      memory: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'memory.json'), 'utf8')),
      creator: KISSA_OWNER_CREATOR,
      source: 'remote',
    };
    const otherPlaythrough: Playthrough = {
      ...playthrough,
      id: 'tumhe-cross-check',
      storyId: 'tumhe-kabhi-pata-hi-nahi-chala',
      state: createInitialState('Bus-stop chai tapri'),
    };

    // Turn 1 — the player notices Aarohi knew Riya's batch without being told.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Aarohi ko Riya ke Economics batch ke baare mein bina bataye kaise pata tha?',
      assistantText: 'Aarohi: "Tumne hi kabhi bataya hoga, baby. Chhodo na, coffee piyo."',
      messageIds: ['u1', 'u2'],
      location: 'Lakeside cafe',
    });
    // Turn 2 — scene changes to the rented room; the clue must still be available.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Room par wapas aakar bhi wahi baat dimag mein atki hai — woh detail use kaise pata?',
      assistantText: 'Tumhe Aarohi ka woh ek-pal ka badla look yaad aata hai.',
      messageIds: ['u3', 'u4'],
      location: "MC's rented room",
    });
    // A different story writes into the same store.
    await engine.writeTurn({
      playthrough: otherPlaythrough,
      bundle: otherBundle,
      playerName: 'Reader',
      userText: 'Aanya ne poocha ki mera din kaisa tha.',
      assistantText: 'Aanya: "Chai pee lo, phir baat karenge."',
      messageIds: ['u5', 'u6'],
      location: 'The bus-stop chai tapri',
    });

    const recall = await engine.memorySearch({
      storyId: ID,
      playthroughId: playthrough.id,
      query: 'Aarohi Riya Economics batch bina bataye kaise pata clue',
      characters: ['aarohi', 'riya-sharma'],
      sceneId: bundle.story.openingSceneId,
      limit: 20,
    });
    const block = engine.buildContextBlock(recall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'aarohi' ? 'Aarohi' : id === 'riya-sharma' ? 'Riya' : id),
    });
    expect(block).toMatch(/Aarohi|Riya|Economics|batch/i);
    expect(block).not.toMatch(/Aanya|gulmohar|Shanti Didi/);

    const archive = await engine.loadArchive(playthrough.id);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.events.every((event) => event.storyId === ID)).toBe(true);
    expect(JSON.stringify(archive.events)).not.toMatch(/Aanya|gulmohar/);

    const otherArchive = await engine.loadArchive(otherPlaythrough.id);
    expect(otherArchive.events.every((event) => event.storyId === 'tumhe-kabhi-pata-hi-nahi-chala')).toBe(true);
    expect(JSON.stringify(otherArchive.events)).not.toMatch(/Aarohi|Riya Sharma/);
  });

  test('the bundle context keeps Aarohi and the player name for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'Lakeside cafe' });
    expect(JSON.stringify(ctx)).toContain('Aarohi');
    expect(JSON.stringify(ctx)).toContain('Reader');
  });
});
