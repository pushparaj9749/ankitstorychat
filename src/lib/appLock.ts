/**
 * App Lock — fingerprint / PIN, entirely on this device.
 *
 * - The PIN is never stored: only a salted, stretched SHA-256 hash, kept in
 *   expo-secure-store (Android Keystore / iOS Keychain).
 * - Wrong PINs are rate-limited, and the counter is persisted so restarting
 *   the app doesn't reset it.
 * - Fingerprint / face uses the phone's own biometric prompt
 *   (expo-local-authentication). Nothing ever leaves the phone.
 * - A forgotten PIN can be reset with the phone's own screen lock
 *   (PIN / pattern / fingerprint), when the phone has one.
 */
import * as SecureStore from 'expo-secure-store';
import { sha256Hex } from './sha256';
import { kvDelete, kvGet, kvSet } from './db';
import { withAppLockPaused } from './lockPause';

export const PIN_LENGTH = 4;
export type AppLockDelay = 'immediate' | '1m' | '5m';

export const LOCK_DELAY_MS: Record<AppLockDelay, number> = {
  immediate: 0,
  '1m': 60_000,
  '5m': 5 * 60_000,
};

export const LOCK_DELAY_LABEL: Record<AppLockDelay, string> = {
  immediate: 'Turant',
  '1m': '1 minute baad',
  '5m': '5 minute baad',
};

const PIN_KEY = 'kissa_app_lock_pin_v1';
const ATTEMPTS_KEY = 'appLock.attempts';
/** Hash rounds. Kept modest: Hermes has no JIT and unlock must feel instant. */
const STRETCH = 200;

/* ---------------- pure helpers (unit-tested) ---------------- */

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function hashPin(pin: string, salt: string, rounds = STRETCH): string {
  let h = sha256Hex(`kissa-lock:${salt}:${pin}`);
  for (let i = 1; i < rounds; i++) h = sha256Hex(`${salt}${h}${pin}`);
  return h;
}

/** Constant-time-ish string compare (both are fixed-length hex). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Cool-down after `fails` consecutive wrong PINs: free for the first 4, then
 * 30 s at the 5th and doubling with every further miss, capped at 15 min.
 */
export function lockoutMsFor(fails: number): number {
  if (fails < 5) return 0;
  return Math.min(30_000 * 2 ** (fails - 5), 15 * 60_000);
}

/** Should the app lock when it comes back to the foreground? */
export function shouldLockOnResume(backgroundAt: number | null, now: number, delay: AppLockDelay): boolean {
  if (backgroundAt == null) return false;
  return now - backgroundAt >= LOCK_DELAY_MS[delay];
}

export function newSalt(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return s + Date.now().toString(16);
}

/* ---------------- PIN storage ---------------- */

interface StoredPin {
  v: 1;
  salt: string;
  hash: string;
  /** Hash rounds used (lets a future version change STRETCH safely). */
  r?: number;
}

export async function hasPin(): Promise<boolean> {
  try {
    return !!(await SecureStore.getItemAsync(PIN_KEY));
  } catch {
    return false;
  }
}

export async function savePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits`);
  const salt = newSalt();
  const value: StoredPin = { v: 1, salt, hash: hashPin(pin, salt, STRETCH), r: STRETCH };
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await resetAttempts();
}

export async function clearPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch {
    /* already gone */
  }
  await resetAttempts();
}

/* ---------------- attempts / lockout ---------------- */

export interface AttemptState {
  fails: number;
  lockedUntil: number;
}

export async function getAttempts(): Promise<AttemptState> {
  try {
    const raw = await kvGet(ATTEMPTS_KEY);
    if (!raw) return { fails: 0, lockedUntil: 0 };
    const p = JSON.parse(raw) as Partial<AttemptState>;
    return { fails: Number(p.fails) || 0, lockedUntil: Number(p.lockedUntil) || 0 };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}

async function resetAttempts(): Promise<void> {
  await kvDelete(ATTEMPTS_KEY).catch(() => undefined);
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; fails: number; lockedUntil: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'no-pin' };

/** Check a PIN, honouring (and updating) the persisted cool-down. */
export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const attempts = await getAttempts();
  if (attempts.lockedUntil > now) return { ok: false, reason: 'locked', lockedUntil: attempts.lockedUntil };
  let stored: StoredPin | null = null;
  try {
    const raw = await SecureStore.getItemAsync(PIN_KEY);
    stored = raw ? (JSON.parse(raw) as StoredPin) : null;
  } catch {
    stored = null;
  }
  if (!stored) return { ok: false, reason: 'no-pin' };
  if (isValidPin(pin) && safeEqual(hashPin(pin, stored.salt, stored.r ?? STRETCH), stored.hash)) {
    await resetAttempts();
    return { ok: true };
  }
  const fails = attempts.fails + 1;
  const wait = lockoutMsFor(fails);
  const lockedUntil = wait ? now + wait : 0;
  await kvSet(ATTEMPTS_KEY, JSON.stringify({ fails, lockedUntil })).catch(() => undefined);
  return { ok: false, reason: 'wrong', fails, lockedUntil };
}

/* ---------------- biometrics / device credential ---------------- */

type LocalAuth = typeof import('expo-local-authentication');
let LA: LocalAuth | null | undefined;
function la(): LocalAuth | null {
  if (LA === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      LA = require('expo-local-authentication') as LocalAuth;
    } catch {
      LA = null;
    }
  }
  return LA;
}

export interface BiometricStatus {
  /** Fingerprint / face hardware present AND at least one enrolled. */
  biometrics: boolean;
  /** Human label for the button: "Fingerprint", "Face unlock", ... */
  label: string;
  /** The phone has some screen lock (PIN / pattern / password / biometric). */
  deviceSecure: boolean;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const m = la();
  if (!m) return { biometrics: false, label: 'Fingerprint', deviceSecure: false };
  try {
    const [hw, enrolled, level, types] = await Promise.all([
      m.hasHardwareAsync(),
      m.isEnrolledAsync(),
      m.getEnrolledLevelAsync(),
      m.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(m.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(m.AuthenticationType.FINGERPRINT);
    return {
      biometrics: hw && enrolled,
      label: finger || !face ? 'Fingerprint' : 'Face unlock',
      deviceSecure: level !== m.SecurityLevel.NONE,
    };
  } catch {
    return { biometrics: false, label: 'Fingerprint', deviceSecure: false };
  }
}

/** Fingerprint / face only (the app's own PIN is the fallback). */
export async function authenticateBiometric(promptMessage = 'Kissa kholo'): Promise<boolean> {
  const m = la();
  if (!m) return false;
  try {
    const r = await withAppLockPaused(() =>
      m.authenticateAsync({
        promptMessage,
        cancelLabel: 'PIN se kholo',
        disableDeviceFallback: true,
        requireConfirmation: false,
      }),
    );
    return r.success;
  } catch {
    return false;
  }
}

/** The phone's own screen lock (PIN / pattern / fingerprint) — used to reset a forgotten Kissa PIN. */
export async function authenticateDevice(promptMessage = 'Phone ke lock se pehchaan karo'): Promise<boolean> {
  const m = la();
  if (!m) return false;
  try {
    // The phone's lock screen opens as its own activity (app goes to background).
    const r = await withAppLockPaused(() =>
      m.authenticateAsync({ promptMessage, disableDeviceFallback: false, cancelLabel: 'Cancel' }),
    );
    return r.success;
  } catch {
    return false;
  }
}

/* ---------------- pause around system pickers ---------------- */

export { pauseAppLock, resumeAppLock, isAppLockPaused, withAppLockPaused } from './lockPause';
