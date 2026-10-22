/**
 * Story-creator avatars (v2.10.2) — pure resolution logic (unit-tested).
 *
 * - The Kissa owner (Ankit, verified) has an avatar bundled in the APK, so
 *   every owner story shows it with no network and no package change.
 * - Any other creator may get a story-local avatar file set by the Kissa
 *   team at publish time: `creator.avatar = "assets/creator.jpg"`, served by
 *   the story API next to the cover. ONLY that exact relative shape is
 *   accepted — never an arbitrary URL (no third-party tracking images) and
 *   never for community stories (their creator data comes from user input).
 * - Anything else falls back to the name's first letter.
 */
import type { StoryCreator } from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { joinUrl } from './utils';

export const CREATOR_AVATAR_FILE_RE = /^assets\/creator\.(?:jpg|jpeg|png|webp)$/;

export type CreatorAvatarSource = { kind: 'owner' } | { kind: 'remote'; uri: string } | { kind: 'initial'; letter: string };

export function isOwnerCreator(creator: Pick<StoryCreator, 'name' | 'verified'> | null | undefined): boolean {
  return !!creator && creator.verified === true && (creator.name ?? '').trim() === KISSA_OWNER_CREATOR.name;
}

export function resolveCreatorAvatar(
  creator: StoryCreator | null | undefined,
  storyDir: string | null | undefined,
  apiBase: string,
): CreatorAvatarSource {
  const name = (creator?.name ?? '').trim() || KISSA_OWNER_CREATOR.name;
  const avatar = typeof creator?.avatar === 'string' ? creator.avatar.trim() : '';
  const officialStory = !!storyDir && !storyDir.startsWith('community/') && /^[a-z0-9][a-z0-9-]{0,63}$/.test(storyDir);
  if (avatar && officialStory && CREATOR_AVATAR_FILE_RE.test(avatar)) {
    // Same URL as content/api mediaApiUrl (kept import-light for the UI).
    return { kind: 'remote', uri: joinUrl(apiBase, `stories/${storyDir}/${avatar}`) };
  }
  if (isOwnerCreator({ name, verified: creator ? creator.verified : true })) return { kind: 'owner' };
  return { kind: 'initial', letter: name[0]?.toUpperCase() ?? '?' };
}
