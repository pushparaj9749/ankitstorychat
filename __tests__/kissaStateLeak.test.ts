/**
 * KISSA v2.4.2 — kissa-state leak bug tests
 * Covers all required cases from spec section 27.
 */
import { parseAssistantResponse } from '../src/lib/engine';

describe('kissa-state leak fix — v2.4.2', () => {
  test('normal story response without state', () => {
    const raw = `*Beena ke honton par halki si muskaan ubharti hai.*\nBeena: "Achchha. Zubaan mein dum toh hai tumhare."`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toContain('Beena');
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.effects).toBeUndefined();
  });

  test('state after dialogue (fenced)', () => {
    const raw = `Myra: "Umm... lagta hai ye coffee meri nahi hai."\n\`\`\`kissa-state\n{"relationships": {"myra": 5}, "location": "Cafe", "memory": ["Met Myra"]}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    // Speaker is extracted, displayText contains dialogue without speaker prefix
    expect(p.displayText).toContain('Umm... lagta hai ye coffee meri nahi hai.');
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.displayText).not.toContain('relationships');
    expect(p.effects?.relationships).toEqual({ myra: 5 });
    expect(p.memoryNotes).toEqual(['Met Myra']);
    expect(p.worldStateRaw).toBeDefined();
    expect(p.speaker).toBe('Myra');
  });

  test('state before dialogue (fenced)', () => {
    const raw = `\`\`\`kissa-state\n{"location": "Library"}\n\`\`\`\n*Woh library mein baithi hai.*\nMaya: "Tum aa gaye?"`;
    const p = parseAssistantResponse(raw);
    // Dialogue preserved, speaker extracted
    expect(p.displayText).toContain('Tum aa gaye?');
    expect(p.displayText).toContain('library mein baithi hai');
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.effects?.location).toBe('Library');
    expect(p.speaker).toBe('Maya');
  });

  test('fenced state', () => {
    const raw = `Hello world\n\`\`\`kissa-state\n{"flags": {"gateOpened": true}}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toBe('Hello world');
    expect(p.effects?.flags).toEqual({ gateOpened: true });
  });

  test('multiline state with whitespace variations', () => {
    const raw = `Story line\n\`\`\`kissa-state\n{\n  "relationships": {\n    "maya": 10,\n    "kabir": -5\n  },\n  "location": "Garden",\n  "presentCharacters": ["maya", "kabir"],\n  "activity": "having chai"\n}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toBe('Story line');
    expect(p.effects?.relationships).toEqual({ maya: 10, kabir: -5 });
    expect(p.effects?.location).toBe('Garden');
    expect(p.worldStateRaw).toBeDefined();
    expect((p.worldStateRaw as any).presentCharacters).toEqual(['maya', 'kabir']);
  });

  test('valid JSON state', () => {
    const raw = `Dialogue\n\`\`\`kissa-state\n{"relationships": {"a": 3}, "memory": ["fact one", "fact two"]}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.memoryNotes).toEqual(['fact one', 'fact two']);
  });

  test('malformed state must NOT leak', () => {
    const raw = `Hello\n\`\`\`kissa-state\n{not json at all}\n\`\`\`\nWorld`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toContain('Hello');
    expect(p.displayText).toContain('World');
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.displayText).not.toContain('not json');
    // Effects undefined but leak suppressed
    expect(p.displayText).not.toMatch(/\{.*not json/);
  });

  test('internal state is persisted (worldStateRaw) and removed from visible', () => {
    const raw = `*Action*\nMaya: "Hi"\n\`\`\`kissa-state\n{"location": "Park", "presentCharacters": ["maya"], "storyTime": {"clockTime": "8:42 PM"}}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.displayText).not.toContain('presentCharacters');
    expect(p.displayText).not.toContain('storyTime');
    expect(p.worldStateRaw).toBeDefined();
    expect((p.worldStateRaw as any).location).toBe('Park');
    expect(p.effects?.location).toBe('Park');
  });

  test('normal dialogue is preserved', () => {
    const raw = `*Woh muskurati hai.*\nMyra: "Tum yahan kaise?"\n*Uske haath mein chai ka cup hai.*`;
    const p = parseAssistantResponse(raw);
    // Speaker extracted, dialogue preserved
    expect(p.displayText).toContain('chai ka cup');
    expect(p.displayText).toContain('Tum yahan kaise?');
    expect(p.speaker).toBe('Myra');
  });

  test('similar-looking normal text is NOT incorrectly removed', () => {
    const raw = `I heard about kissa-state feature in the app. It's cool.`;
    const p = parseAssistantResponse(raw);
    // Should NOT remove because no JSON after
    expect(p.displayText).toContain('kissa-state');
    expect(p.displayText).toContain('feature');
  });

  test('similar text with kissa-state but no JSON object should stay', () => {
    const raw = `The word kissa-state appears in docs without JSON.`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toContain('kissa-state');
  });

  test('multiple state blocks handled safely', () => {
    const raw = `First line\n\`\`\`kissa-state\n{"location": "A"}\n\`\`\`\nMiddle\n\`\`\`kissa-state\n{"location": "B", "relationships": {"x": 2}}\n\`\`\`\nEnd`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toContain('First line');
    expect(p.displayText).toContain('Middle');
    expect(p.displayText).toContain('End');
    expect(p.displayText).not.toContain('kissa-state');
    // Last location wins
    expect(p.effects?.location).toBe('B');
    expect(p.effects?.relationships).toEqual({ x: 2 });
  });

  test('unfenced kissa-state block (bug example) is removed', () => {
    const raw = `Maya: "Hello"\nkissa-state\n{\n  "relationships": {"maya": 5},\n  "location": "Library",\n  "scene": "scene-1",\n  "storyTime": {"clockTime": "8:42 PM", "timeOfDay": "evening"},\n  "presentCharacters": ["maya"],\n  "activity": "reading",\n  "playerAction": "sitting",\n  "importantObjects": [{"name": "book"}]\n}`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toContain('Hello');
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.displayText).not.toContain('relationships');
    expect(p.displayText).not.toContain('presentCharacters');
    expect(p.effects?.location).toBe('Library');
    expect(p.worldStateRaw).toBeDefined();
    expect(p.speaker).toBe('Maya');
  });

  test('unfenced with colon', () => {
    const raw = `Dialogue here\nkissa-state: {"location": "Cafe", "memory": ["Visited cafe"]}`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toBe('Dialogue here');
    expect(p.effects?.location).toBe('Cafe');
    expect(p.memoryNotes).toEqual(['Visited cafe']);
  });

  test('memory remains functional — notes extracted', () => {
    const raw = `*Smile*\nKabir: "Yaad hai woh waada?"\n\`\`\`kissa-state\n{"memory": ["Kabir ne waada yaad dilaya"]}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.memoryNotes).toContain('Kabir ne waada yaad dilaya');
    expect(p.displayText).not.toContain('kissa-state');
  });

  test('state at the end', () => {
    const raw = `Final dialogue line.\n\`\`\`kissa-state\n{"endStory": "happy-ending"}\n\`\`\``;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).toBe('Final dialogue line.');
    expect(p.effects?.endStory).toBe('happy-ending');
  });

  test('malformed unfenced does not leak', () => {
    const raw = `Hi there\nkissa-state\n{ this is not json }\nMore text`;
    const p = parseAssistantResponse(raw);
    expect(p.displayText).not.toContain('kissa-state');
    expect(p.displayText).not.toContain('this is not json');
    // Should preserve surrounding dialogue except the leak
    expect(p.displayText).toContain('Hi there');
  });
});
