/**
 * Age-based content gating — enforced in application logic, not just UI.
 * Every story surface (home, discover, search, recommendations, trending,
 * categories, downloads, direct open) must pass through these helpers.
 */
import type { AgeGroup, StoryMeta } from '../types';

/** Rankings: a user may access stories at or below their level. */
const LEVEL: Record<string, number> = {
  '12-17': 0,
  teen: 0,
  '18+': 1,
  mature: 1,
};

/**
 * True when `ageGroup` is allowed to access a story with the given rating.
 * Unknown / malformed ratings default to RESTRICTED (fail closed).
 */
export function canAccess(
  ageGroup: AgeGroup,
  ageRating: string,
  contentLevel: string,
): boolean {
  const userLevel = LEVEL[ageGroup];
  const storyLevel = Math.max(
    LEVEL[ageRating] ?? Number.POSITIVE_INFINITY,
    LEVEL[contentLevel] ?? Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(storyLevel) || userLevel === undefined) return false;
  return storyLevel <= userLevel;
}

/** Filter any story list down to what the age group may see. */
export function filterForAge<T extends Pick<StoryMeta, 'ageRating' | 'contentLevel'>>(
  items: T[],
  ageGroup: AgeGroup,
): T[] {
  return items.filter((s) => canAccess(ageGroup, s.ageRating, s.contentLevel));
}

/** Guard a direct story open (deep link / internal id). Throws when blocked. */
export class AgeRestrictedError extends Error {
  constructor(readonly storyId: string) {
    super(`Story "${storyId}" is restricted for your age group.`);
    this.name = 'AgeRestrictedError';
  }
}

export function assertCanOpen(
  meta: Pick<StoryMeta, 'id' | 'ageRating' | 'contentLevel'>,
  ageGroup: AgeGroup,
): void {
  if (!canAccess(ageGroup, meta.ageRating, meta.contentLevel)) {
    throw new AgeRestrictedError(meta.id);
  }
}

/** Human label for the rating badge. */
export function ratingLabel(meta: Pick<StoryMeta, 'ageRating'>): string {
  return meta.ageRating === '18+' ? '18+' : '12+';
}

/** Extra safety guidance injected into the AI narrator prompt for teens. */
export function teenSafetyGuidance(): string {
  return [
    'The reader is aged 12-17.',
    'Keep romance light and innocent (crushes, hand-holding at most).',
    'No gore, no graphic violence, no horror designed to traumatize.',
    'No sexual content, no explicit language, no drug glorification.',
    'Dark themes must stay hopeful overall and resolve positively.',
    'Encourage kindness, courage, and asking trusted adults for help in real danger.',
  ].join('\n');
}
