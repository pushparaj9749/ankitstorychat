import { AgeRestrictedError, assertCanOpen, canAccess, filterForAge } from '../src/lib/ageGate';

describe('age gate', () => {
  test('teens can access teen stories only', () => {
    expect(canAccess('12-17', '12-17', 'teen')).toBe(true);
    expect(canAccess('12-17', '18+', 'mature')).toBe(false);
    expect(canAccess('12-17', '12-17', 'mature')).toBe(false);
    expect(canAccess('12-17', '18+', 'teen')).toBe(false);
  });

  test('adults can access everything rated', () => {
    expect(canAccess('18+', '12-17', 'teen')).toBe(true);
    expect(canAccess('18+', '18+', 'mature')).toBe(true);
  });

  test('unknown ratings fail closed', () => {
    expect(canAccess('18+', '21+', 'mature')).toBe(false);
    expect(canAccess('18+', '18+', 'explicit')).toBe(false);
    expect(canAccess('12-17', '', '')).toBe(false);
  });

  test('filterForAge removes restricted stories', () => {
    const list = [
      { id: 'a', ageRating: '12-17', contentLevel: 'teen' },
      { id: 'b', ageRating: '18+', contentLevel: 'mature' },
    ] as const;
    expect(filterForAge([...list], '12-17').map((s) => s.id)).toEqual(['a']);
    expect(filterForAge([...list], '18+').map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('assertCanOpen throws AgeRestrictedError on direct open', () => {
    expect(() =>
      assertCanOpen({ id: 'x', ageRating: '18+', contentLevel: 'mature' }, '12-17'),
    ).toThrow(AgeRestrictedError);
    expect(() =>
      assertCanOpen({ id: 'x', ageRating: '12-17', contentLevel: 'teen' }, '12-17'),
    ).not.toThrow();
  });
});
