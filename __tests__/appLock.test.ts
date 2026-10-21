/**
 * App Lock (v2.9.0): SHA-256, salted PIN hashing, persisted wrong-PIN
 * cool-down, resume-lock timing, the picker pause, and biometric helpers.
 */
const secure = new Map<string, string>();
const kv = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'wutdo',
  getItemAsync: jest.fn(async (k: string) => secure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void secure.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void secure.delete(k)),
}));
jest.mock('../src/lib/db', () => ({
  kvGet: jest.fn(async (k: string) => kv.get(k) ?? null),
  kvSet: jest.fn(async (k: string, v: string) => void kv.set(k, v)),
  kvDelete: jest.fn(async (k: string) => void kv.delete(k)),
}));
const la = {
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  getEnrolledLevelAsync: jest.fn(async () => 3),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  authenticateAsync: jest.fn(async (_o: unknown) => ({ success: true })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
};
jest.mock('expo-local-authentication', () => la);

import { sha256Hex } from '../src/lib/sha256';
import {
  LOCK_DELAY_MS,
  authenticateBiometric,
  authenticateDevice,
  clearPin,
  getBiometricStatus,
  hasPin,
  hashPin,
  isValidPin,
  lockoutMsFor,
  safeEqual,
  savePin,
  shouldLockOnResume,
  verifyPin,
} from '../src/lib/appLock';
import { isAppLockPaused, pauseAppLock, resumeAppLock, withAppLockPaused } from '../src/lib/lockPause';
import * as fs from 'fs';
import * as path from 'path';

beforeEach(() => {
  secure.clear();
  kv.clear();
  resumeAppLock();
});

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ])('matches the standard vector for %j', (input, hex) => {
    expect(sha256Hex(input)).toBe(hex);
  });

  it('handles multi-block and non-ASCII input', () => {
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(sha256Hex('किस्सा')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('किस्सा')).not.toBe(sha256Hex('kissa'));
  });
});

describe('PIN rules & hashing', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
    for (const bad of ['123', '12345', '12a4', '', ' 1234']) expect(isValidPin(bad)).toBe(false);
  });

  it('salts the hash (same PIN, different salt → different hash) and is deterministic', () => {
    expect(hashPin('1234', 's1')).toBe(hashPin('1234', 's1'));
    expect(hashPin('1234', 's1')).not.toBe(hashPin('1234', 's2'));
    expect(hashPin('1234', 's1')).not.toBe(hashPin('1235', 's1'));
  });

  it('safeEqual compares strings', () => {
    expect(safeEqual('abcd', 'abcd')).toBe(true);
    expect(safeEqual('abcd', 'abce')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('never stores the PIN itself', async () => {
    await savePin('4821');
    const stored = [...secure.values()].join('|');
    expect(stored).not.toContain('4821');
    expect(JSON.parse(stored)).toEqual({ v: 1, salt: expect.any(String), hash: expect.stringMatching(/^[0-9a-f]{64}$/), r: expect.any(Number) });
    expect(await hasPin()).toBe(true);
  });

  it('rejects an invalid PIN on save', async () => {
    await expect(savePin('12')).rejects.toThrow();
    expect(await hasPin()).toBe(false);
  });
});

describe('verifyPin + cool-down', () => {
  it('unlocks with the right PIN and resets the counter', async () => {
    await savePin('2580');
    expect(await verifyPin('1111')).toMatchObject({ ok: false, reason: 'wrong', fails: 1, lockedUntil: 0 });
    expect(await verifyPin('2580')).toEqual({ ok: true });
    expect(await verifyPin('1111')).toMatchObject({ fails: 1 });
  });

  it('cool-down schedule: free for 4 misses, 30 s at the 5th, doubling, capped at 15 min', () => {
    expect([1, 2, 3, 4].map(lockoutMsFor)).toEqual([0, 0, 0, 0]);
    expect(lockoutMsFor(5)).toBe(30_000);
    expect(lockoutMsFor(6)).toBe(60_000);
    expect(lockoutMsFor(7)).toBe(120_000);
    expect(lockoutMsFor(50)).toBe(15 * 60_000);
  });

  it('blocks even the right PIN while cooling down, and the block survives a restart (persisted)', async () => {
    await savePin('2580');
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) await verifyPin('0000', t0);
    const fifth = await verifyPin('0000', t0);
    expect(fifth).toMatchObject({ ok: false, reason: 'wrong', fails: 5, lockedUntil: t0 + 30_000 });
    expect(await verifyPin('2580', t0 + 10_000)).toMatchObject({ ok: false, reason: 'locked' });
    expect(JSON.parse(kv.get('appLock.attempts')!)).toMatchObject({ fails: 5 });
    expect(await verifyPin('2580', t0 + 30_001)).toEqual({ ok: true });
  });

  it('reports no-pin when nothing is stored (gate then switches the lock off)', async () => {
    expect(await verifyPin('1234')).toEqual({ ok: false, reason: 'no-pin' });
  });

  it('clearPin removes the PIN and the counter', async () => {
    await savePin('2580');
    await verifyPin('0000');
    await clearPin();
    expect(await hasPin()).toBe(false);
    expect(kv.has('appLock.attempts')).toBe(false);
  });
});

describe('when to lock', () => {
  it('locks on resume according to the delay', () => {
    expect(shouldLockOnResume(null, 10_000, 'immediate')).toBe(false);
    expect(shouldLockOnResume(10_000, 10_001, 'immediate')).toBe(true);
    expect(shouldLockOnResume(0, LOCK_DELAY_MS['1m'] - 1, '1m')).toBe(false);
    expect(shouldLockOnResume(0, LOCK_DELAY_MS['1m'], '1m')).toBe(true);
    expect(shouldLockOnResume(0, 4 * 60_000, '5m')).toBe(false);
    expect(shouldLockOnResume(0, 5 * 60_000, '5m')).toBe(true);
  });

  it('pauses around system pickers / share sheet', async () => {
    expect(isAppLockPaused()).toBe(false);
    pauseAppLock(1000);
    expect(isAppLockPaused()).toBe(true);
    resumeAppLock();
    expect(isAppLockPaused()).toBe(false);
    jest.useFakeTimers();
    let during = false;
    const p = withAppLockPaused(async () => {
      during = isAppLockPaused();
      return 7;
    });
    await expect(p).resolves.toBe(7);
    expect(during).toBe(true);
    expect(isAppLockPaused()).toBe(true); // still paused while the app comes back
    jest.advanceTimersByTime(1600);
    expect(isAppLockPaused()).toBe(false);
    jest.useRealTimers();
  });

  it('backup share, backup import and image picker are wrapped in the pause', () => {
    const root = path.join(__dirname, '..', 'src', 'lib');
    const backup = fs.readFileSync(path.join(root, 'backup.ts'), 'utf8');
    const picker = fs.readFileSync(path.join(root, 'imagePicker.ts'), 'utf8');
    expect(backup).toMatch(/withAppLockPaused\(\(\) =>\s*Sharing\.shareAsync/);
    expect(backup).toMatch(/withAppLockPaused\(\(\) => DocumentPicker\.getDocumentAsync/);
    expect(picker).toMatch(/withAppLockPaused\(\(\) =>\s*DocumentPicker\.getDocumentAsync/);
  });
});

describe('biometrics', () => {
  it('reports fingerprint availability and a secure device', async () => {
    expect(await getBiometricStatus()).toEqual({ biometrics: true, label: 'Fingerprint', deviceSecure: true });
  });

  it('labels face-only phones and detects a phone with no screen lock', async () => {
    la.supportedAuthenticationTypesAsync.mockResolvedValueOnce([2]);
    la.isEnrolledAsync.mockResolvedValueOnce(false);
    la.getEnrolledLevelAsync.mockResolvedValueOnce(0);
    expect(await getBiometricStatus()).toEqual({ biometrics: false, label: 'Face unlock', deviceSecure: false });
  });

  it('fingerprint unlock disables the device-PIN fallback; PIN reset uses the device credential', async () => {
    expect(await authenticateBiometric()).toBe(true);
    expect(la.authenticateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ disableDeviceFallback: true });
    expect(await authenticateDevice()).toBe(true);
    expect(la.authenticateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ disableDeviceFallback: false });
  });

  it('a failed / thrown prompt never unlocks', async () => {
    la.authenticateAsync.mockResolvedValueOnce({ success: false });
    expect(await authenticateBiometric()).toBe(false);
    la.authenticateAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await authenticateDevice()).toBe(false);
  });
});
