/**
 * App Lock gate (v2.9.0): locks on launch and on return from background,
 * unlocks with the right PIN / fingerprint, keeps the app mounted underneath,
 * never traps the user when no PIN exists, and ignores trips to the file
 * picker / share sheet.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const appStateListeners: ((s: string) => void)[] = [];
jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  const anim = () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined });
  class Value {
    constructor(public v: number) {}
    setValue() {}
  }
  return {
    StyleSheet: { create: (s: any) => s, absoluteFill: {}, hairlineWidth: 1 },
    View: el('View'),
    Text: el('Text'),
    Image: el('Image'),
    Pressable: el('Pressable'),
    Animated: { Value, View: el('Animated.View'), timing: anim, sequence: anim },
    Alert: { alert: jest.fn() },
    AppState: {
      currentState: 'active',
      addEventListener: (_e: string, fn: (s: string) => void) => {
        appStateListeners.push(fn);
        return { remove: () => appStateListeners.splice(appStateListeners.indexOf(fn), 1) };
      },
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/components/brand', () => ({ KISSA_LOGO: 1 }));
jest.mock('../src/lib/haptics', () => ({ tapTick: jest.fn(), lightBuzz: jest.fn(), successBuzz: jest.fn(), mediumBuzz: jest.fn() }));

const secure = new Map<string, string>();
const kv = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x',
  getItemAsync: async (k: string) => secure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void secure.set(k, v),
  deleteItemAsync: async (k: string) => void secure.delete(k),
}));
jest.mock('../src/lib/db', () => ({
  kvGet: async (k: string) => kv.get(k) ?? null,
  kvSet: async (k: string, v: string) => void kv.set(k, v),
  kvDelete: async (k: string) => void kv.delete(k),
}));
const auth = jest.fn(async (_o?: unknown) => ({ success: false }));
let enrolled = false;
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => enrolled,
  getEnrolledLevelAsync: async () => (enrolled ? 3 : 1),
  supportedAuthenticationTypesAsync: async () => [1],
  authenticateAsync: (o: unknown) => auth(o),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

const settings: Record<string, unknown> = {};
const updateSettings = jest.fn(async (p: Record<string, unknown>) => void Object.assign(settings, p));
jest.mock('../src/state/AppContext', () => ({
  useApp: () => ({
    theme: {
      text: '#fff', textDim: '#aaa', textFaint: '#777', accent: '#f8a', danger: '#f66',
      surface2: '#222', border: '#333', bg: '#000',
    },
    settings,
    updateSettings,
  }),
}));

import { AppLockGate } from '../src/components/AppLockGate';
import { savePin } from '../src/lib/appLock';
import { pauseAppLock, resumeAppLock } from '../src/lib/lockPause';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function flush(ms = 30) {
  await act(async () => {
    await sleep(ms);
  });
}

let tree: renderer.ReactTestRenderer;
async function mount() {
  await act(async () => {
    tree = renderer.create(
      <AppLockGate>
        <Child />
      </AppLockGate>,
    );
  });
  await flush();
}
function Child() {
  return React.createElement('Text', { testID: 'the-app' }, 'app');
}
const has = (id: string) => tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string').length > 0;
async function press(id: string) {
  const node = tree.root.find((n) => n.props.testID === id && typeof n.type === 'string');
  await act(async () => {
    node.props.onPress();
  });
}
async function typePin(pin: string) {
  for (const d of pin) await press(`pin-key-${d}`);
  await flush(200);
}
async function setAppState(s: string) {
  await act(async () => {
    appStateListeners.forEach((fn) => fn(s));
  });
}

beforeEach(async () => {
  secure.clear();
  kv.clear();
  resumeAppLock();
  enrolled = false;
  auth.mockReset();
  auth.mockResolvedValue({ success: false });
  updateSettings.mockClear();
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, { appLockEnabled: true, appLockBiometric: true, appLockDelay: 'immediate', haptics: false });
  await savePin('2580');
});
afterEach(() => {
  act(() => tree?.unmount());
});

test('locks on launch, keeps the app mounted underneath, unlocks with the right PIN', async () => {
  await mount();
  expect(has('app-lock-screen')).toBe(true);
  expect(has('the-app')).toBe(true);
  await typePin('1111');
  expect(has('app-lock-screen')).toBe(true);
  await typePin('2580');
  expect(has('app-lock-screen')).toBe(false);
  expect(has('the-app')).toBe(true);
});

test('does nothing when App Lock is off', async () => {
  settings.appLockEnabled = false;
  await mount();
  expect(has('app-lock-screen')).toBe(false);
  await setAppState('background');
  expect(has('app-lock-cover')).toBe(false);
});

test('hides the app in the background and locks again on return', async () => {
  await mount();
  await typePin('2580');
  expect(has('app-lock-screen')).toBe(false);
  await setAppState('background');
  expect(has('app-lock-cover')).toBe(true);
  await setAppState('active');
  expect(has('app-lock-cover')).toBe(false);
  expect(has('app-lock-screen')).toBe(true);
});

test('a delay lets quick trips out of the app through', async () => {
  settings.appLockDelay = '1m';
  await mount();
  await typePin('2580');
  await setAppState('background');
  await setAppState('active');
  expect(has('app-lock-screen')).toBe(false);
});

test('returning from the file picker / share sheet does not lock', async () => {
  await mount();
  await typePin('2580');
  pauseAppLock();
  await setAppState('background');
  await setAppState('active');
  expect(has('app-lock-screen')).toBe(false);
  expect(has('app-lock-cover')).toBe(false);
});

test('never traps the user: lock on but no PIN stored → lock switches itself off', async () => {
  secure.clear();
  await mount();
  expect(updateSettings).toHaveBeenCalledWith({ appLockEnabled: false });
  expect(has('app-lock-screen')).toBe(false);
});

test('offers the fingerprint prompt by itself and unlocks on success', async () => {
  enrolled = true;
  auth.mockResolvedValue({ success: true });
  await mount();
  await flush(500);
  expect(auth).toHaveBeenCalled();
  expect(auth.mock.calls[0][0]).toMatchObject({ disableDeviceFallback: true });
  expect(has('app-lock-screen')).toBe(false);
});

test('no fingerprint key when the user turned fingerprint off', async () => {
  enrolled = true;
  settings.appLockBiometric = false;
  await mount();
  await flush(500);
  expect(auth).not.toHaveBeenCalled();
  expect(has('pin-key-left')).toBe(false);
});
