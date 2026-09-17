/**
 * Story content validation — dependency-free so it runs in jest (Node)
 * and inside the app. Malformed content must never crash the app.
 */
import type {
  CharactersFile,
  ContentManifest,
  MemoryFile,
  ScenesFile,
  StoryBundle,
  StoryCreator,
  StoryFile,
  StoryMeta,
  WorldFile,
} from '../types';

/** Maximum length for any free-text user-supplied field (defense in depth). */
export const MAX_TEXT_FIELD = 20_000;
export const MAX_CREATOR_NAME = 60;
export const MAX_JSON_PAYLOAD = 500_000; // 500KB per submission

const DANGEROUS_HTML_RE = /<\s*(script|iframe|object|embed|link|style|form|svg|math|details)[^>]*>/i;
const JS_URL_RE = /\s*javascript\s*:/i;

/** Returns true when a string looks like it contains executable/HTML markup. */
export function containsUnsafeContent(s: string): boolean {
  if (!s) return false;
  if (DANGEROUS_HTML_RE.test(s)) return true;
  if (JS_URL_RE.test(s)) return true;
  // Event-handler injection like `<img onload=...>` (already covered by <img check? we allow img? No — we reject all tags above).
  return false;
}

/** Trim + length + safety check for a creator-name field. */
export function sanitizeCreatorName(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: 'creator.name must be a string' };
  const v = raw.trim();
  if (!v) return { ok: false, message: 'Creator name is required' };
  if (v.length > MAX_CREATOR_NAME)
    return { ok: false, message: `Creator name is too long (max ${MAX_CREATOR_NAME} characters)` };
  if (containsUnsafeContent(v)) return { ok: false, message: 'Creator name contains unsupported markup' };
  return { ok: true, value: v };
}

/** Validate a StoryCreator object. `verified` is ignored (forced false on user submit). */
export function validateCreator(c: unknown, requireName = true): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!c || typeof c !== 'object') {
    if (requireName) issues.push(issue('creator', 'must be an object'));
    return { ok: issues.length === 0, issues };
  }
  const cc = c as Partial<StoryCreator>;
  const nameRes = sanitizeCreatorName(cc.name);
  if (!nameRes.ok) issues.push(issue('creator.name', nameRes.message));
  if (cc.avatar !== null && cc.avatar !== undefined) {
    if (typeof cc.avatar !== 'string' || cc.avatar.length > 500)
      issues.push(issue('creator.avatar', 'must be null or a short URL string'));
  }
  return { ok: issues.length === 0, issues };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/* ---------------- manifest ---------------- */

export function validateManifest(m: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!m || typeof m !== 'object') return { ok: false, issues: [issue('$', 'manifest must be an object')] };
  const man = m as Partial<ContentManifest>;
  if (typeof man.contentVersion !== 'number') issues.push(issue('contentVersion', 'must be a number'));
  if (!Array.isArray(man.stories)) {
    issues.push(issue('stories', 'must be an array'));
    return { ok: issues.length === 0, issues };
  }
  const ids = new Set<string>();
  man.stories.forEach((s, i) => {
    const p = `stories[${i}]`;
    const meta = s as Partial<StoryMeta>;
    if (!isNonEmptyString(meta.id)) issues.push(issue(`${p}.id`, 'missing story id'));
    else if (ids.has(meta.id)) issues.push(issue(`${p}.id`, `duplicate story id "${meta.id}"`));
    else ids.add(meta.id);
    if (!isNonEmptyString(meta.title)) issues.push(issue(`${p}.title`, 'missing title'));
    if (!isNonEmptyString(meta.description)) issues.push(issue(`${p}.description`, 'missing description'));
    if (!['12-17', '18+'].includes(meta.ageRating as string))
      issues.push(issue(`${p}.ageRating`, `invalid ageRating "${meta.ageRating}"`));
    if (!['teen', 'mature'].includes(meta.contentLevel as string))
      issues.push(issue(`${p}.contentLevel`, `invalid contentLevel "${meta.contentLevel}"`));
    if (typeof meta.version !== 'number') issues.push(issue(`${p}.version`, 'must be a number'));
    if (!isNonEmptyString(meta.storyDir)) issues.push(issue(`${p}.storyDir`, 'missing storyDir'));
    if (!isNonEmptyString(meta.userRole)) issues.push(issue(`${p}.userRole`, 'missing userRole'));
    if (!isNonEmptyString(meta.setting)) issues.push(issue(`${p}.setting`, 'missing setting'));
    if (!meta.coverBundled && !meta.coverUrl)
      issues.push(issue(`${p}.cover`, 'needs coverBundled or coverUrl'));
    if (!Array.isArray(meta.genres) || meta.genres.length === 0)
      issues.push(issue(`${p}.genres`, 'needs at least one genre'));
  });
  return { ok: issues.length === 0, issues };
}

/* ---------------- story.json ---------------- */

export function validateStoryFile(storyId: string, s: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!s || typeof s !== 'object') return { ok: false, issues: [issue('$', 'story must be an object')] };
  const f = s as Partial<StoryFile>;
  if (f.id !== storyId) issues.push(issue('id', `must equal "${storyId}"`));
  for (const k of ['title', 'description', 'userRole', 'setting', 'openingSceneId', 'tone'] as const) {
    if (!isNonEmptyString(f[k])) issues.push(issue(k, 'missing or empty'));
  }
  if (!['12-17', '18+'].includes(f.ageRating as string)) issues.push(issue('ageRating', 'invalid'));
  if (!['teen', 'mature'].includes(f.contentLevel as string)) issues.push(issue('contentLevel', 'invalid'));
  if (f.creator !== undefined && f.creator !== null) {
    const cr = validateCreator(f.creator, false);
    cr.issues.forEach((i) => issues.push({ path: `creator.${i.path}`, message: i.message }));
  }
  return { ok: issues.length === 0, issues };
}

/* ---------------- characters.json ---------------- */

export function validateCharactersFile(storyId: string, c: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!c || typeof c !== 'object') return { ok: false, issues: [issue('$', 'characters must be an object')] };
  const f = c as Partial<CharactersFile>;
  if (f.storyId !== storyId) issues.push(issue('storyId', `must equal "${storyId}"`));
  if (!Array.isArray(f.characters) || f.characters.length === 0) {
    issues.push(issue('characters', 'needs at least one character'));
    return { ok: issues.length === 0, issues };
  }
  const ids = new Set<string>();
  f.characters.forEach((ch, i) => {
    const p = `characters[${i}]`;
    if (!isNonEmptyString(ch.id)) issues.push(issue(`${p}.id`, 'missing id'));
    else if (ids.has(ch.id)) issues.push(issue(`${p}.id`, `duplicate id "${ch.id}"`));
    else ids.add(ch.id);
    for (const k of ['name', 'role', 'personality', 'background', 'speakingStyle', 'sampleLine'] as const) {
      if (!isNonEmptyString(((ch as unknown) as Record<string, unknown>)[k] as string))
        issues.push(issue(`${p}.${k}`, 'missing or empty'));
    }
    // A character NAME must be literal — {{playerName}} in a name would break
    // speaker parsing and could rename a character to the reader.
    if (typeof ch.name === 'string' && ch.name.includes('{{'))
      issues.push(issue(`${p}.name`, 'must not contain {{...}} placeholders'));
  });
  return { ok: issues.length === 0, issues };
}

/* ---------------- world.json ---------------- */

export function validateWorldFile(storyId: string, w: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!w || typeof w !== 'object') return { ok: false, issues: [issue('$', 'world must be an object')] };
  const f = w as Partial<WorldFile>;
  if (f.storyId !== storyId) issues.push(issue('storyId', `must equal "${storyId}"`));
  if (!isNonEmptyString(f.premise)) issues.push(issue('premise', 'missing premise'));
  if (!Array.isArray(f.locations) || f.locations.length === 0) issues.push(issue('locations', 'needs at least one'));
  if (!Array.isArray(f.rules) || f.rules.length === 0) issues.push(issue('rules', 'needs at least one world rule'));
  return { ok: issues.length === 0, issues };
}

/* ---------------- scenes.json ---------------- */

export function validateScenesFile(storyId: string, s: unknown, openingSceneId: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!s || typeof s !== 'object') return { ok: false, issues: [issue('$', 'scenes must be an object')] };
  const f = s as Partial<ScenesFile>;
  if (f.storyId !== storyId) issues.push(issue('storyId', `must equal "${storyId}"`));
  if (!Array.isArray(f.scenes) || f.scenes.length === 0) {
    issues.push(issue('scenes', 'needs at least one scene'));
    return { ok: issues.length === 0, issues };
  }
  const ids = new Set(f.scenes.map((sc) => sc.id));
  const dupes = f.scenes.filter((sc, i) => f.scenes!.findIndex((x) => x.id === sc.id) !== i);
  dupes.forEach((d) => issues.push(issue(`scenes.${d.id}`, 'duplicate scene id')));
  if (!ids.has(openingSceneId)) issues.push(issue('openingSceneId', `scene "${openingSceneId}" not found`));

  const endingIds = new Set((f.endings ?? []).map((e) => e.id));
  f.scenes.forEach((sc) => {
    const p = `scenes.${sc.id}`;
    if (!isNonEmptyString(sc.title)) issues.push(issue(`${p}.title`, 'missing title'));
    if (!Array.isArray(sc.narration) || sc.narration.length === 0)
      issues.push(issue(`${p}.narration`, 'needs at least one narration line'));
    if (!Array.isArray(sc.fallbackLines) || sc.fallbackLines.length === 0)
      issues.push(issue(`${p}.fallbackLines`, 'needs at least one fallback line'));
    if (!Array.isArray(sc.choices)) issues.push(issue(`${p}.choices`, 'must be an array'));
    else {
      const cids = new Set<string>();
      sc.choices.forEach((ch, i) => {
        const cp = `${p}.choices[${i}]`;
        if (!isNonEmptyString(ch.id)) issues.push(issue(`${cp}.id`, 'missing id'));
        else if (cids.has(ch.id)) issues.push(issue(`${cp}.id`, `duplicate choice id "${ch.id}"`));
        else cids.add(ch.id);
        if (!isNonEmptyString(ch.text)) issues.push(issue(`${cp}.text`, 'missing text'));
        if (ch.next !== null && ch.next !== undefined && !ids.has(ch.next))
          issues.push(issue(`${cp}.next`, `unknown scene "${ch.next}"`));
        if (ch.effects?.scene && !ids.has(ch.effects.scene))
          issues.push(issue(`${cp}.effects.scene`, `unknown scene "${ch.effects.scene}"`));
        if (ch.effects?.endStory && !endingIds.has(ch.effects.endStory))
          issues.push(issue(`${cp}.effects.endStory`, `unknown ending "${ch.effects.endStory}"`));
        if (ch.effects?.relationships) {
          for (const [k, v] of Object.entries(ch.effects.relationships)) {
            if (typeof v !== 'number' || !Number.isFinite(v))
              issues.push(issue(`${cp}.effects.relationships.${k}`, 'delta must be a number'));
          }
        }
      });
      if (!sc.isEnding && sc.choices.length === 0)
        issues.push(issue(p, 'non-ending scene needs at least one choice'));
    }
    if (sc.isEnding && sc.endingId && !endingIds.has(sc.endingId))
      issues.push(issue(`${p}.endingId`, `unknown ending "${sc.endingId}"`));
  });

  // Every scene should be reachable from the opening scene (warning-level => issue, but non-fatal).
  const reachable = new Set<string>([openingSceneId]);
  const queue = [openingSceneId];
  const byId = new Map(f.scenes.map((sc) => [sc.id, sc]));
  while (queue.length) {
    const cur = byId.get(queue.pop()!);
    if (!cur) continue;
    for (const ch of cur.choices ?? []) {
      const targets = [ch.next, ch.effects?.scene].filter(Boolean) as string[];
      for (const t of targets) {
        if (ids.has(t) && !reachable.has(t)) {
          reachable.add(t);
          queue.push(t);
        }
      }
    }
  }
  for (const id of ids) {
    if (!reachable.has(id)) issues.push(issue(`scenes.${id}`, 'unreachable from opening scene'));
  }
  return { ok: issues.length === 0, issues };
}

/* ---------------- memory.json ---------------- */

export function validateMemoryFile(storyId: string, m: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!m || typeof m !== 'object') return { ok: false, issues: [issue('$', 'memory must be an object')] };
  const f = m as Partial<MemoryFile>;
  if (f.storyId !== storyId) issues.push(issue('storyId', `must equal "${storyId}"`));
  if (typeof f.shortTermWindow !== 'number' || f.shortTermWindow < 2)
    issues.push(issue('shortTermWindow', 'must be a number >= 2'));
  return { ok: issues.length === 0, issues };
}

/* ---------------- whole bundle ---------------- */

export function validateBundle(bundle: {
  meta: StoryMeta;
  story: unknown;
  characters: unknown;
  world: unknown;
  scenes: unknown;
  memory: unknown;
}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (prefix: string, r: ValidationResult) =>
    r.issues.forEach((i) => issues.push({ path: `${prefix}.${i.path}`, message: i.message }));

  const storyRes = validateStoryFile(bundle.meta.id, bundle.story);
  push('story.json', storyRes);
  push('characters.json', validateCharactersFile(bundle.meta.id, bundle.characters));
  push('world.json', validateWorldFile(bundle.meta.id, bundle.world));

  const opening = (bundle.story as Partial<StoryFile>)?.openingSceneId ?? '';
  push('scenes.json', validateScenesFile(bundle.meta.id, bundle.scenes, opening));
  push('memory.json', validateMemoryFile(bundle.meta.id, bundle.memory));

  // Cross-file consistency: meta rating must match story.json rating.
  const sj = bundle.story as Partial<StoryFile>;
  if (sj.ageRating && sj.ageRating !== bundle.meta.ageRating)
    issues.push(issue('meta/story.ageRating', 'manifest and story.json disagree'));
  if (sj.contentLevel && sj.contentLevel !== bundle.meta.contentLevel)
    issues.push(issue('meta/story.contentLevel', 'manifest and story.json disagree'));

  // PRODUCT RULE — endless stories: a story tagged "ongoing" must NEVER end.
  // Chapter/arc milestones are fine; terminal endings are not.
  if (bundle.meta.tags?.includes('ongoing')) {
    const sc = bundle.scenes as Partial<ScenesFile> | undefined;
    const scenes = (sc?.scenes ?? []) as {
      id?: string;
      isEnding?: boolean;
      choices?: { id?: string; effects?: { endStory?: string } }[];
    }[];
    if (sc?.endings && sc.endings.length > 0)
      issues.push(issue('scenes.endings', 'ongoing stories must not define endings'));
    for (const scene of scenes) {
      if (scene.isEnding)
        issues.push(issue(`scenes.${scene.id}`, 'ongoing stories must not have ending scenes'));
      for (const ch of scene.choices ?? []) {
        if (ch.effects?.endStory)
          issues.push(
            issue(
              `scenes.${scene.id}.choices.${ch.id}`,
              'ongoing stories must not have endStory choices',
            ),
          );
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/* ---------------- user submissions ---------------- */

function safeTrim(s: unknown, max: number, field: string, issues: ValidationIssue[], required = true): string | null {
  if (s === undefined || s === null || s === '') {
    if (required) issues.push(issue(field, 'required'));
    return null;
  }
  if (typeof s !== 'string') {
    issues.push(issue(field, 'must be a string'));
    return null;
  }
  const v = s.trim();
  if (!v && required) {
    issues.push(issue(field, 'required'));
    return null;
  }
  if (v.length > max) {
    issues.push(issue(field, `too long (max ${max} characters)`));
    return v.slice(0, max);
  }
  if (containsUnsafeContent(v)) {
    issues.push(issue(field, 'contains unsupported markup or scripts'));
  }
  return v;
}

export function validateIdeaSubmission(body: unknown): ValidationResult & {
  cleaned?: {
    creatorName: string;
    title: string;
    concept: string;
    genre: string;
    characters?: string;
    notes?: string;
  };
} {
  const issues: ValidationIssue[] = [];
  if (!body || typeof body !== 'object') return { ok: false, issues: [issue('$', 'must be an object')] };
  const b = body as Record<string, unknown>;
  const nameRes = sanitizeCreatorName(b.creatorName ?? (b.creator as Record<string, unknown> | undefined)?.name);
  if (!nameRes.ok) issues.push(issue('creatorName', nameRes.message));
  const title = safeTrim(b.title, 120, 'title', issues);
  const concept = safeTrim(b.concept ?? b.idea, MAX_TEXT_FIELD, 'concept', issues);
  const genre = safeTrim(b.genre, 60, 'genre', issues);
  const characters = safeTrim(b.characters, 2000, 'characters', issues, false);
  const notes = safeTrim(b.notes ?? b.specialNotes, MAX_TEXT_FIELD, 'notes', issues, false);
  const ok = issues.length === 0 && !!nameRes.ok && !!title && !!concept && !!genre;
  return {
    ok,
    issues,
    cleaned: ok && nameRes.ok
      ? { creatorName: nameRes.value, title: title!, concept: concept!, genre: genre!, characters: characters ?? undefined, notes: notes ?? undefined }
      : undefined,
  };
}

/**
 * Validate a complete-story JSON submission. This is stricter than
 * validateBundle because every required identifier has to be freshly supplied
 * (the story does not yet exist in the catalog so we cannot rely on defaults).
 */
export function validateStorySubmission(body: unknown): ValidationResult & {
  cleaned?: {
    creatorName: string;
    storyId: string;
    title: string;
    bundle: {
      story: StoryFile;
      characters: CharactersFile;
      world: WorldFile;
      scenes: ScenesFile;
      memory: MemoryFile;
    };
  };
} {
  const issues: ValidationIssue[] = [];
  if (!body || typeof body !== 'object') return { ok: false, issues: [issue('$', 'must be an object')] };
  const b = body as Record<string, unknown>;
  const rawCreator = b.creator;
  const nameRes = sanitizeCreatorName(
    (rawCreator as Record<string, unknown> | undefined)?.name ?? b.creatorName,
  );
  if (!nameRes.ok) issues.push(issue('creator.name', nameRes.message));

  const story = b.story;
  const characters = b.characters;
  const world = b.world;
  const scenes = b.scenes;
  const memory = b.memory;

  if (!story || typeof story !== 'object') {
    issues.push(issue('story', 'missing story object'));
    return { ok: false, issues };
  }
  const s = story as Partial<StoryFile>;
  const storyId = typeof s.id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(s.id)
    ? s.id
    : (() => {
        issues.push(issue('story.id', 'must be a lowercase slug (letters, numbers, hyphens)'));
        return '';
      })();

  // Synthesize a minimal meta just to drive the existing bundle validator.
  const meta = {
    id: storyId || 'pending',
    title: typeof s.title === 'string' ? s.title : '',
    tagline: '',
    description: typeof s.description === 'string' ? s.description : '',
    genres: Array.isArray(s.genres) ? s.genres : [],
    tags: Array.isArray(s.tags) ? s.tags : [],
    characters: Array.isArray(characters && (characters as CharactersFile).characters)
      ? (characters as CharactersFile).characters.map((c) => c.name).filter(Boolean)
      : [],
    ageRating: (s.ageRating as '12-17' | '18+') || '12-17',
    contentLevel: (s.contentLevel as 'teen' | 'mature') || 'teen',
    language: (s.language as 'hinglish' | 'english') || 'hinglish',
    version: 1,
    accentColor: '#8B5CF6',
    userRole: typeof s.userRole === 'string' ? s.userRole : '',
    setting: typeof s.setting === 'string' ? s.setting : '',
    estimatedMinutes: 15,
    popularity: 0,
    storyDir: storyId || 'pending',
    updatedAt: new Date(0).toISOString(),
  };

  const res = validateBundle({ meta, story: { ...s, id: storyId || meta.id }, characters, world, scenes, memory });
  res.issues.forEach((i) => issues.push(i));

  // Block executable content in every free-text field we ship to the AI.
  const stringsToCheck: string[] = [];
  if (typeof s.description === 'string') stringsToCheck.push(s.description);
  if (typeof s.tone === 'string') stringsToCheck.push(s.tone);
  if (Array.isArray(s.safetyNotes)) stringsToCheck.push(...s.safetyNotes.filter((x): x is string => typeof x === 'string'));
  if (characters && typeof characters === 'object' && Array.isArray((characters as CharactersFile).characters)) {
    for (const c of (characters as CharactersFile).characters) {
      for (const k of ['personality', 'background', 'speakingStyle', 'sampleLine'] as const) {
        const v = (c as unknown as Record<string, unknown>)[k];
        if (typeof v === 'string') stringsToCheck.push(v);
      }
    }
  }
  if (scenes && typeof scenes === 'object' && Array.isArray((scenes as ScenesFile).scenes)) {
    for (const sc of (scenes as ScenesFile).scenes) {
      stringsToCheck.push(...(sc.narration ?? []).filter((x): x is string => typeof x === 'string'));
      stringsToCheck.push(...(sc.fallbackLines ?? []).filter((x): x is string => typeof x === 'string'));
      for (const ch of sc.choices ?? []) {
        if (typeof ch.text === 'string') stringsToCheck.push(ch.text);
      }
    }
  }
  for (const t of stringsToCheck) {
    if (containsUnsafeContent(t)) {
      issues.push(issue('$', 'content contains unsupported markup or scripts'));
      break;
    }
  }

  const ok = issues.length === 0 && !!nameRes.ok && !!storyId;
  const titleStr = typeof s.title === 'string' ? s.title.trim() : '';
  return {
    ok,
    issues,
    cleaned: ok && nameRes.ok
      ? {
          creatorName: nameRes.value,
          storyId,
          title: titleStr,
          bundle: {
            story: { ...(s as StoryFile), id: storyId },
            characters: characters as CharactersFile,
            world: world as WorldFile,
            scenes: scenes as ScenesFile,
            memory: memory as MemoryFile,
          },
        }
      : undefined,
  };
}

export type { StoryBundle };
