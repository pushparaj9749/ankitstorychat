import { sameRenderProps } from '../src/lib/memoProps';

describe('sameRenderProps (React.memo comparator for cards/icons)', () => {
  const meta = { id: 's1', title: 'Story' };

  test('inline handlers do not force a re-render', () => {
    expect(sameRenderProps({ meta, onPress: () => 1 }, { meta, onPress: () => 2 })).toBe(true);
  });

  test('a changed data prop does re-render', () => {
    expect(sameRenderProps({ meta, rank: 1 }, { meta, rank: 2 })).toBe(false);
    expect(sameRenderProps({ meta }, { meta: { ...meta } })).toBe(false);
  });

  test('style is compared by value, not identity', () => {
    expect(sameRenderProps({ style: [{ width: 10 }, null] }, { style: [{ width: 10 }, null] })).toBe(true);
    expect(sameRenderProps({ style: { width: 10 } }, { style: { width: 12 } })).toBe(false);
  });

  test('added or removed props re-render', () => {
    expect(sameRenderProps<{ a: number; b?: number }>({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
