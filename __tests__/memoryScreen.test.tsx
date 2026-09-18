/**
 * Memory UI removal verification + god-level memory engine smoke.
 * The raw memory viewer is gone — memory lives internally.
 */
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));
jest.mock('../src/lib/db', () => ({
  kvGet: jest.fn(),
  kvSet: jest.fn(),
  kvDelete: jest.fn(),
}));

import { validateWorldState, createInitialWorldState, applyWorldStateUpdate } from '../src/lib/worldState';
import { validateExtraction, isTrivial, deterministicImportance } from '../src/lib/memoryEngine';
import type { StoryBundle, Playthrough } from '../src/types';
import { createInitialState } from '../src/types';

describe('memory UI removed', () => {
  test('RootStackParamList no longer exposes Memory route', () => {
    const fs = require('fs');
    const content = fs.readFileSync('src/navigation/RootNavigator.tsx', 'utf8');
    expect(content).not.toContain("from '../screens/Memory'");
    expect(content).not.toContain('name="Memory"');
    const types = fs.readFileSync('src/types.ts', 'utf8');
    expect(types).not.toContain('Memory: { playthroughId');
  });

  test('Memory screen file is removed', () => {
    const fs = require('fs');
    expect(fs.existsSync('src/screens/Memory.tsx')).toBe(false);
  });

  test('Saves and Chat no longer navigate to Memory', () => {
    const fs = require('fs');
    const saves = fs.readFileSync('src/screens/Saves.tsx', 'utf8');
    const chat = fs.readFileSync('src/screens/Chat.tsx', 'utf8');
    const detail = fs.readFileSync('src/screens/StoryDetail.tsx', 'utf8');
    expect(saves).not.toContain("navigate('Memory'");
    expect(chat).not.toContain("navigate('Memory'");
    expect(detail).not.toContain("navigate('Memory'");
  });
});

describe('god-level world state', () => {
  const bundle = {
    story: { openingSceneId: 's1' },
    world: {
      locations: [{ name: 'Library' }, { name: 'Maya Apartment' }],
      importantObjects: [{ name: 'old photograph' }],
    },
    characters: { characters: [{ id: 'maya', name: 'Maya' }, { id: 'kabir', name: 'Kabir' }] },
    scenes: { scenes: [{ id: 's1', title: 'Opening' }] },
  } as unknown as StoryBundle;

  const playthrough = {
    id: 'pt_test',
    storyId: 'test-story',
    currentSceneId: 's1',
    state: { ...createInitialState('Library'), location: 'Library' },
  } as Playthrough;

  test('initial world state is valid and has required layers', () => {
    const ws = createInitialWorldState(playthrough, bundle);
    expect(validateWorldState(ws)).toBe(true);
    expect(ws.currentLocation).toBe('Library');
    expect(ws.storyTime.day).toBe(1);
    expect(ws.presentCharacters).toBeDefined();
    expect(ws.relationships).toBeDefined();
    expect(ws.locationMemory).toBeDefined();
    expect(ws.unresolvedThreads).toBeDefined();
  });

  test('contradiction protection blocks low-confidence location overwrite', () => {
    const ws = createInitialWorldState(playthrough, bundle);
    const low = applyWorldStateUpdate(ws, {
      currentLocation: 'Maya Apartment',
      confidence: 'low',
    });
    expect(low.currentLocation).toBe('Library');
    const high = applyWorldStateUpdate(ws, {
      currentLocation: 'Maya Apartment',
      confidence: 'high',
      evidence: 'Player walked to Maya Apartment',
    });
    expect(high.currentLocation).toBe('Maya Apartment');
    expect(high.previousLocation).toBe('Library');
  });

  test('extraction validation filters malformed and private data', () => {
    expect(validateExtraction(null)).toBeNull();
    expect(validateExtraction({})).toBeNull();
    const good = validateExtraction({ location: 'Library', memory: ['test'], facts: ['Maya promised to help'] });
    expect(good).toBeTruthy();
    const bad = validateExtraction({ location: 'x'.repeat(500) });
    expect(bad).toBeNull();
  });

  test('trivial filter works', () => {
    expect(isTrivial('hi')).toBe(true);
    expect(isTrivial('ok')).toBe(true);
    expect(isTrivial('Maya ne photograph dikhaya aur raaz bataya')).toBe(false);
  });

  test('importance scoring prioritizes promises and objects', () => {
    expect(deterministicImportance('Maya ne waada kiya ki woh library mein madad karegi', { isPromise: true })).toBe(4);
    expect(deterministicImportance('old photograph mila library mein', { hasNamedObject: true })).toBeGreaterThanOrEqual(3);
  });
});
