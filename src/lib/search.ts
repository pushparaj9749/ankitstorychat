/** Local story search — title, description, genre, tags, characters. */
import type { StoryMeta } from '../types';
import { norm } from './utils';

export interface SearchHit {
  meta: StoryMeta;
  score: number;
}

export function searchStories(stories: StoryMeta[], query: string): SearchHit[] {
  const q = norm(query);
  if (!q) return stories.map((meta) => ({ meta, score: 0 }));
  const words = q.split(' ').filter((w) => w.length >= 2);

  const hits: SearchHit[] = [];
  for (const meta of stories) {
    const title = norm(meta.title);
    const desc = norm(meta.description);
    const genres = meta.genres.map(norm).join(' ');
    const tags = meta.tags.map(norm).join(' ');
    const chars = (meta.characters ?? []).map(norm).join(' ');
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 10;
      if (chars.includes(w)) score += 6;
      if (genres.includes(w)) score += 5;
      if (tags.includes(w)) score += 4;
      if (desc.includes(w)) score += 2;
    }
    // Prefix bonus on title.
    if (title.startsWith(q)) score += 8;
    if (score > 0) hits.push({ meta, score });
  }
  hits.sort((a, b) => b.score - a.score || b.meta.popularity - a.meta.popularity);
  return hits;
}
