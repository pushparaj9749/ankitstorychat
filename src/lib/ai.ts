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
      return 'No AI provider is active. Using Offline Story Mode.';
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: provider.temperature ?? 0.8,
        max_tokens: Math.min(provider.maxTokens ?? 350, 400),
      }),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw aiError('timeout', 'Request timed out.', true);
    }
    throw aiError('network', 'Network request failed.', true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    throw errorFromStatus(res.status, text);
  }

  let data: unknown;
  try {
    data = (await res.json()) as unknown;
  } catch {
    throw aiError('bad_response', 'Could not parse provider response.', true, res.status);
  }

  const text = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
    ?.content;
  if (typeof text !== 'string') {
    throw aiError('bad_response', 'Unexpected response shape from provider.', true, res.status);
  }
  if (!text.trim()) {
    throw aiError('empty_response', 'Empty response from provider.', true, res.status);
  }
  return text;
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
    model: 'gpt-4o-mini',
    hint: 'Needs an OpenAI API key (platform.openai.com).',
  },
  {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.1-8b-instruct',
    hint: 'One key for many models (openrouter.ai).',
  },
  {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    hint: 'Fast inference (console.groq.com). Free tier available.',
  },
  {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    hint: 'Open models API (api.together.xyz).',
  },
  {
    label: 'Custom (OpenAI-compatible)',
    baseUrl: 'https://',
    model: '',
    hint: 'Any server speaking the OpenAI chat-completions format.',
  },
];
