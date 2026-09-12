/**
 * Renders the REAL ChatBubble / ChoiceChips components (react-test-renderer)
 * with a stubbed react-native, so the shipped chat UI is what gets asserted:
 *
 *  1. opening narration sits in the SAME bubble as the dialogue below it
 *  2. *action* spans render faded + italic, spoken dialogue stays full strength
 *  3. "✦ Scene" markers stay chapter dividers, not story bubbles
 */
import React from 'react';
import renderer from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  class Value {
    v: number;
    constructor(v: number) {
      this.v = v;
    }
    interpolate() {
      return 0;
    }
  }
  return {
    StyleSheet: { create: (s: any) => s },
    View: el('View'),
    Text: el('Text'),
    Pressable: el('Pressable'),
    Animated: {
      Value,
      View: el('AnimatedView'),
      loop: () => ({ start: () => undefined, stop: () => undefined }),
      sequence: () => ({}),
      timing: () => ({}),
    },
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => require('react').createElement('LinearGradient', props, props.children),
}));

jest.mock('../src/state/AppContext', () => {
  const { COLORS } = require('../src/theme');
  return { useApp: () => ({ theme: COLORS.midnight, settings: { textSize: 'medium' } }) };
});

import { ChatBubble, ChoiceChips } from '../src/components/chat';
import type { ChatMessage } from '../src/types';
import { COLORS, FADED_TEXT_OPACITY, withAlpha } from '../src/theme';

type Node = { type: string; props: any; children: any[] | null };

function msg(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    playthroughId: 'pt',
    role: 'narration',
    speaker: null,
    text: '',
    sceneId: 's1',
    createdAt: '2026-09-12T00:00:00.000Z',
    ...partial,
  };
}

function render(el: React.ReactElement): Node {
  let out: renderer.ReactTestRenderer | null = null;
  renderer.act(() => {
    out = renderer.create(el);
  });
  return out!.toJSON() as unknown as Node;
}

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

function texts(node: Node): Node[] {
  return walk(node).filter((n) => n.type === 'Text');
}

function style(node: Node): Record<string, any> {
  const s = node.props.style;
  return Object.assign({}, ...(Array.isArray(s) ? s : [s]).filter(Boolean));
}

/** Structure signature (element types + nesting), ignoring styles/text. */
function shape(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return '#';
  return `${node.type}[${(node.children ?? []).map(shape).join(',')}]`;
}

const theme = COLORS.midnight;

// Two known-noise notices from react-test-renderer 19 on React 19: its own
// deprecation banner and a spurious act() environment warning. Nothing else is muted.
// Installed at module scope because some renders happen while jest collects describes.
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

describe('opening narration matches the dialogue bubbles', () => {
  const narration = render(
    <ChatBubble
      message={msg({
        role: 'narration',
        text: 'Myra ek simple, sweet aur innocent ladki bankar café mein Ankit se milti hai.',
      })}
    />,
  );
  const dialogue = render(
    <ChatBubble message={msg({ role: 'assistant', text: 'Woh cup table par rakh deti hai.' })} />,
  );

  test('narration is wrapped in a chat bubble with the narrator avatar', () => {
    const bubbles = walk(narration).filter(
      (n) => style(n).backgroundColor === theme.surface && style(n).borderColor === theme.border,
    );
    expect(bubbles).toHaveLength(1);
    expect(walk(narration).some((n) => n.type === 'LinearGradient')).toBe(true);
  });

  test('narration and dialogue have an identical layout', () => {
    expect(shape(narration)).toBe(shape(dialogue));
  });

  test('narration text is faded italic, dialogue text is not', () => {
    const narrSpan = texts(narration).find((t) => style(t).fontStyle === 'italic');
    expect(narrSpan).toBeTruthy();
    expect(style(narrSpan!).color).toBe(withAlpha(theme.textDim, FADED_TEXT_OPACITY));
    expect(texts(dialogue).some((t) => style(t).fontStyle === 'italic')).toBe(false);
  });
});

describe('*action* markup inside a dialogue bubble', () => {
  const tree = render(
    <ChatBubble
      message={msg({
        role: 'assistant',
        speaker: 'Myra',
        text: '*Woh halki smile ke saath cup badha deti hai.* "Agar tumhari hai..."',
      })}
    />,
  );

  test('speaker label is shown', () => {
    expect(texts(tree).map((t) => (t.children ?? []).join(''))).toContain('Myra');
  });

  test('only the asterisked part is faded, the spoken part stays bright', () => {
    const all = texts(tree);
    const root = all[0]; // the bubble's <Text>, which carries the base colour
    expect(style(root).color).toBe('#fff');

    const spans = all.slice(1);
    const faded = spans.filter((t) => style(t).fontStyle === 'italic');
    expect(faded).toHaveLength(1);
    expect((faded[0].children ?? []).join('')).toContain('cup badha deti hai');

    const spoken = spans.find((t) =>
      (t.children ?? []).join('').includes('Agar tumhari hai'),
    );
    expect(spoken).toBeTruthy();
    expect(style(spoken!).fontStyle).toBeUndefined(); // inherits the bright base colour
    expect((spoken!.children ?? []).join('')).not.toContain('*');
  });
});

describe('scene markers stay chapter dividers', () => {
  const tree = render(<ChatBubble message={msg({ role: 'narration', text: '✦ Beena Ka Lifafa' })} />);

  test('no chat bubble, no avatar', () => {
    expect(
      walk(tree).filter((n) => style(n).backgroundColor === theme.surface).length,
    ).toBe(0);
    expect(walk(tree).some((n) => n.type === 'LinearGradient')).toBe(false);
    expect(texts(tree).map((t) => (t.children ?? []).join('')).join('')).toContain(
      '✦ Beena Ka Lifafa',
    );
  });
});

describe('choice chips', () => {
  test('asterisks are stripped from labels', () => {
    const tree = render(
      <ChoiceChips
        choices={[{ id: 'a', label: '*Dheere se* lifafa kholo' }]}
        onPick={() => undefined}
      />,
    );
    const label = texts(tree).map((t) => (t.children ?? []).join('')).join('');
    expect(label).toBe('Dheere se lifafa kholo');
  });
});
