/**
 * Turn memory, with one second chance.
 *
 * v2.13.1: after a reply the chat commits the turn to memory (world state,
 * facts, episode). That call used to sit inside `catch {}`, so a provider
 * hiccup meant the scene was never recorded — and the reader was never told.
 * Long stories then "forgot" things that had clearly happened.
 *
 * This wrapper keeps the chat non-blocking, but:
 *  - logs the failure instead of swallowing it (visible in `adb logcat` /
 *    Metro; no UI change, the reader's turn is never interrupted),
 *  - retries exactly once in the background after a short pause,
 *  - reports whether the turn was finally recorded.
 *
 * The pipeline is safe to replay: facts dedupe on a content hash, the episode
 * line is hashed too, and the world state is recomputed from what is stored —
 * so a retry cannot double-write a scene.
 */
import { runMemoryWritePipeline } from './memoryEngine';
import type { WritePipelineInput } from './memoryEngine';

export interface MemoryWriteOutcome {
  ok: boolean;
  attempts: number;
}

const RETRY_DELAY_MS = 2500;

export const memoryWriteWarn = (message: string, err: unknown): void => {
  // Deliberately console-only: the reader is mid-story, a toast would be noise.
  console.warn(`[kissa] ${message}`, err instanceof Error ? err.message : err);
};

export async function writeTurnMemory(
  input: WritePipelineInput,
  opts: {
    retryDelayMs?: number;
    warn?: (message: string, err: unknown) => void;
    /** Injectable for tests; defaults to runMemoryWritePipeline. */
    write?: (input: WritePipelineInput) => Promise<unknown>;
  } = {},
): Promise<MemoryWriteOutcome> {
  const warn = opts.warn ?? memoryWriteWarn;
  const write = opts.write ?? ((i: WritePipelineInput) => runMemoryWritePipeline(i));
  const delay = opts.retryDelayMs ?? RETRY_DELAY_MS;

  try {
    await write(input);
    return { ok: true, attempts: 1 };
  } catch (err) {
    warn('memory write failed, retrying once', err);
  }

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    await write(input);
    return { ok: true, attempts: 2 };
  } catch (err) {
    // Second failure: give up quietly for this turn, but never silently.
    warn('memory write failed after retry — this turn may be missing from memory', err);
    return { ok: false, attempts: 2 };
  }
}
