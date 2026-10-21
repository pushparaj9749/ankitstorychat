/**
 * Opening animation ("the story opens"): it must render the brand, never
 * block the app forever, wait for the app to be ready, and respect
 * "reduce motion".
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import { BootSplash, segment, SPLASH_EXIT_MS, SPLASH_INTRO_MS } from '../src/components/BootSplash';

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
    cfg: unknown = null;
    interpolate(cfg: unknown) {
      const n = new Value(this.v);
      n.cfg = cfg;
      return n;
    }
    setValue(v: number) {
      this.v = v;
    }
  }
  const calls = { timing: [] as { useNativeDriver?: boolean }[], sequence: 0, delay: 0, stagger: 0, spring: 0 };
  const Animated = {
    Value,
    View: el('Animated.View'),
    Text: el('Animated.Text'),
    timing: (_v: unknown, c: { duration?: number; useNativeDriver?: boolean }) => {
      calls.timing.push(c);
      return make(c.duration ?? 300);
    },
    spring: () => {
      calls.spring++;
      return make(500);
    },
    delay: (ms: number) => {
      calls.delay++;
      return make(ms);
    },
    loop: () => make(Infinity),
    sequence: (a: Anim[]) => {
      calls.sequence++;
      return make(a.reduce((s, x) => s + x.ms, 0));
    },
    parallel: (a: Anim[]) => make(Math.max(0, ...a.map((x) => x.ms))),
    stagger: (gap: number, a: Anim[]) => {
      calls.stagger++;
      return make(Math.max(0, ...a.map((x, i) => i * gap + x.ms)));
    },
    multiply: (x: unknown) => x,
    __calls: calls,
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

type Calls = { timing: { useNativeDriver?: boolean }[]; sequence: number; delay: number; stagger: number; spring: number };
const calls = () => (Animated as unknown as { __calls: Calls }).__calls;

test('the intro is ONE native animation — no JS-chained steps that can stall', async () => {
  const c = calls();
  c.timing.length = 0;
  c.sequence = c.delay = c.stagger = c.spring = 0;
  const onDone = jest.fn();
  const tree = await mount(<BootSplash ready onDone={onDone} />);
  await advance(SPLASH_INTRO_MS + SPLASH_EXIT_MS + 200);
  expect(onDone).toHaveBeenCalledTimes(1);
  // Sequence / delay / stagger hand off between steps on the JS thread; when
  // the app is busy mounting, the next step starts late and the logo "atak
  // jata hai". None of them may come back.
  expect(c.sequence + c.delay + c.stagger + c.spring).toBe(0);
  expect(c.timing.length).toBeGreaterThan(0);
  for (const t of c.timing) expect(t.useNativeDriver).toBe(true);
  // Intro clock + exit clock (+ the dust motes' own loops).
  const finite = c.timing.filter((t) => (t as { duration?: number }).duration !== undefined);
  expect(finite.filter((t) => (t as { toValue?: number }).toValue === SPLASH_INTRO_MS)).toHaveLength(1);
  await act(async () => tree.unmount());
});

test('tells the app when the intro has played (so it can mount behind it)', async () => {
  const onIntroDone = jest.fn();
  const tree = await mount(<BootSplash ready={false} onIntroDone={onIntroDone} />);
  await advance(SPLASH_INTRO_MS - 200);
  expect(onIntroDone).not.toHaveBeenCalled();
  await advance(400);
  expect(onIntroDone).toHaveBeenCalledTimes(1);
  await advance(3000);
  expect(onIntroDone).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('a tap during the intro jumps to its end', async () => {
  const onIntroDone = jest.fn();
  const tree = await mount(<BootSplash ready={false} onIntroDone={onIntroDone} />);
  await advance(300);
  const root = tree.root.find((n) => n.props.accessibilityLabel === 'Kissa');
  await act(async () => root.props.onTouchEnd());
  expect(onIntroDone).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('segment(): a clamped, monotonic table that follows the curve', () => {
  const clock = new (Animated.Value as unknown as new (v: number) => { cfg: unknown; interpolate: (c: unknown) => unknown })(0);
  const out = segment(clock as unknown as Animated.Value, 300, 700, (x) => x * x, (p) => 10 - 10 * p, 10) as unknown as {
    cfg: { inputRange: number[]; outputRange: number[]; extrapolate: string };
  };
  const { inputRange, outputRange, extrapolate } = out.cfg;
  expect(extrapolate).toBe('clamp');
  expect(inputRange[0]).toBe(300);
  expect(inputRange[inputRange.length - 1]).toBe(1000);
  for (let i = 1; i < inputRange.length; i++) expect(inputRange[i]).toBeGreaterThan(inputRange[i - 1]);
  expect(outputRange[0]).toBe(10);
  expect(outputRange[outputRange.length - 1]).toBe(0);
  expect(outputRange[5]).toBeCloseTo(7.5, 5); // 10 - 10 * 0.5²
});
