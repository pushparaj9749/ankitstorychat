import {
  applyEffects,
  availableChoices,
  flagHolds,
  matchChoice,
  parseAssistantResponse,
} from '../src/lib/engine';
import { createInitialState } from '../src/types';

describe('flagHolds', () => {
  test('undefined always holds', () => {
    expect(flagHolds(undefined, {})).toBe(true);
  });
  test('positive and negated flags', () => {
    expect(flagHolds('a', { a: true })).toBe(true);
    expect(flagHolds('a', {})).toBe(false);
    expect(flagHolds('!a', {})).toBe(true);
    expect(flagHolds('!a', { a: true })).toBe(false);
  });
});

describe('availableChoices', () => {
  const scene: any = {
    choices: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B', requiresFlag: 'met' },
      { id: 'c', text: 'C', requiresFlag: '!met' },
    ],
  };
  test('filters by flags', () => {
    expect(availableChoices(scene, { ...createInitialState(), flags: {} }).map((c) => c.id)).toEqual([
      'a',
      'c',
    ]);
    expect(
      availableChoices(scene, { ...createInitialState(), flags: { met: true } }).map((c) => c.id),
    ).toEqual(['a', 'b']);
  });
});

describe('applyEffects', () => {
  test('merges flags, inventory, relationships with clamp', () => {
    const s = createInitialState();
    const next = applyEffects(s, {
      relationships: { aria: 60 },
      flags: { gate: true },
      inventoryAdd: ['key'],
      location: 'castle',
    });
    expect(next.relationships.aria).toBe(100); // 50 + 60 clamped
    expect(next.flags.gate).toBe(true);
    expect(next.inventory).toEqual(['key']);
    expect(next.location).toBe('castle');
    // original untouched
    expect(s.inventory).toEqual([]);
  });

  test('inventory add/remove dedupes', () => {
    const s = { ...createInitialState(), inventory: ['a', 'b'] };
    const next = applyEffects(s, { inventoryAdd: ['b', 'c'], inventoryRemove: ['a'] });
    expect(next.inventory).toEqual(['b', 'c']);
  });

  test('no effects returns same state', () => {
    const s = createInitialState();
    expect(applyEffects(s, undefined)).toBe(s);
  });
});

describe('parseAssistantResponse', () => {
  test('extracts state block and strips it from display text', () => {
    const raw = `Aria ruk jaati hai.\n\`\`\`kissa-state\n{"relationships": {"aria": 5}, "memory": ["Met Aria"]}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toBe('Aria ruk jaati hai.');
    expect(p.effects?.relationships).toEqual({ aria: 5 });
    expect(p.memoryNotes).toEqual(['Met Aria']);
  });

  test('detects leading speaker', () => {
    const p = parseAssistantResponse('Aarohi: Ruk! Koi hai wahan.');
    expect(p.speaker).toBe('Aarohi');
    expect(p.displayText).toBe('Ruk! Koi hai wahan.');
  });

  test('ignores malformed state blocks', () => {
    const p = parseAssistantResponse('Hello\n```kissa-state\n{not json\n```');
    expect(p.effects).toBeUndefined();
    expect(p.displayText).toBe('Hello');
  });

  test('sanitizes non-numeric deltas', () => {
    const p = parseAssistantResponse('x\n```kissa-state\n{"relationships": {"a": "lots"}}\n```');
    expect(p.effects?.relationships).toEqual({});
  });
});

describe('matchChoice', () => {
  const choices: any[] = [
    { id: 'open', text: 'Steel dabba khol ke dekho', keywords: ['dabba', 'khol', 'open'] },
    { id: 'run', text: 'Chor ke peeche bhaago', keywords: ['chor', 'bhaag', 'chase'] },
  ];
  test('matches obvious intent', () => {
    expect(matchChoice('main dabba kholti hoon', choices)?.id).toBe('open');
    expect(matchChoice('chor ke peeche bhaago!', choices)?.id).toBe('run');
  });
  test('returns null when unsure', () => {
    expect(matchChoice('hmm pata nahi', choices)).toBeNull();
    expect(matchChoice('', choices)).toBeNull();
  });
});
