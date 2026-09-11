import { searchStories } from '../src/lib/search';
import type { StoryMeta } from '../src/types';

const stories = [
  {
    id: 'a',
    title: 'Midnight Local',
    description: 'Mumbai train mystery',
    genres: ['Mystery'],
    tags: ['train'],
    characters: ['Aarohi'],
    popularity: 90,
  },
  {
    id: 'b',
    title: 'Space Dosti',
    description: 'Aliens and chai',
    genres: ['Sci-Fi'],
    tags: ['space'],
    characters: ['Zoya'],
    popularity: 80,
  },
] as StoryMeta[];

describe('searchStories', () => {
  test('finds by title, genre, character', () => {
    expect(searchStories(stories, 'midnight')[0].meta.id).toBe('a');
    expect(searchStories(stories, 'sci-fi')[0].meta.id).toBe('b');
    expect(searchStories(stories, 'aarohi')[0].meta.id).toBe('a');
    expect(searchStories(stories, 'chai')[0].meta.id).toBe('b');
  });
  test('empty query returns all, nonsense returns none', () => {
    expect(searchStories(stories, '')).toHaveLength(2);
    expect(searchStories(stories, 'zzzqqq')).toHaveLength(0);
  });
});
