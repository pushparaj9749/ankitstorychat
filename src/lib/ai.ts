/**
 * AI provider layer — OpenAI-compatible chat completions.
 * The app ships NO AI API of its own: users configure their own provider
 * (Settings -> AI Add-ons). Keys are read from SecureStore at call time and
 * are NEVER logged, persisted, or sent anywhere except the user's provider.
 */
import type { AIError, AIProvider } from '../types';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  timeoutMs?: number;
}

export function aiError(
  code: AIError['code'],
  message: string,
  retryable: boolean,
  httpStatus?: number,
): AIError {
  return { code, message, retryable, httpStatus };
}

export function normalizeBaseUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '');
  // Allow host-only input like "api.openai.com/v1".
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

export function completionsUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  // Avoid doubling the path if the user pasted the full endpoint.
  if (/\/chat\/completions\/?$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

/** Friendly one-line summary of an AIError for UI display. */
export function aiErrorMessage(e: AIError): string {
  switch (e.code) {
    case 'invalid_key':
      return 'API key rejected. Check your key in Settings → AI Add-ons.';
    case 'invalid_model':
      return 'Model not found. Check the model name or pick another model.';
    case 'rate_limit':
      return 'Provider rate limit hit. Wait a bit, then Retry.';
    case 'network':
      return 'No connection to the AI provider. Check your internet.';
    case 'timeout':
      return 'AI took too long to respond. Retry?';
    case 'bad_response':
      return 'Provider sent an unreadable response. Retry or change model.';
    case 'empty_response':
      return 'AI returned an empty reply. Retry?';
    case 'disabled':
      return 'No AI provider is active. Add your own API key in AI Add-ons to play.';
    case 'provider_error':
    default:
      return e.message || 'AI provider error. Retry or check Settings.';
  }
}

function errorFromStatus(status: number, bodyText: string): AIError {
  const snippet = (bodyText || '').slice(0, 300);
  if (status === 401 || status === 403) {
    return aiError('invalid_key', `Unauthorized (${status}). ${snippet}`, false, status);
  }
  if (status === 404) {
    return aiError(
      'invalid_model',
      `Not found (${status}) — wrong model name or base URL. ${snippet}`,
      false,
      status,
    );
  }
  if (status === 429) {
    return aiError('rate_limit', `Rate limited (${status}). ${snippet}`, true, status);
  }
  if (status >= 500) {
    return aiError('provider_error', `Provider error (${status}). ${snippet}`, true, status);
  }
  return aiError('provider_error', `Request failed (${status}). ${snippet}`, status >= 500, status);
}

/* ---------------- model-aware request shaping ---------------- */

/**
 * How a model wants to be called. Reasoning models think before they answer:
 * their hidden thinking tokens count against the output budget, and the newer
 * OpenAI families reject `max_tokens` / `temperature` outright.
 */
export type ModelProfile = 'standard' | 'openai-reasoning' | 'gpt-oss';

export function modelProfile(model: string): ModelProfile {
  const m = (model || '').trim().toLowerCase().replace(/^openai\//, '');
  if (m.includes('gpt-oss')) return 'gpt-oss';
  if (/^(gpt-5|gpt-6|o[1-9])([-.]|$)/.test(m)) return 'openai-reasoning';
  return 'standard';
}

/**
 * Models a provider has shut down, mapped to the provider's own recommended
 * replacement, so a saved provider keeps working instead of failing every turn.
 * Groq retired both Llama models for free/developer keys on 2026-08-16.
 */
const RETIRED_MODELS: { host: RegExp; from: string; to: string }[] = [
  { host: /(^|\.)groq\.com/i, from: 'llama-3.1-8b-instant', to: 'openai/gpt-oss-20b' },
  { host: /(^|\.)groq\.com/i, from: 'llama-3.3-70b-versatile', to: 'openai/gpt-oss-120b' },
];

export function effectiveModel(baseUrl: string, model: string): string {
  let host = '';
  try {
    host = new URL(normalizeBaseUrl(baseUrl)).host;
  } catch {
    host = '';
  }
  const hit = RETIRED_MODELS.find((r) => r.host.test(host) && r.from === model.trim());
  return hit ? hit.to : model;
}

/** Upper bound for the VISIBLE reply. The prompt keeps replies short; this only prevents cut-offs. */
export const MAX_VISIBLE_TOKENS = 800;
/** Extra room for a reasoning model's hidden thinking, so it never eats the whole reply. */
export const REASONING_HEADROOM = 1500;

export interface BodyAdjustments {
  /** Provider rejected `max_tokens`: send `max_completion_tokens` instead. */
  useCompletionTokens?: boolean;
  /** Provider rejected a custom temperature. */
  dropTemperature?: boolean;
  /** Provider rejected `reasoning_effort`. */
  dropReasoning?: boolean;
}

export function buildCompletionBody(
  provider: Pick<AIProvider, 'baseUrl' | 'model' | 'temperature' | 'maxTokens'>,
  messages: ChatMsg[],
  adj: BodyAdjustments = {},
): Record<string, unknown> {
  const model = effectiveModel(provider.baseUrl, provider.model);
  const profile = modelProfile(model);
  const visible = Math.min(provider.maxTokens ?? 500, MAX_VISIBLE_TOKENS);
  const body: Record<string, unknown> = { model, messages };

  if (profile === 'standard') {
    if (!adj.dropTemperature) body.temperature = provider.temperature ?? 0.7;
    body[adj.useCompletionTokens ? 'max_completion_tokens' : 'max_tokens'] = visible;
    return body;
  }
  // Reasoning models: a LOW effort gives a short silent think (better logic)
  // without slowing the chat much; the headroom keeps the reply from being
  // swallowed by the thinking.
  body.max_completion_tokens = visible + REASONING_HEADROOM;
  if (!adj.dropReasoning) body.reasoning_effort = 'low';
  // OpenAI's reasoning families only accept their default temperature.
  if (profile === 'gpt-oss' && !adj.dropTemperature) body.temperature = provider.temperature ?? 0.7;
  return body;
}

/** Read a 400 body and decide which request fields to change for one retry. */
export function adjustmentsFor400(bodyText: string, current: BodyAdjustments): BodyAdjustments | null {
  const t = (bodyText || '').toLowerCase();
  const next: BodyAdjustments = { ...current };
  if (t.includes('max_tokens') && t.includes('max_completion_tokens')) next.useCompletionTokens = true;
  if (t.includes('temperature')) next.dropTemperature = true;
  if (t.includes('reasoning_effort') || t.includes('reasoning effort')) next.dropReasoning = true;
  const changed =
    !!next.useCompletionTokens !== !!current.useCompletionTokens ||
    !!next.dropTemperature !== !!current.dropTemperature ||
    !!next.dropReasoning !== !!current.dropReasoning;
  return changed ? next : null;
}

/**
 * A reply cut off by the token limit ends mid-sentence, which reads as the AI
 * "losing the plot". Trim back to the last complete line or sentence.
 */
export function trimUnfinished(text: string): string {
  const t = text.trimEnd();
  const ends = /[.!?…।"”'’*)~]$/;
  if (ends.test(t)) return t;
  const lines = t.split('\n');
  if (lines.length > 1) {
    const kept = lines.slice(0, -1).join('\n').trimEnd();
    if (kept.length >= 20) return kept;
  }
  const last = Math.max(...['. ', '! ', '? ', '… ', '। '].map((p) => t.lastIndexOf(p)));
  if (last > 0) return t.slice(0, last + 1).trimEnd();
  return t;
}

/**
 * Single chat completion. Throws AIError (never returns one) so callers can
 * use try/catch and keep the key out of every code path except the header.
 */
export async function chatCompletion(
  provider: Pick<AIProvider, 'baseUrl' | 'model' | 'temperature' | 'maxTokens'>,
  apiKey: string,
  messages: ChatMsg[],
  opts: CompletionOptions = {},
): Promise<string> {
  const url = completionsUrl(provider.baseUrl);
  const timeoutMs = opts.timeoutMs ?? 45000;

  const send = async (adj: BodyAdjustments): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildCompletionBody(provider, messages, adj)),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw aiError('timeout', 'Request timed out.', true);
      }
      throw aiError('network', 'Network request failed.', true);
    } finally {
      clearTimeout(timer);
    }
  };

  const readText = async (r: Response): Promise<string> => {
    try {
      return await r.text();
    } catch {
      return '';
    }
  };

  let res = await send({});
  if (res.status === 400) {
    // One self-healing retry when the model rejects a parameter shape
    // (e.g. newer OpenAI models: max_tokens / temperature not supported).
    const text = await readText(res);
    const adj = adjustmentsFor400(text, {});
    if (!adj) throw errorFromStatus(400, text);
    res = await send(adj);
  }

  if (!res.ok) {
    throw errorFromStatus(res.status, await readText(res));
  }

  let data: unknown;
  try {
    data = (await res.json()) as unknown;
  } catch {
    throw aiError('bad_response', 'Could not parse provider response.', true, res.status);
  }

  const choice = (data as { choices?: { message?: { content?: string }; finish_reason?: string }[] })?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string') {
    throw aiError('bad_response', 'Unexpected response shape from provider.', true, res.status);
  }
  if (!text.trim()) {
    throw aiError('empty_response', 'Empty response from provider.', true, res.status);
  }
  return choice?.finish_reason === 'length' ? trimUnfinished(text) : text;
}

/** Lightweight connection test: tiny max_tokens, short timeout. */
export async function testConnection(
  provider: Pick<AIProvider, 'baseUrl' | 'model' | 'temperature'>,
  apiKey: string,
): Promise<{ ok: true; sample: string } | { ok: false; error: AIError }> {
  try {
    const text = await chatCompletion(
      { ...provider, maxTokens: 24 },
      apiKey,
      [
        { role: 'system', content: 'Reply with exactly: OK' },
        { role: 'user', content: 'ping' },
      ],
      { timeoutMs: 20000 },
    );
    return { ok: true, sample: text.slice(0, 120) };
  } catch (e) {
    return { ok: false, error: e as AIError };
  }
}

/** Preset list shown in the provider editor (user still pastes their own key). */
export const PROVIDER_PRESETS: { label: string; baseUrl: string; model: string; hint: string }[] = [
  {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6-luna',
    hint: 'Needs an OpenAI API key (platform.openai.com). gpt-4o-mini shuts down on 14 Jan 2027.',
  },
  {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-oss-120b',
    hint: 'One key for many models (openrouter.ai).',
  },
  {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    hint: 'Fast inference (console.groq.com). Free tier available. Old Llama models were retired.',
  },
  {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'openai/gpt-oss-120b',
    hint: 'Open models API (api.together.xyz).',
  },
  {
    label: 'Custom (OpenAI-compatible)',
    baseUrl: 'https://',
    model: '',
    hint: 'Any server speaking the OpenAI chat-completions format.',
  },
];
