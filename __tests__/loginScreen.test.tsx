/**
 * Renders the redesigned Welcome screen and asserts the two things the device
 * screenshot proved were broken:
 *
 *   1. a credential field is tall enough for its own text (the old style was
 *      22px, so the value was clipped and the box looked empty), and
 *   2. a typed value actually reaches the TextInput (value is bound, not just a
 *      placeholder prop).
 *
 * The repo has no react-native Jest preset (existing .tsx tests mock the
 * primitives), so this renders against a thin host-component mock. It asserts
 * behaviour, not a snapshot, so the layout can keep evolving.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  return {
    StyleSheet: { create: (s: any) => s, absoluteFill: {}, flatten: (s: any) => Object.assign({}, ...[s].flat(9).filter(Boolean)) },
    Animated: { View: el('Animated.View'), spring: () => ({ start: () => {} }), Value: class { constructor(public v: number) {} } },
    ActivityIndicator: el('ActivityIndicator'),
    Image: el('Image'),
    KeyboardAvoidingView: el('KeyboardAvoidingView'),
    Pressable: el('Pressable'),
    ScrollView: el('ScrollView'),
    TextInput: el('TextInput'),
    Text: el('Text'),
    View: el('View'),
    Platform: { OS: 'android' },
  };
});

jest.mock('@react-navigation/native-stack', () => ({}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

const theme = {
  bg: '#0A0B10',
  surface: '#0C0D12',
  surface2: '#14161C',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.045)',
  text: '#F4F5F8',
  textDim: '#A8ACB9',
  textFaint: '#6F7381',
  textMuted: '#454955',
  primary: '#F0567E',
  accent: '#F58AA5',
  gold: '#E2BE7E',
  success: '#5CC995',
  danger: '#F0616F',
};

jest.mock('../src/state/AppContext', () => ({
  useApp: () => ({
    theme,
    uiTemplate: 'noir',
    settings: { contentApiBaseUrl: 'https://example.test/api' },
    account: null,
    profile: { nickname: 'Tester' },
    setAccount: jest.fn(),
    refreshStories: jest.fn(),
  }),
}));

jest.mock('../src/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('Screen', null, children),
}));
jest.mock('../src/components/GradientButton', () => ({
  GradientButton: (p: any) => require('react').createElement('GradientButton', p, p.title),
}));
jest.mock('../src/components/brand', () => ({ KISSA_LOGO: 1 }));
jest.mock('../src/lib/ota', () => ({ scheduleOtaCheck: jest.fn() }));
jest.mock('../src/lib/haptics', () => ({ lightBuzz: jest.fn() }));
jest.mock('../src/lib/account', () => ({
  SUPPORT_EMAIL: 'ytdjbhai34@gmail.com',
  AccountError: class AccountError extends Error {
    code = 'unknown';
  },
  login: jest.fn(),
  signup: jest.fn(),
  validateUsername: () => null,
  validatePassword: () => null,
  cachedAccount: jest.fn(),
}));

import { Login } from '../src/screens/Login';

function render() {
  let tree: any;
  act(() => {
    tree = renderer.create(<Login navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
  });
  return tree as renderer.ReactTestRenderer;
}

const byLabel = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => (n.props as any)?.accessibilityLabel === label && n.type === ('TextInput' as any), {
    deep: true,
  })[0];

const flatStyle = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(9).filter(Boolean)) as any;

test('a credential field is tall enough for its text', () => {
  const tree = render();
  const user = byLabel(tree, 'Username');
  const pass = byLabel(tree, 'Password');
  expect(user).toBeTruthy();
  expect(pass).toBeTruthy();

  for (const node of [user, pass]) {
    const style = flatStyle(node);
    // The old bug: a font-size token (22) used as a height.
    expect(style.height).toBeUndefined();
    expect(style.textAlignVertical).toBe('center');
    expect(style.fontSize).toBeGreaterThanOrEqual(16);

    // The 56px touch target lives on the bordered box that wraps the input.
    let box: any = node.parent;
    let minHeight: number | undefined;
    while (box && minHeight === undefined) {
      minHeight = (flatStyle(box) as any).minHeight;
      box = box.parent;
    }
    expect(minHeight).toBeGreaterThanOrEqual(44);
  }
});

test('typing a username shows up in the field', () => {
  const tree = render();
  act(() => byLabel(tree, 'Username').props.onChangeText('arjun_07'));
  expect(byLabel(tree, 'Username').props.value).toBe('arjun_07');
});

test('characters the backend rejects never reach the field', () => {
  const tree = render();
  act(() => byLabel(tree, 'Username').props.onChangeText('Arjun 07!'));
  expect(byLabel(tree, 'Username').props.value).toBe('arjun07');
});

test('the reveal toggle flips secureTextEntry on the password field', () => {
  const tree = render();
  expect(byLabel(tree, 'Password').props.secureTextEntry).toBe(true);
  const toggle = tree.root.findAll((n) => (n.props as any)?.accessibilityLabel === 'Password dikhao')[0];
  expect(toggle).toBeTruthy();
  act(() => toggle.props.onPress());
  expect(byLabel(tree, 'Password').props.secureTextEntry).toBe(false);
});

test('the CTA is disabled until the form is filled', () => {
  const tree = render();
  const cta = () => tree.root.findAll((n) => n.type === ('GradientButton' as any))[0];
  expect(cta().props.disabled).toBe(true);
  act(() => byLabel(tree, 'Username').props.onChangeText('arjun_07'));
  act(() => byLabel(tree, 'Password').props.onChangeText('kissa1234'));
  act(() => byLabel(tree, 'Password dobara').props.onChangeText('kissa1234'));
  expect(cta().props.disabled).toBe(false);
});
