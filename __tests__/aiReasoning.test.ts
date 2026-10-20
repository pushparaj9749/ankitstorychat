/**
 * Better story logic without extra AI calls (still ONE story call per turn):
 *  - the narrator runs a silent logic check before every reply;
 *  - requests are shaped per model (reasoning models get a short, low-effort
 *    think + headroom so the thinking never swallows the reply);
 *  - a reply cut off by the token limit is trimmed to a complete sentence;
 *  - retired provider models are mapped to the provider's replacement;
 *  - presets point at current, stronger models.
 */
import fs from 'node:fs';
import { join } from 'node:path';
import {
  adjustmentsFor400,
  buildCompletionBody,
  chatCompletion,
  effectiveModel,
  MAX_VISIBLE_TOKENS,
  modelProfile,
  PROVIDER_PRESETS,
  REASONING_HEADROOM,
  trimUnfinished,
} from '../src/lib/ai';
import { buildSystemPrompt, LOGIC_CHECK } from '../src/lib/engine';
import type { CharactersFile, LocalProfile, MemoryFile, Playthrough, ScenesFile, StoryBundle, StoryFile, StoryMeta, WorldFile } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';

const msgs = [{ role: 'user' as const, content: 'hi' }];
const prov = (model: string, baseUrl = 'https://api.openai.com/v1') => ({ baseUrl, model, temperature: 0.8, maxTokens: 600 });

describe('model profiles', () => {
  test.each([
    ['gpt-4o-mini', 'standard'],
    ['meta-llama/llama-3.1-8b-instruct', 'standard'],
    ['gpt-6-luna', 'openai-reasoning'],
    ['gpt-5-mini', 'openai-reasoning'],
    ['gpt-5.4-mini', 'openai-reasoning'],
    ['o4-mini', 'openai-reasoning'],
    ['openai/gpt-oss-120b', 'gpt-oss'],
    ['gpt-oss-20b', 'gpt-oss'],
    ['omni-model', 'standard'],
  ])('%s → %s', (model, profile) => {
    expect(modelProfile(model)).toBe(profile);
  });
});

describe('request body', () => {
  test('standard models keep temperature and a max_tokens cap (raised so replies are not cut off)', () => {
    const b = buildCompletionBody(prov('gpt-4o-mini'), msgs);
    expect(b.temperature).toBe(0.8);
    expect(b.max_tokens).toBe(600);
    expect(b.reasoning_effort).toBeUndefined();
    expect(buildCompletionBody({ ...prov('x'), maxTokens: 5000 }, msgs).max_tokens).toBe(MAX_VISIBLE_TOKENS);
  });

  test('OpenAI reasoning models: max_completion_tokens with headroom, low effort, no temperature', () => {
    const b = buildCompletionBody(prov('gpt-6-luna'), msgs);
    expect(b.max_tokens).toBeUndefined();
    expect(b.max_completion_tokens).toBe(600 + REASONING_HEADROOM);
    expect(b.reasoning_effort).toBe('low');
    expect(b.temperature).toBeUndefined();
  });

  test('gpt-oss: low effort + headroom, temperature still allowed', () => {
    const b = buildCompletionBody(prov('openai/gpt-oss-120b', 'https://api.groq.com/openai/v1'), msgs);
    expect(b.reasoning_effort).toBe('low');
    expect(b.max_completion_tokens).toBe(600 + REASONING_HEADROOM);
    expect(b.temperature).toBe(0.8);
  });

  test('a 400 about a parameter produces exactly one adjustment set', () => {
    const t = "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.";
    expect(adjustmentsFor400(t, {})).toEqual({ useCompletionTokens: true });
    expect(adjustmentsFor400("Unsupported value: 'temperature' does not support 0.8", {})).toEqual({ dropTemperature: true });
    expect(adjustmentsFor400('`reasoning_effort` must be one of `low`, `medium`, or `high`', {})).toEqual({ dropReasoning: true });
    expect(adjustmentsFor400('messages: field required', {})).toBeNull();
    expect(adjustmentsFor400(t, { useCompletionTokens: true })).toBeNull();
  });
});

describe('retired models', () => {
  test('Groq Llama models (shut down 2026-08-16) map to Groq\'s recommended replacements', () => {
    expect(effectiveModel('https://api.groq.com/openai/v1', 'llama-3.1-8b-instant')).toBe('openai/gpt-oss-20b');
    expect(effectiveModel('api.groq.com/openai/v1', 'llama-3.3-70b-versatile')).toBe('openai/gpt-oss-120b');
    expect(buildCompletionBody(prov('llama-3.1-8b-instant', 'https://api.groq.com/openai/v1'), msgs).model).toBe('openai/gpt-oss-20b');
  });
  test('other providers and models are untouched', () => {
    expect(effectiveModel('https://openrouter.ai/api/v1', 'llama-3.1-8b-instant')).toBe('llama-3.1-8b-instant');
    expect(effectiveModel('https://api.groq.com/openai/v1', 'openai/gpt-oss-120b')).toBe('openai/gpt-oss-120b');
  });
});

describe('cut-off replies', () => {
  test('a dangling last line is dropped', () => {
    const t = '*Inaaya muskurati hai.*\nInaaya: "Chalo, player one."\n*Woh darwaze ki taraf';
    expect(trimUnfinished(t)).toBe('*Inaaya muskurati hai.*\nInaaya: "Chalo, player one."');
  });
  test('a single line is cut back to its last full sentence', () => {
    expect(trimUnfinished('Woh ruk jaati hai. Phir dheere se kehti hai ki')).toBe('Woh ruk jaati hai.');
  });
  test('finished text is left alone', () => {
    expect(trimUnfinished('Rudrani: "Paas aao."')).toBe('Rudrani: "Paas aao."');
  });
});

describe('chatCompletion', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const ok = (content: string, finish = 'stop') =>
    ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content }, finish_reason: finish }] }), text: async () => '' }) as unknown as Response;
  const bad = (status: number, text: string) =>
    ({ ok: false, status, json: async () => ({}), text: async () => text }) as unknown as Response;

  test('heals a rejected parameter with one retry', async () => {
    const bodies: any[] = [];
    global.fetch = jest.fn(async (_u: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1 ? bad(400, "Unsupported value: 'temperature' does not support 0.8 with this model.") : ok('Theek hai.');
    }) as any;
    await expect(chatCompletion(prov('my-custom-model'), 'k', msgs)).resolves.toBe('Theek hai.');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].temperature).toBe(0.8);
    expect(bodies[1].temperature).toBeUndefined();
  });

  test('an unrelated 400 is not retried', async () => {
    global.fetch = jest.fn(async () => bad(400, 'bad request')) as any;
    await expect(chatCompletion(prov('gpt-4o-mini'), 'k', msgs)).rejects.toMatchObject({ code: 'provider_error' });
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  test('a length-cut reply is trimmed to a complete sentence', async () => {
    global.fetch = jest.fn(async () => ok('Woh muskurati hai. Phir kehti hai ki tum', 'length')) as any;
    await expect(chatCompletion(prov('gpt-4o-mini'), 'k', msgs)).resolves.toBe('Woh muskurati hai.');
  });
});

describe('presets', () => {
  test('no preset points at a retired or weak 8B model', () => {
    for (const p of PROVIDER_PRESETS) {
      expect(p.model).not.toMatch(/llama-3\.1-8b|gpt-4o-mini/i);
    }
    expect(PROVIDER_PRESETS.find((p) => p.label === 'Groq')!.model).toBe('openai/gpt-oss-120b');
    expect(PROVIDER_PRESETS.find((p) => p.label === 'OpenAI')!.model).toBe('gpt-6-luna');
  });
});

describe('narrator prompt', () => {
  const ROOT = join(__dirname, '..', 'content');
  const ID = 'meri-hacker-girlfriend';
  const pack = <T,>(f: string): T => JSON.parse(fs.readFileSync(join(ROOT, 'stories', ID, f), 'utf8')) as T;
  const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as { stories: StoryMeta[] };
  const bundle: StoryBundle = {
    meta: manifest.stories.find((s) => s.id === ID)!,
    story: pack<StoryFile>('story.json'),
    characters: pack<CharactersFile>('characters.json'),
    world: pack<WorldFile>('world.json'),
    scenes: pack<ScenesFile>('scenes.json'),
    memory: pack<MemoryFile>('memory.json'),
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  };
  const pt: Playthrough = {
    id: 'p', storyId: ID, label: 'Journey 1', status: 'active', currentSceneId: bundle.story.openingSceneId,
    state: createInitialState(), progress: 0, messageCount: 12, endingId: null, mode: 'ai', providerId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Playthrough;
  const prompt = buildSystemPrompt(
    { bundle, profile: { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile, playthrough: pt, memories: [], history: [], stateMode: 'separate' } as any,
    '18+',
  );

  test('carries the silent logic check, before the response rules and outside the private notes', () => {
    expect(prompt).toContain(LOGIC_CHECK);
    expect(prompt.indexOf(LOGIC_CHECK)).toBeLessThan(prompt.indexOf('HOW TO RESPOND:'));
    expect(prompt.indexOf(LOGIC_CHECK)).toBeGreaterThan(prompt.indexOf('=== END OF PRIVATE NARRATOR NOTES ==='));
  });

  test('the check covers the reader\'s latest move, presence, cause and effect, character knowledge and repetition', () => {
    expect(LOGIC_CHECK).toMatch(/reader just say or do/);
    expect(LOGIC_CHECK).toMatch(/physically present/);
    expect(LOGIC_CHECK).toMatch(/Cause and effect/);
    expect(LOGIC_CHECK).toMatch(/only what THEY know/);
    expect(LOGIC_CHECK).toMatch(/Never repeat/);
    expect(LOGIC_CHECK).toMatch(/never write this check/);
  });

  test('the reply must react to the reader first', () => {
    expect(prompt).toMatch(/the FIRST thing your reply does is react to what the reader just said or did/);
  });
});
