/**
 * Content acceptance checks for the remote "Jo Usne Bataya Nahi" publication
 * (content-only OTA story; no app/APK change).
 *
 * Delivered through the EXISTING pipeline: content/manifest.json +
 * content/stories/<id>/ → GitHub Actions → Cloudflare Worker → installed app.
 * These tests assert the shipped package: schema validity, catalog
 * registration, the married-life premise, the warm (never villainous) wealthy
 * family, the locked facts of the secret meeting (movie + shopping only, no
 * hand-holding, no physical intimacy), player-controlled reaction, media
 * integrity and universal-memory persistence/isolation.
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

const ID = 'jo-usne-bataya-nahi';
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
  id: 'jo-usne-test',
  storyId: ID,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Malhotra House, the verandah'),
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

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, out));
  }
  return out;
}

/**
 * Any field that mentions physical intimacy must be a negation or a rule. An
 * affirmative field would mean the canon (movie + shopping only, no
 * hand-holding, no touching) was broken somewhere in the package.
 */
function affirmativeIntimacy(values: unknown): string[] {
  const keyword =
    /(hold(?:ing)? hands|held hands|kiss|kissed|kissing|touch(?:ing|ed)?|hug(?:ging|ged)?|intimacy|intimate|romantic contact|physical|sex|sexual|affair|cheat)/i;
  const negation = /\b(not|no|never|nor|cannot|can't|without|avoid|prohibit|must not|do not|don't|none|nothing)\b|nahi|nahin/i;
  return collectStrings(values).filter((line) => keyword.test(line) && !negation.test(line));
}

describe('Jo Usne Bataya Nahi — remote package', () => {
  test('is registered once in the existing catalog under a stable title and id', () => {
    expect(manifest.stories.filter((entry) => entry.id === ID)).toHaveLength(1);
    expect(meta.storyDir).toBe(ID);
    expect(meta.title).toBe('Jo Usne Bataya Nahi');
    expect(bundle.story.title).toBe(meta.title);
    expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
    expect(meta.version).toBe(1);
    expect(meta.tags).toContain('ongoing');
    expect(meta.tags).toContain('married-life');
    expect(meta.genres).toEqual([
      'Romance',
      'Married Life',
      'Family Drama',
      'Emotional Relationship',
      'Slice of Life',
    ]);
    expect(meta.creator?.name).toBe('Ankit');
    expect(validateBundle(bundle).issues).toEqual([]);
  });

  test('uses {{playerName}} everywhere and never hard-codes a player name', () => {
    expect(meta.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/exclusively.*player|player.*exclusively/i);
    expect(allText).toContain('{{playerName}}');
    expect(allText).not.toMatch(/\b(?:Ankit|Aarav|Rohan|Rahul)\b/);
    expect(allText).not.toMatch(/{{playerName}}\s*:/i);
    expect(bundle.characters.characters.map((c) => c.id)).toEqual([
      'aarohi',
      'vinayak-malhotra',
      'sarita-malhotra',
      'karan-mehta',
      'vikram',
    ]);
    for (const character of bundle.characters.characters) {
      expect(character.name).not.toContain('{{');
    }
    // {{playerName}} is an 18–19-year-old young adult, never an uncle figure.
    expect(bundle.story.userRole).toMatch(/18–19|18-19/);
    expect(allText).not.toMatch(/middle-aged player|uncle-like player/i);
    const playerRef = (bundle.characters as unknown as { playerVisualReference: { identityLock: string } })
      .playerVisualReference;
    expect(playerRef.identityLock).toMatch(/never middle-aged, never uncle-like/i);
  });

  test('the marriage already exists and the wife genuinely loves the player', () => {
    const aarohi = bundle.characters.characters.find((c) => c.id === 'aarohi')!;
    expect(aarohi.role).toMatch(/wife of \{\{playerName\}\}/);
    expect(aarohi.relationshipWithUser).toMatch(/married/i);
    expect(aarohi.personality).toMatch(/most important person in her life|most important person/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/married for three months/i);
    expect(bundle.world.lore.join('\n')).toMatch(/genuinely loves/i);
    expect(bundle.story.setting).toMatch(/Malhotra House/i);
    // The wife is an elegant adult, not a child and not a caricature.
    expect(aarohi.role).toMatch(/aged 20|20;/);
    expect(aarohi.background).toMatch(/refined|tasteful/i);
    // And it is not a "poor husband vs rich family" story.
    expect(allText).toMatch(/NOT a poor-husband-versus-rich-family story|not a poor husband/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never write constant insults/i);
  });

  test('the wealthy family is warm and accepting, never villainous', () => {
    const vinayak = bundle.characters.characters.find((c) => c.id === 'vinayak-malhotra')!;
    const sarita = bundle.characters.characters.find((c) => c.id === 'sarita-malhotra')!;
    expect(vinayak.relationshipWithUser).toMatch(/as his son-in-law and genuinely as family/i);
    expect(sarita.relationshipWithUser).toMatch(/loves \{\{playerName\}\} as her own son/i);
    expect(vinayak.personality).toMatch(/warm/i);
    expect(sarita.personality).toMatch(/warm/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/genuinely love and accept/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/Contempt, humiliation or poverty-shaming/i);
    // No evil-rich-family / crime / inheritance tropes in the package.
    expect(bundle.world.rules.join('\n')).toMatch(/do not convert the story into crime, blackmail, murder mystery/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/blackmail, inheritance conspiracy, murder mystery/i);
  });

  test('the other boy was known only through chats before the first meeting', () => {
    const karan = bundle.characters.characters.find((c) => c.id === 'karan-mehta')!;
    expect(karan.role).toMatch(/chatting with Aarohi/i);
    expect(karan.knowledge.join('\n')).toMatch(/first face-to-face meeting/i);
    expect(karan.knowledge.join('\n')).toMatch(/never met her husband/i);
    expect(karan.knowledge.join('\n')).toMatch(/ten months/i);
    const aarohi = bundle.characters.characters.find((c) => c.id === 'aarohi')!;
    expect(aarohi.knowledge.join('\n')).toMatch(/never met in person before today|had never met in person/i);
    expect(bundle.world.lore.join('\n')).toMatch(/Their history is chats/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/never met in person before today/i);
  });

  test('CANON LOCK: the first meeting is movie + shopping only — no hand-holding, no intimacy', () => {
    const lockTexts = [
      bundle.world.lore.join('\n'),
      bundle.memory.seedMemories.join('\n'),
      bundle.world.rules.join('\n'),
      bundle.characters.characters.map((c) => c.knowledge.join('\n')).join('\n'),
    ];
    for (const text of lockTexts) {
      expect(text).toMatch(/did NOT hold hands/i);
    }
    expect(bundle.world.lore.join('\n')).toMatch(/did NOT touch/i);
    expect(bundle.world.lore.join('\n')).toMatch(/no kiss, romance or physical intimacy of any kind/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/movie|afternoon show/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/birthday gift|shopping/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/Any invented hand-holding, kissing, touching/i);
    // Every sentence that mentions intimacy is a prohibition, never an event.
    expect(affirmativeIntimacy(corpus)).toEqual([]);
    // The conflict is framed as trust/boundaries/honesty, not as an affair.
    expect(bundle.world.premise).toMatch(/secret meeting, trust, boundaries, honesty and emotional attachment/i);
    expect(bundle.world.premise).toMatch(/not about proving a physical affair/i);
  });

  test('the player discovers the meeting on the same day and decides everything next', () => {
    expect(bundle.world.timeline.join('\n')).toMatch(/discovery|discovers/i);
    expect(bundle.world.lore.join('\n')).toMatch(/discovers the meeting on the same day/i);
    expect(bundle.world.lore.join('\n')).toMatch(/proves nothing about physical intimacy/i);
    expect(bundle.story.description).toMatch(/usi din pata chal jaati hai/i);
    expect(bundle.world.lore.join('\n')).toMatch(/entirely player-controlled and no response is wrong/i);
    expect(bundle.memory.neverRemember.join('\n')).toMatch(/forced reconciliation, forced divorce/i);
    const scene = bundle.scenes.scenes[0];
    const texts = scene.choices.map((choice) => choice.text.toLowerCase()).join('\n');
    expect(texts).toMatch(/kahan thi|kaun hai/);
    expect(texts).toMatch(/chup|kuch mat/);
    expect(texts).toMatch(/vikram/);
  });

  test('opening ends on the discovery with no accusation or verdict yet', () => {
    expect(bundle.story.openingSceneId).toBe('malhotra_house_ki_shaam');
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const [scene] = bundle.scenes.scenes;
    expect(scene.isEnding).not.toBe(true);
    const opening = scene.narration.join('\n');
    expect(opening).toContain('{{playerName}}');
    expect(opening).toContain('Vikram: "Bhai, maine sirf jo dekha woh bhej diya.');
    expect(opening).toContain('Aarohi: "Tum aa gaye!');
    expect(opening).toContain('Aarohi: "Waise aaj poora din Riya ke saath nikla');
    expect(opening).toContain('Aarohi: "{{playerName}}? Sab theek hai na?');
    // The opening states exactly what the photograph proves — and what it doesn't.
    expect(opening).toMatch(/Kisi ne haath nahi pakda hua/);
    expect(scene.choices.length).toBeGreaterThanOrEqual(2);
    for (const choice of scene.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      if (choice.shortLabel) expect(choice.shortLabel.length).toBeLessThanOrEqual(20);
    }
    const rendered = offlineOpening(bundle, 'Aarav Reader').lines.map((l) => l.text).join('\n');
    expect(rendered).toContain('Aarav Reader');
    expect(rendered).not.toContain('{{playerName}}');
  });

  test('is endless and never turns into crime, conspiracy or forced melodrama', () => {
    const serialized = JSON.stringify(bundle.scenes);
    expect(serialized).not.toMatch(/"isEnding"\s*:\s*true/);
    expect(serialized).not.toMatch(/"endStory"/);
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|phase|stage)\s*\d+/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never forces reconciliation or divorce|Neither reconciliation nor separation is predetermined/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/no automatic crime, blackmail, inheritance or murder-mystery turn/i);
  });

  test('memory guidance keeps the marriage, the chats, the meeting and the discovery', () => {
    const hints = bundle.memory.extractionHints.join('\n');
    expect(hints).toMatch(/marriage history/i);
    expect(hints).toMatch(/chats with Karan/i);
    expect(hints).toMatch(/first face-to-face meeting exactly as it happened/i);
    expect(hints).toMatch(/no hand-holding, no touching and no intimacy/i);
    expect(hints).toMatch(/Track the discovery/i);
    expect(hints).toMatch(/boundaries/i);
    expect(hints).toMatch(/family reactions/i);
    expect(hints).toMatch(/location and scene changes/i);
    expect(hints).toMatch(/never replace the history with only the newest scene/i);
    expect(bundle.memory.seedMemories.join('\n')).toMatch(/must not be dropped|not dropped/i);
  });

  test('media library: cover + gallery are unique, registered JPEGs with native ratios', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media, {
      characterIds: new Set(bundle.characters.characters.map((c) => c.id)),
      sceneIds: new Set(bundle.scenes.scenes.map((s) => s.id)),
    })).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    // Schema limit is 8 entries; further artwork is appended over the same
    // remote pipeline (no app update), so the registry is asserted to be
    // consistent with the shipped files rather than to a fixed count.
    expect(media.gallery.length).toBeGreaterThanOrEqual(3);
    expect(media.gallery.length).toBeLessThanOrEqual(8);
    expect(media.gallery[0]).toMatchObject({ id: 'cover', file: media.cover, kind: 'cover' });
    const portraits = media.gallery.filter((item) => item.kind === 'character-portrait');
    expect(portraits.map((p) => p.characterId)).toEqual(expect.arrayContaining(['aarohi']));
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
    expect(sizes.some(({ width, height }) => height > width)).toBe(true);
    // Every image keeps its NATIVE generated size — nothing is resized or
    // cropped to a fixed ratio. (Landscape scene art is appended through the
    // same remote pipeline by a following content update.)
    expect(new Set(sizes.map(({ width, height }) => `${width}x${height}`)).size).toBeGreaterThan(1);
  });

  test('canonical visual identities are locked, distinct and never generic', () => {
    const withRefs = bundle.characters as unknown as {
      playerVisualReference?: { file: string; canonical: boolean; identityLock: string };
      characters: { id: string; visualReference?: { file: string; canonical: boolean; identityLock: string } }[];
    };
    const player = withRefs.playerVisualReference!;
    const aarohi = withRefs.characters.find((c) => c.id === 'aarohi')!.visualReference!;
    expect(player.file).toBe('assets/references/mc.jpg');
    expect(aarohi.file).toBe('assets/references/aarohi.jpg');
    expect(player.file).not.toBe(aarohi.file);
    for (const ref of [player, aarohi]) {
      expect(ref.canonical).toBe(true);
      expect(ref.identityLock.length).toBeGreaterThan(60);
      expect(existsSync(join(DIR, ref.file))).toBe(true);
    }
    // The wife's wealth shows through tasteful styling, not exaggeration.
    expect(aarohi.identityLock).toMatch(/never exaggerated or costume-like/i);
    expect(aarohi.identityLock).toMatch(/silk kurtas|modern sarees/i);
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
    expect(prompt).toContain('Aarohi Malhotra');
    expect(prompt).toMatch(/Use Kissa's existing universal memory and conversation context/i);
    expect(prompt).toMatch(/endless, dynamic story/i);
    expect(prompt).toMatch(/did NOT hold hands/i);
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('universal memory: the discovery survives scene changes and stays story-isolated', async () => {
    const store = createInMemoryStoryMemoryStore() as InMemoryStoryMemoryStore;
    const engine: StoryMemoryEngine = createStoryMemoryEngine(store);
    const aanyaBundle: StoryBundle = {
      meta: manifest.stories.find((s) => s.id === 'tumhe-kabhi-pata-hi-nahi-chala')!,
      story: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'story.json'), 'utf8')),
      characters: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'characters.json'), 'utf8')),
      world: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'world.json'), 'utf8')),
      scenes: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'scenes.json'), 'utf8')),
      memory: JSON.parse(readFileSync(join(ROOT, 'stories', 'tumhe-kabhi-pata-hi-nahi-chala', 'memory.json'), 'utf8')),
      creator: KISSA_OWNER_CREATOR,
      source: 'remote',
    };
    const aanyaPlaythrough: Playthrough = {
      ...playthrough,
      id: 'tumhe-cross-check',
      storyId: 'tumhe-kabhi-pata-hi-nahi-chala',
      state: createInitialState('Bus-stop chai tapri'),
    };

    // Turn 1 — the discovery on the verandah.
    await engine.writeTurn({
      playthrough,
      bundle,
      playerName: 'Reader',
      userText: 'Vikram ne mall ki photo bheji—Aarohi kisi anjaan ladke ke saath thi.',
      assistantText: 'Aarohi: "Tum poochho toh main bata doongi."',
      messageIds: ['j1', 'j2'],
      location: 'Malhotra House verandah',
    });
    // Turn 2 — scene changes to the mall, where the facts must still be available.
    await engine.writeTurn({
      playthrough: { ...playthrough, currentSceneId: 'mall_watch_counter' },
      bundle,
      playerName: 'Reader',
      userText: 'Watch-service counter par ghadi lene aaya, par mann photo par hi atka hai.',
      assistantText: 'Aarohi: "Tumne ghadi repair karwa li? Main samjhi thi tum bhool gaye."',
      messageIds: ['j3', 'j4'],
      location: 'The city mall',
    });
    // A different story writes into the same store.
    await engine.writeTurn({
      playthrough: aanyaPlaythrough,
      bundle: aanyaBundle,
      playerName: 'Reader',
      userText: 'Aanya ne poocha ki mera din kaisa tha.',
      assistantText: 'Aanya: "Chai pee lo, phir baat karenge."',
      messageIds: ['j5', 'j6'],
      location: 'The bus-stop chai tapri',
    });

    const recall = await engine.memorySearch({
      storyId: ID,
      playthroughId: playthrough.id,
      query: 'Vikram ki bheji photo Aarohi anjaan ladka mall',
      characters: ['aarohi', 'vikram'],
      sceneId: 'mall_watch_counter',
      limit: 20,
    });
    const block = engine.buildContextBlock(recall, {
      currentSeq: 99,
      nameOf: (id) => (id === 'aarohi' ? 'Aarohi' : id === 'vikram' ? 'Vikram' : id),
    });
    expect(block).toMatch(/Aarohi|photo|Vikram/i);
    expect(block).not.toMatch(/Aanya|gulmohar|Shanti Didi/);
    expect(block).not.toMatch(/held hands|kiss/i);

    const archive = await engine.loadArchive(playthrough.id);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.events.every((event) => event.storyId === ID)).toBe(true);
    expect(JSON.stringify(archive.events).toLowerCase()).toMatch(/photo|aarohi|vikram/);
    expect(JSON.stringify(archive.events)).not.toMatch(/Aanya|gulmohar/);

    const aanyaArchive = await engine.loadArchive(aanyaPlaythrough.id);
    expect(aanyaArchive.events.every((event) => event.storyId === 'tumhe-kabhi-pata-hi-nahi-chala')).toBe(true);
    expect(JSON.stringify(aanyaArchive.events)).not.toMatch(/Aarohi|Malhotra/);
  });

  test('the bundle context keeps Aarohi and the verified marriage facts for the narrator', () => {
    const ctx = contextFromBundle(bundle, { playerName: 'Reader', currentLocation: 'Malhotra House' });
    expect(JSON.stringify(ctx)).toContain('Aarohi');
    expect(JSON.stringify(ctx)).toContain('Reader');
  });
});
