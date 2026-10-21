/**
 * Opening animation must stay smooth: the app may only mount BEHIND the
 * splash once the intro has played (mounting during it made the intro
 * stutter), and the splash may only open once that first screen is drawn.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  return { StyleSheet: { create: (s: any) => s }, View: el('View'), Text: el('Text') };
});

const splashProps: { current: any } = { current: null };
jest.mock('../src/components/BootSplash', () => ({
  SPLASH_INTRO_MS: 1810,
  BootSplash: (p: any) => {
    splashProps.current = p;
    return null;
  },
}));

jest.mock('../src/lib/db', () => ({
  addFavorite: jest.fn(),
  getProfile: jest.fn(async () => null),
  getSettings: jest.fn(async () => ({ theme: 'midnight', uiTemplate: 'noir', activeProviderId: null })),
  isFavorite: jest.fn(async () => false),
  listFavorites: jest.fn(async () => []),
  listProviders: jest.fn(async () => []),
  listRecentPlaythroughs: jest.fn(async () => []),
  removeFavorite: jest.fn(),
  saveProfile: jest.fn(),
  updateSettings: jest.fn(),
}));
jest.mock('../src/content/loader', () => ({ listStories: jest.fn(async () => []) }));
jest.mock('../src/lib/secureKeys', () => ({ hasApiKey: jest.fn(async () => false) }));

import { AppProvider } from '../src/state/AppContext';

beforeEach(() => {
  jest.useFakeTimers();
  splashProps.current = null;
});
afterEach(() => jest.useRealTimers());

const Child = () => React.createElement('Text', null, 'HOME');
const homeMounted = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => (n.type as unknown) === Child).length > 0;

const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

test('app mounts only after the intro, splash opens only after it is drawn', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppProvider>
        <Child />
      </AppProvider>,
    );
  });
  await flush(50); // local database loaded
  expect(homeMounted(tree)).toBe(false); // still in the intro
  expect(splashProps.current.ready).toBe(false);

  await act(async () => splashProps.current.onIntroDone());
  expect(homeMounted(tree)).toBe(true); // mounts behind the finished splash
  expect(splashProps.current.ready).toBe(false); // not drawn yet

  await flush(40); // two frames
  expect(splashProps.current.ready).toBe(true);

  await act(async () => splashProps.current.onDone());
  expect(splashProps.current).not.toBeNull();
  await act(async () => tree.unmount());
});

test('safety net: the app never waits forever for the intro', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppProvider>
        <Child />
      </AppProvider>,
    );
  });
  await flush(50);
  expect(homeMounted(tree)).toBe(false);
  await flush(3500);
  expect(homeMounted(tree)).toBe(true);
  await act(async () => tree.unmount());
});
