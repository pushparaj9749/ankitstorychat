/**
 * Dependency-free pause switch for App Lock (see appLock.ts). Kept separate so
 * picker / share helpers can use it without importing secure storage.
 */

let pausedUntil = 0;

/**
 * Opening the share sheet / file picker sends the app to the background;
 * pause the lock around those so the user isn't asked for the PIN on return.
 */
export function pauseAppLock(ms = 3 * 60_000): void {
  pausedUntil = Date.now() + ms;
}
export function resumeAppLock(): void {
  pausedUntil = 0;
}
export function isAppLockPaused(now = Date.now()): boolean {
  return now < pausedUntil;
}

/** Wrap a system-UI call (picker / share) so it doesn't trigger the lock. */
export async function withAppLockPaused<T>(fn: () => Promise<T>): Promise<T> {
  pauseAppLock();
  try {
    return await fn();
  } finally {
    // Give the app a moment to finish returning to the foreground.
    setTimeout(resumeAppLock, 1500);
  }
}
