/**
 * v2.13.1 — a turn that fails to reach memory must not vanish silently.
 * The chat used to wrap the write pipeline in `catch {}`, so a provider blip
 * left the scene unrecorded with no trace anywhere. Now: log + one retry.
 */
jest.mock('../src/lib/memoryEngine', () => ({
  __esModule: true,
  runMemoryWritePipeline: jest.fn(),
}));

import { runMemoryWritePipeline } from '../src/lib/memoryEngine';
import { writeTurnMemory } from '../src/lib/memoryWriteQueue';
import type { WritePipelineInput } from '../src/lib/memoryEngine';

const input = {
  playthrough: { id: 'pt-1' },
  bundle: {},
  userText: 'main tunnel ke andar chala',
  assistantText: 'Roshni ne torch uthaya.',
} as unknown as WritePipelineInput;

describe('writeTurnMemory', () => {
  it('writes once and stays quiet on success', async () => {
    const write = jest.fn(async () => ({ ok: true }));
    const warn = jest.fn();
    const out = await writeTurnMemory(input, { write, warn, retryDelayMs: 0 });
    expect(out).toEqual({ ok: true, attempts: 1 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the failure and retries exactly once in the background', async () => {
    // First attempt fails, second succeeds — the exact provider-timeout case.
    const write = jest
      .fn()
      .mockRejectedValueOnce(new Error('provider timeout'))
      .mockResolvedValueOnce({ ok: true });
    const warn = jest.fn();
    const out = await writeTurnMemory(input, { write, warn, retryDelayMs: 0 });

    expect(out).toEqual({ ok: true, attempts: 2 });
    expect(write).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    // Same turn, so the replay writes the same scene (hash-deduped downstream).
    expect(write.mock.calls[1][0]).toBe(input);
  });

  it('gives up after the retry but still says so out loud', async () => {
    const write = jest.fn().mockRejectedValue(new Error('network down'));
    const warn = jest.fn();
    const out = await writeTurnMemory(input, { write, warn, retryDelayMs: 0 });

    expect(out).toEqual({ ok: false, attempts: 2 });
    expect(write).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toMatch(/missing from memory/i);
  });

  it('never prints provider payloads from the default logger', async () => {
    const err = Object.assign(new Error('boom'), { apiKey: 'sk-live-secret' });
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await writeTurnMemory(input, { write: jest.fn().mockRejectedValue(err), retryDelayMs: 0 });
      const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
      expect(logged).toContain('boom');
      // Only the message text reaches the log — never the error object.
      expect(logged).not.toContain('sk-live-secret');
    } finally {
      spy.mockRestore();
    }
  });

  it('waits between attempts instead of hammering the provider', async () => {
    jest.useFakeTimers();
    try {
      const write = jest.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ ok: true });
      const pending = writeTurnMemory(input, { write, retryDelayMs: 2500 });
      await Promise.resolve();
      await Promise.resolve();
      expect(write).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(2500);
      const out = await pending;
      expect(out.attempts).toBe(2);
      expect(write).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('defaults to the real pipeline', async () => {
    (runMemoryWritePipeline as jest.Mock).mockResolvedValueOnce({ storedFacts: 0 });
    const out = await writeTurnMemory(input, { retryDelayMs: 0, warn: jest.fn() });
    expect(out.ok).toBe(true);
    expect(runMemoryWritePipeline).toHaveBeenCalledWith(input);
  });
});
