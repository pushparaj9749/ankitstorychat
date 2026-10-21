/**
 * Share text for a story (OS share sheet — nothing goes to our server).
 * The link is the public download page of the latest Kissa release.
 */
import { RELEASES_PAGE } from './links';

export function shareStoryMessage(title: string, tagline?: string | null): string {
  const t = (title ?? '').trim() || 'Kissa';
  const line = (tagline ?? '').trim();
  return [`Kissa par "${t}" khelo — ek interactive kahani jisme faisle tumhare hain.`, line ? `"${line}"` : '', `Download: ${RELEASES_PAGE}`]
    .filter(Boolean)
    .join('\n');
}
