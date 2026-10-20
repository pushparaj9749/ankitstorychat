/**
 * Opening animation ("the story opens"): it must render the brand, never
 * block the app forever, wait for the app to be ready, and respect
 * "reduce motion".
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { BootSplash, SPLASH_EXIT_MS, SPLASH_INTRO_MS } from '../src/components/BootSplash';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Minimal react-native mock with a timing-faithful Animated: each composite
 * reports its real duration and completes via setTimeout, so fake timers can
 * check WHEN the splash opens (loops never complete, like the real ones).
 */
jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  type Anim = { ms: number; start: (cb?: (r: { finished: boolean }) => void) => void; stop: () => void };
  const make = (ms: number): Anim => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return {
      ms,
      start: (cb) => {
        if (!Number.isFinite(ms)) return;
        t = setTimeout(() => cb?.({ finished: true }), ms);
      },
      stop: () => {
        if (t) clearTimeout(t);
      },
    };
  };
  class Value {
    constructor(public v: number) {}
    interpolate() {
      return this;
    }
  }
  const Animated = {
    Value,
    View: el('Animated.View'),
    Text: el('Animated.Text'),
    timing: (_v: unknown, c: { duration?: number }) => make(c.duration ?? 300),
    spring: () => make(500),
    delay: (ms: number) => make(ms),
    loop: () => make(Infinity),
    sequence: (a: Anim[]) => make(a.reduce((s, x) => s + x.ms, 0)),
    parallel: (a: Anim[]) => make(Math.max(0, ...a.map((x) => x.ms))),
    stagger: (gap: number, a: Anim[]) => make(Math.max(0, ...a.map((x, i) => i * gap + x.ms))),
  };
  const id = (x: unknown) => x;
  return {
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s, absoluteFill: {} },
    View: el('View'),
    Text: el('Text'),
    Image: el('Image'),
    Animated,
    Easing: { linear: id, quad: id, cubic: id, in: id, out: id, inOut: id },
    AccessibilityInfo: { isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)) },
    useWindowDimensions: () => ({ width: 400, height: 860 }),
  };
});

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('../src/components/brand', () => ({ KISSA_LOGO: 1 }));

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.resolve(false));
});

async function mount(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
  });
  return tree;
}

/** Step time in small slices so effects scheduled by state updates also run. */
const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(50, ms - t));
    });
  }
};

test('shows the KISSA wordmark and the Hinglish tagline', async () => {
  const tree = await mount(<BootSplash ready={false} />);
  const text = tree.root
    .findAll((n) => typeof n.type === 'string' && n.type.endsWith('Text'))
    .map((t) => String(t.props.children))
    .join(' ');
  for (const ch of 'KISSA') expect(text).toContain(ch);
  expect(text).toContain('TUMHARI');
  expect(text).toContain('FAISLE');
  tree.unmount();
});

test('opens onto the app once it is ready, after the intro', async () => {
    const onDone = jest.fn();
  const tree = await mount(<BootSplash ready onDone={onDone} />);
  await advance(SPLASH_INTRO_MS - 400);
  expect(onDone).not.toHaveBeenCalled();
  await advance(SPLASH_EXIT_MS + 2000);
  expect(onDone).toHaveBeenCalledTimes(1);
  tree.unmount();
});

test('never opens while the app is still loading', async () => {
  const onDone = jest.fn();
  const tree = await mount(<BootSplash ready={false} onDone={onDone} />);
  await advance(6000);
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => tree.update(<BootSplash ready onDone={onDone} />));
  await advance(SPLASH_EXIT_MS + 500);
  expect(onDone).toHaveBeenCalledTimes(1);
  tree.unmount();
});

test('reduce motion: a short calm fade', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.resolve(true));
  const onDone = jest.fn();
  const tree = await mount(<BootSplash ready onDone={onDone} />);
  await advance(900);
  expect(onDone).toHaveBeenCalledTimes(1);
  tree.unmount();
});
