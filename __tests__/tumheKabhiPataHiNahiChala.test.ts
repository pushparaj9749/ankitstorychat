/**
 * Content acceptance checks for the remote "Tumhe Kabhi Pata Hi Nahi Chala"
 * publication (content-only OTA story; no app/APK change).
 *
 * The story is delivered through the EXISTING pipeline (content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app),
 * so these tests assert the shipped package: schema validity, catalog
 * registration, player-name interpolation, the childhood-friend canon (never
 * siblings / never family), the slow-burn behaviour design, media integrity,
 * the universal memory architecture (persistence + isolation) and the existing
 * prompt/memory integration.
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

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, out));
  }
  return out;
}

/**
 * Every mention of sibling/step/family wording must sit inside a prohibition or
 * negation ("are NOT siblings", "Never use bhai/behen…", "nahi hain") — an
 * affirmative use would mean the canon has been broken somewhere in the package.
 */
function affirmativeSiblingFraming(values: unknown): string[] {
  const keyword = /(sibling|step-sibling|step-sister|step-brother|bhai|behen|bahin|brother|sister)/i;
  const negation = /\b(not|no|never|nor|cannot|can't|without|avoid|prohibit|must not|do not|don't|unrelated)\b|nahi|nahin/i;
  return collectStrings(values).filter((line) => keyword.test(line) && !negation.test(line));
}

const ID = 'tumhe-kabhi-pata-hi-nahi-chala';
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
const serialized = JSON.stringify({ ...bundle, meta: undefined, creator: undefined });
// Creator attribution is metadata ("Ankit"), not story content — excluded here.
const corpus = [bundle.story, bundle.characters, bundle.world, bundle.scenes, bundle.memory].map(
  (value, index) => (index === 0 ? { ...(value as unknown as Record<string, unknown>), creator: undefined } : value),
);
const allText = corpus.map((value) => JSON.stringify(value)).join('\n');

const playthrough: Playthrough = {
  id: 'tumhe-kabhi-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('The chai tapri near Aanya’s hostel gate'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
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

describe('Tumhe Kabhi Pata Hi Nahi Chala — remote package', () => {
  test('is registered once in the existing catalog under its exact title', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe('Tumhe Kabhi Pata Hi Nahi Chala');
    expect(bundle.story.title).toBe(meta.title);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.tags).toContain('ongoing');
    expect(meta.tags).toContain('slow-burn');
    expect(meta.genres).toEqual(['Slice of Life', 'Slow-Burn Romance', 'Youth', 'Emotional Romance']);
    expect(meta.creator?.name).toBe('Ankit');
    expect(validateBundle(bundle).issues).toEqual([]);
  });

  test('uses {{playerName}} everywhere and never hard-codes a player name', () => {
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/exclusively.*player|player.*exclusively/i);
    expect(allText).toContain('{{playerName}}');
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Rohan|Rahul)\b/);
    expect(allText).not.toMatch(/{{playerName}}\s*:/i);
    expect(bundle.characters.characters.map((c) => c.name)).toEqual(['Aanya', 'Shanti Didi']);
    for (const character of bundle.characters.characters) {
      expect(character.name).not.toContain('{{');
      expect(character.role).toContain('{{playerName}}');
    }
  });

  test('canon: Aanya is an unrelated childhood friend, never a sibling or family', () => {
    // The package must state the canon explicitly…
    expect(bundle.characters.characters[0].background).toContain('NOT siblings');
    expect(bundle.world.premise).toMatch(/NOT siblings/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/NOT siblings/i);
    // …and must never frame the friendship as a sibling/step/family relation:
    // every sibling-related sentence has to be a negation or an explicit rule.
    expect(affirmativeSiblingFraming(corpus)).toEqual([]);
    expect(allText).toMatch(/Never use bhai\/behen/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never frame their bond as forbidden or incestuous/i);
  });

  test('opening sets the rainy chai-tapri evening and ends on an open player decision', () => {
    expect(bundle.story.openingSceneId).toBe('chai_tapri_ki_shaam');
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const [scene] = bundle.scenes.scenes;
    expect(scene.id).toBe(bundle.story.openingSceneId);
    expect(scene.isEnding).not.toBe(true);
    const opening = scene.narration.join('\n');
    expect(opening).toContain('{{playerName}}');
    expect(opening).toContain('Aanya: "Arre, aa gaye!');
    expect(opening).toContain('Aanya: "{{playerName}}… ek baat hai. Nahi, kuch nahi. Aise hi—"');
    expect(opening).toContain('Baaki duniya ka faisla kal.');
    expect(scene.choices.length).toBeGreaterThanOrEqual(2);
    for (const choice of scene.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      if (choice.shortLabel) expect(choice.shortLabel.length).toBeLessThanOrEqual(20);
    }
    // The suggested replies never state what {{playerName}} feels.
    for (const choice of scene.choices) {
      expect(choice.text).not.toMatch(/\bmain (usko|use) (pyaar|pyar) karta hoon\b/i);
      expect(choice.text).not.toMatch(/\bmujhe (uski|unki) feelings pata/i);
    }
    const rendered = offlineOpening(bundle, 'Aarav Reader').lines.map((l) => l.text).join('\n');
    expect(rendered).toContain('Aarav Reader');
    expect(rendered).not.toContain('{{playerName}}');
  });

  test('is continuous and endless: no arcs, chapters, stages, routes or endings', () => {
    expect(serialized).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(serialized).not.toMatch(/"endStory"/);
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage)\s*\d+/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/no arcs, chapters, phases, stages/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never create arcs, chapters/i);
  });

  test('slow-burn design: feelings are shown behaviourally and never declared early', () => {
    const aanya = bundle.characters.characters[0];
    expect(aanya.personality).toMatch(/remembers everything|remembers his|remembers/i);
    expect(aanya.personality).toMatch(/jealous/i);
    expect(aanya.relationshipWithUser).toMatch(/not confessed|has NOT confessed/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/has NOT confessed them and .*does NOT know/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/starts to say something personal|almost told/i);
    expect(bundle.world.rules.join('\n')).toMatch(/show aanya's growing feelings through behaviour/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/half-finished sentences|sudden quiet/i);
    // MC genuinely does not know yet at the opening.
    expect(bundle.story.userRole).toMatch(/does not yet know/i);
  });

  test('childhood memory bank is specified and must survive scene changes', () => {
    const lore = bundle.world.lore.join('\n');
    for (const anchor of ['blue gate', 'gulmohar', 'paper boats', 'wristwatch', 'lantern', 'promise']) {
      expect(lore.toLowerCase()).toContain(anchor);
    }
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/gulmohar tree/);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/wristwatch/);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/childhood history precisely/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/location and scene changes|across location and scene changes/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/never replace the whole history with only the newest scene/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/promise.*only after.*actually choose/i);
  });

  test('neverRemember protects player agency, invented confessions and sibling framing', () => {
    const never = bundle.memory.neverRemember.join('\n');
    expect(never).toMatch(/hard-coded personal name/i);
    expect(never).toMatch(/invented player dialogue|assumed thoughts/i);
    expect(never).toMatch(/confession, kiss, intimacy/i);
    expect(never).toMatch(/sibling, step-sibling, cousin/i);
    expect(never).toMatch(/terminal ending/i);
  });

  test('media library: cover + gallery are unique, registered JPEGs with native ratios', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media, {
      characterIds: new Set(bundle.characters.characters.map((c) => c.id)),
      sceneIds: new Set(bundle.scenes.scenes.map((s) => s.id)),
    })).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    // Schema limit is 8 entries; more artwork is appended over the same remote
    // pipeline (no app update), so the registry is asserted to be consistent
    // with what is actually shipped rather than to a fixed count.
    expect(media.gallery.length).toBeGreaterThanOrEqual(3);
    expect(media.gallery.length).toBeLessThanOrEqual(8);
    expect(media.gallery[0]).toMatchObject({ id: 'cover', file: media.cover, kind: 'cover' });
    // Both leads ship a canonical character portrait.
    const portraits = media.gallery.filter((item) => item.kind === 'character-portrait');
    expect(portraits.map((p) => p.characterId)).toEqual(expect.arrayContaining(['aanya']));
    const refs = media.gallery.map((item) => item.file);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs).toContain(media.cover);
    expect(readdirSync(join(DIR, 'assets', 'gallery')).sort()).toEqual(
      refs
        .filter((file) => file.includes('/gallery/'))
        .map((file) => file.split('/').pop()!)
        .sort(),
    );
    const sizes = refs.map((file) => {
      expect(existsSync(join(DIR, file))).toBe(true);
      const bytes = readFileSync(join(DIR, file));
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(bytes.length).toBeGreaterThan(10_000);
      return jpegSize(join(DIR, file));
    });
    // Native/source ratios, not normalised: both portrait and landscape exist.
    expect(sizes.some(({ width, height }) => height > width)).toBe(true);
    expect(sizes.some(({ width, height }) => width > height)).toBe(true);
  });

  test('character visual identities are canonical, locked and distinct', () => {
    const withRefs = bundle.characters as unknown as {
      playerVisualReference?: { file: string; canonical: boolean; identityLock: string };
      characters: { id: string; visualReference?: { file: string; canonical: boolean; identityLock: string } }[];
    };
    const player = withRefs.playerVisualReference!;
    const aanya = withRefs.characters.find((c) => c.id === 'aanya')!.visualReference!;
    expect(player.file).toBe('assets/references/mc.jpg');
    expect(aanya.file).toBe('assets/references/aanya.jpg');
    expect(player.file).not.toBe(aanya.file);
    for (const ref of [player, aanya]) {
      expect(ref.canonical).toBe(true);
      expect(ref.identityLock.length).toBeGreaterThan(60);
      expect(existsSync(join(DIR, ref.file))).toBe(true);
    }
    // The MC identity is explicitly youthful — never aged up.
    expect(player.identityLock).toMatch(/never age him up/i);
    expect(player.identityLock).toMatch(/18–19|18-19/);
    expect(aanya.identityLock).toMatch(/18–19|18-19/);
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
    expect(prompt).toContain('Aanya');
    expect(prompt).toMatch(/Use Kissa's existing universal memory and conversation context/i);
    expect(prompt).toMatch(/endless, dynamic story/i);
    expect(prompt).not.toContain('{{playerName}}');
    expect(prompt).toMatch(/not siblings|NOT siblings/i);
  });

  test('universal memory: facts survive a scene change and stay isolated from other stories', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const other = JSON.parse(
      readFileSync(join(ROOT, 'stories', 'jo-usne-bataya-nahi', 'story.json'), 'utf8'),
    ) as StoryBundle['story'];
    const otherBundle: StoryBundle = {
      meta: manifest.stories.find((s) => s.id === 'jo-usne-bataya-nahi')!,
      story: other,
      characters: JSON.parse(readFileSync(join(ROOT, 'stories', 'jo-usne-bataya-nahi', 'characters.json'), 'utf8')),
      world: JSON.parse(readFileSync(join(ROOT, 'stories', 'jo-usne-bataya-nahi', 'world.json'), 'utf8')),
      scenes: JSON.parse(readFileSync(join(ROOT, 'stories', 'jo-usne-bataya-nahi', 'scenes.json'), 'utf8')),
      memory: JSON.parse(readFileSync(join(ROOT, 'stories', 'jo-usne-bataya-nahi', 'memory.json'), 'utf8')),
      creator: KISSA_OWNER_CREATOR,
      source: 'remote',
    };
    const otherPlaythrough: Playthrough = {
      ...playthrough,
      id: 'jo-usne-test',
      storyId: 'jo-usne-bataya-nahi',
      state: createInitialState('Malhotra House verandah'),
    };

    // Turn 1 — at the chai tapri.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Maine Aanya ko bataya ki Sharma ji ne daanta aur mera din kharaab tha.',
      assistantText: 'Aanya: "Main pehle se jaanti thi. Chai pee lo, phir baat karenge."',
      messageIds: ['m1', 'm2'],
      location: 'The bus-stop chai tapri',
    });
    // Turn 2 — the scene changes to the orphanage terrace.
    await engine.writeTurn({
      playthrough: { ...playthrough, currentSceneId: 'chhat_ki_raat' },
      bundle,
      playerName: 'Reader',
      userText: 'Aanya ne chhat par yaad dilaya ki bachpan mein main gulmohar par ooncha chadh gaya tha aur Shanti Didi ne dono ko daanta tha.',
      assistantText: 'Aanya: "Tum tab ro rahe the, aur maine kaha tha ki main tumhara haath pakad ke rakhungi."',
      messageIds: ['m3', 'm4'],
      location: 'The chhat (orphanage terrace)',
    });
    // A different story writes its own facts into the same store.
    await engine.writeTurn({
      playthrough: otherPlaythrough,
      bundle: otherBundle,
      playerName: 'Reader',
      userText: 'Aarohi ko mall mein kisi aur ladke ke saath dekha.',
      assistantText: 'Aarohi: "Tum poochho toh main bata doongi."',
      messageIds: ['m5', 'm6'],
      location: 'Malhotra House verandah',
    });

    const recall = await engine.memorySearch({
      storyId: ID,
      playthroughId: playthrough.id,
      query: 'Sharma ji ne studio mein daanta, mera din kharaab tha',
      characters: ['aanya', 'shanti-didi'],
      sceneId: 'chhat_ki_raat',
      limit: 20,
    });
    const block = engine.buildContextBlock(recall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'aanya' ? 'Aanya' : id === 'shanti-didi' ? 'Shanti Didi' : id),
    });
    // The turn-1 fact is still retrievable from the later scene…
    expect(block).toMatch(/Sharma|daanta|kharaab/i);
    // …and nothing from the other story leaks in.
    expect(block).not.toMatch(/Aarohi|Malhotra|Karan/);

    // The earlier (pre-scene-change) turn is still in the raw archive.
    const archive = await engine.loadArchive(playthrough.id);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.events.every((event) => event.storyId === ID)).toBe(true);
    expect(JSON.stringify(archive.events)).toMatch(/Sharma|daanta|kharaab/i);
    expect(JSON.stringify(archive.events)).not.toMatch(/Aarohi|Malhotra/);

    // The childhood memory bank must still reach the narrator from the NEW
    // scene (the existing memory architecture + the pack's memory guidance).
    const laterPrompt = buildSystemPrompt(
      {
        bundle,
        playthrough: { ...playthrough, currentSceneId: 'chhat_ki_raat' },
        profile: { nickname: 'Reader', ageGroup: '18+', createdAt: playthrough.createdAt },
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(laterPrompt).toMatch(/gulmohar/i);
    expect(laterPrompt).toMatch(/paper boats/i);
    expect(laterPrompt).toMatch(/wristwatch/i);
    expect(laterPrompt).not.toMatch(/Aarohi|Malhotra/);

    // The other story shares the same store but must never reach story 1's facts.
    const otherRecall = await engine.memorySearch({
      storyId: 'jo-usne-bataya-nahi',
      playthroughId: otherPlaythrough.id,
      query: 'Aarohi mall photo Vikram',
      characters: ['aarohi'],
      sceneId: otherBundle.story.openingSceneId,
      limit: 20,
    });
    expect(otherRecall.events.every((event) => event.storyId === 'jo-usne-bataya-nahi')).toBe(true);
    expect(JSON.stringify(otherRecall)).not.toMatch(/Aanya|gulmohar|Shanti Didi/);
    const otherBlock = engine.buildContextBlock(otherRecall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'aarohi' ? 'Aarohi' : id),
    });
    expect(otherBlock).not.toMatch(/Aanya|gulmohar|Shanti Didi/);
    const otherArchive = await engine.loadArchive(otherPlaythrough.id);
    expect(otherArchive.events.every((event) => event.storyId === 'jo-usne-bataya-nahi')).toBe(true);
    expect(otherArchive.events.some((event) => event.playthroughId === playthrough.id)).toBe(false);
  });

  test('the bundle context keeps Aanya and the memory seeds for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'The chhat' });
    expect(JSON.stringify(ctx)).toContain('Aanya');
    expect(JSON.stringify(ctx)).toContain('Reader');
  });
});
