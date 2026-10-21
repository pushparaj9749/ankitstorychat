/**
 * App Lock gate — covers the whole app with a PIN / fingerprint screen.
 *
 * - Locks on launch and when coming back from the background (after the
 *   chosen delay). The app stays mounted underneath, so unlocking is instant
 *   and nothing (chat drafts, scroll position) is lost.
 * - While the app is in the background / app switcher a plain cover hides the
 *   story text from the recent-apps thumbnail.
 * - Everything is on-device: the PIN hash lives in secure storage and the
 *   fingerprint check is done by the phone itself.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import {
  PIN_LENGTH,
  authenticateBiometric,
  authenticateDevice,
  clearPin,
  getAttempts,
  getBiometricStatus,
  hasPin,
  isAppLockPaused,
  shouldLockOnResume,
  verifyPin,
  type BiometricStatus,
} from '../lib/appLock';
import { lightBuzz, successBuzz, tapTick } from '../lib/haptics';
import { PinDots, PinKeypad, pinColorsFor } from './PinPad';
import { IconGlyph } from './iconGlyph';
import { KISSA_LOGO } from './brand';
import { INK, withAlpha } from '../theme';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useApp();
  const enabled = !!settings.appLockEnabled;
  const [locked, setLocked] = useState(enabled);
  const [covered, setCovered] = useState(false);
  const bgAt = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const delayRef = useRef(settings.appLockDelay);
  delayRef.current = settings.appLockDelay;

  // Turning the lock off (Settings) unlocks immediately; turning it on does
  // NOT lock right away — the user has just proved they know the PIN.
  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      setCovered(false);
    }
  }, [enabled]);

  // Safety net: lock enabled but no PIN stored (e.g. a backup restored on a
  // new phone) → switch the lock off instead of trapping the user.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void hasPin().then((ok) => {
      if (alive && !ok) {
        setLocked(false);
        void updateSettings({ appLockEnabled: false });
      }
    });
    return () => {
      alive = false;
    };
  }, [enabled, updateSettings]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (!enabledRef.current) return;
      if (state === 'background' || state === 'inactive') {
        if (isAppLockPaused()) return; // file picker / share sheet / system prompt
        if (state === 'background' && bgAt.current == null) bgAt.current = Date.now();
        setCovered(true);
      } else if (state === 'active') {
        if (shouldLockOnResume(bgAt.current, Date.now(), delayRef.current ?? 'immediate')) setLocked(true);
        bgAt.current = null;
        setCovered(false);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const showLock = enabled && locked;
  const showCover = enabled && covered && !locked;
  return (
    <View style={styles.root}>
      <View style={styles.root} importantForAccessibility={showLock ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {showCover ? <View style={[StyleSheet.absoluteFill, styles.cover]} testID="app-lock-cover" /> : null}
      {showLock ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
    </View>
  );
}

function formatWait(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} sec`;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { theme, settings, updateSettings } = useApp();
  const insets = useSafeAreaInsets();
  const colors = pinColorsFor(theme);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [bio, setBio] = useState<BiometricStatus | null>(null);
  const checking = useRef(false);
  const autoPrompted = useRef(false);
  const haptics = settings.haptics;

  const useBio = !!(settings.appLockBiometric && bio?.biometrics);
  const waiting = lockedUntil > now;

  useEffect(() => {
    let alive = true;
    void getBiometricStatus().then((s) => alive && setBio(s));
    void getAttempts().then((a) => alive && setLockedUntil(a.lockedUntil));
    return () => {
      alive = false;
    };
  }, []);

  // Countdown while cooling down after too many wrong PINs.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  const tryBiometric = useCallback(async () => {
    const ok = await authenticateBiometric('Kissa kholo');
    if (ok) {
      void successBuzz(haptics);
      onUnlock();
    }
  }, [haptics, onUnlock]);

  // Offer the fingerprint prompt by itself once, when the lock appears.
  useEffect(() => {
    if (!useBio || autoPrompted.current || AppState.currentState !== 'active') return;
    autoPrompted.current = true;
    const t = setTimeout(() => void tryBiometric(), 350);
    return () => clearTimeout(t);
  }, [useBio, tryBiometric]);

  const submit = useCallback(
    async (value: string) => {
      if (checking.current) return;
      checking.current = true;
      const r = await verifyPin(value);
      checking.current = false;
      if (r.ok) {
        void successBuzz(haptics);
        onUnlock();
        return;
      }
      void lightBuzz(haptics);
      setShakeKey((k) => k + 1);
      setPin('');
      if (r.reason === 'no-pin') {
        // Should not happen (gate switches the lock off) — never trap the user.
        void updateSettings({ appLockEnabled: false });
        onUnlock();
        return;
      }
      setNow(Date.now());
      setLockedUntil(r.lockedUntil);
      if (r.reason === 'wrong') {
        const left = 5 - r.fails;
        setError(r.lockedUntil ? 'Bahut baar galat PIN' : left <= 2 ? `Galat PIN — ${left} try aur, phir thoda rukna padega` : 'Galat PIN, phir se try karo');
      } else {
        setError('Bahut baar galat PIN');
      }
    },
    [haptics, onUnlock, updateSettings],
  );

  const onDigit = useCallback(
    (d: string) => {
      if (waiting || checking.current) return;
      void tapTick(haptics);
      setError(null);
      setPin((p) => {
        if (p.length >= PIN_LENGTH) return p;
        const next = p + d;
        if (next.length === PIN_LENGTH) setTimeout(() => void submit(next), 90);
        return next;
      });
    },
    [waiting, haptics, submit],
  );

  const onBack = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  const forgot = useCallback(async () => {
    const status = bio ?? (await getBiometricStatus());
    if (!status.deviceSecure) {
      Alert.alert(
        'PIN reset nahi ho sakta',
        'Is phone mein screen lock (PIN / pattern) set nahi hai, isliye Kissa tumhari pehchaan confirm nahi kar sakta.\n\nEk hi rasta hai: Phone Settings → Apps → Kissa → Storage → Clear data. Isse lock hat jayega, lekin is phone par saari chats aur settings bhi mit jayengi (backup ho to baad mein restore kar lena).',
      );
      return;
    }
    Alert.alert(
      'PIN bhool gaye?',
      'Phone ke apne screen lock (PIN / pattern / fingerprint) se pehchaan confirm karo. Uske baad Kissa ka lock band ho jayega — Settings mein naya PIN set kar lena.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Phone lock se kholo',
          onPress: () =>
            void (async () => {
              const ok = await authenticateDevice('Kissa ka PIN reset karo');
              if (!ok) return;
              await clearPin();
              await updateSettings({ appLockEnabled: false });
              onUnlock();
              Alert.alert('Lock band ho gaya', 'Settings → Privacy & Security mein jaakar naya PIN set kar lo.');
            })(),
        },
      ],
    );
  }, [bio, onUnlock, updateSettings]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.lock, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 18 }]}
      accessibilityViewIsModal
      testID="app-lock-screen"
    >
      <View style={styles.head}>
        <View style={[styles.logoRing, { borderColor: withAlpha(theme.accent, 0.35) }]}>
          <Image source={KISSA_LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.titleRow}>
          <IconGlyph name="lock-closed" size={16} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>Kissa locked hai</Text>
        </View>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          {useBio ? `${bio?.label ?? 'Fingerprint'} ya PIN se kholo` : 'Apna 4-digit PIN daalo'}
        </Text>
      </View>

      <PinDots filled={pin.length} colors={colors} error={!!error} shakeKey={shakeKey} />
      <Text style={[styles.error, { color: waiting ? theme.textDim : theme.danger }]} accessibilityLiveRegion="polite">
        {waiting ? `Bahut baar galat PIN. ${formatWait(lockedUntil - now)} baad try karo` : (error ?? ' ')}
      </Text>

      <PinKeypad
        colors={colors}
        onDigit={onDigit}
        onBackspace={onBack}
        disabled={waiting}
        leftAction={useBio ? { icon: 'finger-print', label: bio?.label ?? 'Fingerprint', onPress: () => void tryBiometric() } : null}
      />

      <Pressable onPress={() => void forgot()} style={styles.forgot} accessibilityRole="button" hitSlop={10}>
        <Text style={[styles.forgotText, { color: theme.textFaint }]}>PIN bhool gaye?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { backgroundColor: INK },
  lock: { backgroundColor: INK, alignItems: 'center', justifyContent: 'space-between', zIndex: 1000, elevation: 1000 },
  head: { alignItems: 'center' },
  logoRing: { width: 76, height: 76, borderRadius: 24, borderWidth: 1, padding: 6, marginBottom: 18 },
  logo: { width: '100%', height: '100%', borderRadius: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 14, marginTop: 6 },
  error: { fontSize: 13, minHeight: 18, textAlign: 'center', paddingHorizontal: 24, marginBottom: 6 },
  forgot: { paddingVertical: 10, marginTop: 6 },
  forgotText: { fontSize: 13.5, fontWeight: '600' },
});
