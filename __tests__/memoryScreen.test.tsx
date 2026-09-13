/**
 * The memory viewer screen is the reader's only window into (and control over)
 * what the app stores, so it is rendered for real here: sections, the folded
 * rows, and every action button must hit the right memory/db call.
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { COLORS } from '../src/theme';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let lastAlert: { title: string; buttons: any[] } | null = null;
const tapDestructive = true;

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  return {
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
    View: el('View'),
    Text: el('Text'),
    Pressable: el('Pressable'),
    ScrollView: el('ScrollView'),
    ActivityIndicator: el('ActivityIndicator'),
    StatusBar: el('StatusBar'),
    Alert: {
      alert: (title: string, _body: string, buttons: any[]) => {
        (globalThis as any).__lastAlert = { title, buttons };
        if (tapDestructive) buttons?.find((b) => b.style === 'destructive')?.onPress?.();
      },
    },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  return { SafeAreaView: (p: any) => R.createElement('SafeAreaView', p, p.children) };
});
jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  return { LinearGradient: (p: any) => R.createElement('LinearGradient', p, p.children) };
});
jest.mock('../src/state/AppContext', () => {
  const { COLORS: C } = require('../src/theme');
  return { useApp: () => ({ theme: C.midnight }) };
});

const live = [
  {
    id: 'mem_fact',
    playthroughId: 'pt1',
    kind: 'story' as const,
    text: 'Raj ne Maaya se wada kiya ki play nahi chhodunga',
    importance: 9,
    createdAt: '2026-05-01T00:00:00.000Z',
    hits: 12,
    archived: false,
  },
  {
    id: 'mem_log',
    playthroughId: 'pt1',
    kind: 'episode' as const,
    text: 'U: main thaka hoon | Myra: "Ek din aur."',
    importance: 1,
    createdAt: '2026-05-02T00:00:00.000Z',
    hits: 0,
    archived: false,
  },
];
const folded = [
  {
    id: 'mem_old',
    playthroughId: 'pt1',
    kind: 'episode' as const,
    text: 'U: pehla din | Narrator ne club dikhaya',
    importance: 1,
    createdAt: '2026-04-01T00:00:00.000Z',
    hits: 0,
    archived: true,
  },
];
const readerPrefs = [
  {
    id: 'mem_pref',
    playthroughId: '*',
    kind: 'preference' as const,
    text: 'User likes chai.',
    importance: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    hits: 1,
    archived: false,
  },
];

const journeyMemoryView: jest.Mock = jest.fn(async () => ({
  live,
  folded,
  readerPrefs,
  summary: '- Raj narrator bana.\n- Finale do din door hai.',
}));
const clearSummary: jest.Mock = jest.fn(async () => undefined);
const pinMemory: jest.Mock = jest.fn(async () => undefined);
const restoreMemory: jest.Mock = jest.fn(async () => undefined);
const deleteMemory: jest.Mock = jest.fn(async () => undefined);
const deleteMemoriesForPlaythrough: jest.Mock = jest.fn(async () => undefined);

jest.mock('../src/lib/memory', () => ({
  journeyMemoryView: (id: string) => journeyMemoryView(id),
  clearSummary: (id: string) => clearSummary(id),
  pinMemory: (id: string) => pinMemory(id),
  restoreMemory: (id: string) => restoreMemory(id),
}));
jest.mock('../src/lib/db', () => ({
  deleteMemory: (id: string) => deleteMemory(id),
  deleteMemoriesForPlaythrough: (id: string) => deleteMemoriesForPlaythrough(id),
}));

import { Memory } from '../src/screens/Memory';

type Node = { type: string; props: any; children: any[] | null };

function walk(node: any, acc: Node[] = []): Node[] {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, acc));
    return acc;
  }
  if (typeof node === 'string') return acc;
  acc.push(node);
  (node.children ?? []).forEach((c: any) => walk(c, acc));
  return acc;
}

const MUTED = ['react-test-renderer is deprecated', 'not configured to support act'];
const realError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && MUTED.some((m) => first.includes(m))) return;
  realError(...args);
};
afterAll(() => {
  console.error = realError;
});

async function renderScreen() {
  let tree: renderer.ReactTestRenderer | null = null;
  await renderer.act(async () => {
    tree = renderer.create(
      <Memory
        navigation={{ goBack: jest.fn(), addListener: () => () => undefined } as any}
        route={{ key: 'm', name: 'Memory', params: { playthroughId: 'pt1', storyTitle: 'Chai Dreams' } }}
      />,
    );
  });
  return tree!.toJSON() as unknown as Node;
}

function textOf(node: Node): string[] {
  return walk(node)
    .filter((n) => n.type === 'Text')
    .map((n) => {
      const c = n.children ?? [];
      return c.map((x: any) => (typeof x === 'string' ? x : '')).join('');
    });
}

function pressable(node: Node, label: string): Node | undefined {
  return walk(node).find((n) => n.type === 'Pressable' && n.props?.accessibilityLabel === label);
}

/** Any pressable whose rendered text contains `needle` (links have no a11y label). */
function pressableText(node: Node, needle: string): Node | undefined {
  return walk(node)
    .filter((n) => typeof n.props?.onPress === 'function')
    .find((n) =>
      walk(n)
        .filter((c) => c.type === 'Text')
        .some((c) => (c.children ?? []).join('').includes(needle)),
    );
}

beforeEach(() => {
  jest.clearAllMocks();
  lastAlert = null;
  (globalThis as any).__lastAlert = null;
});

describe('memory viewer', () => {
  test('shows the digest, live facts, the turn log and reader prefs', async () => {
    const ui = await renderScreen();
    const t = textOf(ui);
    expect(journeyMemoryView).toHaveBeenCalledWith('pt1');
    expect(t.join('\n')).toContain('Chai Dreams');
    expect(t).toContain('Raj ne Maaya se wada kiya ki play nahi chhodunga');
    expect(t).toContain('- Raj narrator bana.\n- Finale do din door hai.');
    expect(t).toContain('User likes chai.');
    expect(t.join('\n')).toContain('📘 kahani');
    expect(t.join('\n')).toContain('🧾 turn log');
    expect(t.join('\n')).toContain('★9'); // pinned strength is visible
    expect(t.join('\n')).toContain('· 12×'); // reinforcement count is visible
  });

  test('folded rows are offered for restore, not hidden away', async () => {
    const ui = await renderScreen();
    const t = textOf(ui);
    expect(t.join('\n')).toContain('Digest me fold hue (1)');
    expect(t).toContain('U: pehla din | Narrator ne club dikhaya');
    const restore = pressable(ui, 'Wapas laao');
    expect(restore).toBeTruthy();
    await renderer.act(async () => {
      restore!.props.onPress();
    });
    expect(restoreMemory).toHaveBeenCalledWith('mem_old');
  });

  test('forget asks first, then deletes only that one row', async () => {
    const ui = await renderScreen();
    const forget = pressable(ui, 'Bhool jao')!;
    expect(forget).toBeTruthy();
    await renderer.act(async () => {
      forget.props.onPress();
    });
    lastAlert = (globalThis as any).__lastAlert;
    expect(lastAlert?.title).toBe('Ye bhool jao?');
    expect(deleteMemory).toHaveBeenCalledWith('mem_fact');
    expect(journeyMemoryView).toHaveBeenCalledTimes(2); // reloaded after the change
  });

  test('pin pushes a fact to the top of recall', async () => {
    const ui = await renderScreen();
    const pin = pressable(ui, 'Yaad rakhna strong karo')!;
    await renderer.act(async () => {
      pin.props.onPress();
    });
    expect(pinMemory).toHaveBeenCalledWith('mem_fact');
  });

  test('clearing the digest is one tap, no dialog', async () => {
    const ui = await renderScreen();
    const link = pressableText(ui, 'Digest clear karo');
    expect(link).toBeTruthy();
    await renderer.act(async () => {
      link!.props.onPress();
    });
    expect(clearSummary).toHaveBeenCalledWith('pt1');
  });

  test('forget-everything needs a confirmation and keeps the chat', async () => {
    const ui = await renderScreen();
    const btn = pressableText(ui, 'Poori journey ki memory bhool jao')!;
    await renderer.act(async () => {
      btn.props.onPress();
    });
    lastAlert = (globalThis as any).__lastAlert;
    expect(lastAlert?.title).toBe('Poori journey ki memory bhool jao?');
    expect(lastAlert?.buttons.map((b: any) => b.text)).toEqual(['Cancel', 'Forget everything']);
    expect(deleteMemoriesForPlaythrough).toHaveBeenCalledWith('pt1');
    expect(clearSummary).toHaveBeenCalledWith('pt1');
  });

  test('empty journey still renders the explanation, no dead buttons', async () => {
    journeyMemoryView.mockImplementationOnce(async () => ({ live: [], folded: [], readerPrefs: [], summary: '' }));
    const ui = await renderScreen();
    const t = textOf(ui);
    expect(t.join('\n')).toContain('Koi curated fact nahi');
    expect(t.join('\n')).toContain('Abhi tak kuch fold nahi hua');
    expect(t.join('\n')).not.toContain('🗑 Poori journey ki memory bhool jao');
  });
});
