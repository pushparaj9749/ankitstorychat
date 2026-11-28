/**
 * Welcome — the front door.
 *
 * v2.15 made login + signup one screen; the layout that came with it was
 * cramped and, worse, BROKEN: every input was `height: SCALE.h2` (22px), so the
 * username and password a user typed were clipped out of view. This rewrite
 * fixes that at the root (see components/Field) and rebuilds the screen around
 * one idea: a story app's front door should feel like a cinema ticket, not an
 * HR portal.
 *
 * v2.17.0 — poster front door.
 *
 * The form was readable but plain: a dark card on a dark screen, indistinguishable
 * from any account wall. This is a story app, so the front door now opens on the
 * street the stories happen in — a bundled poster (assets/login-poster.jpg,
 * Mumbai lane at 2 AM) with the form docked on it as one frosted-glass panel.
 *
 * Kept intact on purpose:
 *   - `components/Field` is still the only input implementation. It exists
 *     because inputs sized from a TYPE token (`height: SCALE.h2` = 22) clipped
 *     the value out of view; that regression must never return.
 *   - the CTA stays pinned above the keyboard (safe-area aware),
 *   - inline single-line validation, no error wall,
 *   - the build stamp at the bottom, so a screenshot identifies the build.
 *
 * Backend, validation, recovery codes and everything after signup are
 * unchanged — this is only the front door.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { Field } from '../components/Field';
import { Icon } from '../components/icons';
import { KISSA_LOGO, LOGIN_POSTER } from '../components/brand';
import { KISSA, LAYOUT, RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import {
  AccountError,
  login,
  signup,
  validatePassword,
  validateUsername,
  SUPPORT_EMAIL,
} from '../lib/account';
import { buildStamp } from '../lib/appVersion';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type Mode = 'signup' | 'login';

/**
 * The poster is photographic and always dark, so this screen does not follow the
 * theme's light/dark switch — every value here is chosen against the poster.
 */
const GLASS = {
  panel: 'rgba(10, 11, 16, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.14)',
  tabIdle: 'rgba(255, 255, 255, 0.06)',
  text: '#F7F8FB',
  textDim: '#C3C7D2',
  textFaint: '#8A8F9E',
  accent: '#F58AA5',
  rose: '#F0567E',
} as const;

export function Login({ navigation }: Props) {
  const { theme, settings, setAccount, profile, refreshStories } = useApp();
  // Screen() does not claim the bottom edge, and the CTA bar is pinned there.
  const insets = useSafeAreaInsets();
  // Printed on screen so a screenshot says exactly which build drew it.
  const stamp = buildStamp();
  const [mode, setMode] = useState<Mode>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const cleanUser = username.trim().toLowerCase();
  const userError = useMemo(
    () => (mode === 'signup' && cleanUser ? validateUsername(cleanUser) : null),
    [cleanUser, mode],
  );
  const passError = useMemo(
    () => (mode === 'signup' && password ? validatePassword(password, cleanUser) : null),
    [password, cleanUser, mode],
  );
  const confirmError = mode === 'signup' && confirm && confirm !== password ? 'Dono password same nahi hain.' : null;

  const valid =
    mode === 'signup'
      ? !userError && !passError && !confirmError && !!cleanUser && !!password && !!confirm
      : cleanUser.length >= 3 && password.length > 0;

  function switchMode(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
    setError(null);
    setConfirm('');
    lightBuzz();
  }

  async function go() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await login({ username: cleanUser, password }, settings?.contentApiBaseUrl);
        await setAccount(res.account);
        lightBuzz();
        return;
      }
      const res = await signup(
        {
          username: cleanUser,
          password,
          displayName: profile?.nickname?.trim() || cleanUser,
        },
        settings?.contentApiBaseUrl,
      );
      setRecoveryCode(res.recoveryCode);
      setSaved(false);
      lightBuzz();
    } catch (e) {
      if (e instanceof AccountError) {
        // A taken name is the one error worth answering on the spot.
        if (e.code === 'username_taken') {
          setError('Ye username le liya gaya hai — koi doosra chuno.');
        } else {
          setError(e.message);
        }
      } else {
        setError('Network me dikkat hai. Internet check karke dobara try karo.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(recoveryCode);
    setCopied(true);
    lightBuzz();
  }

  async function finish() {
    if (!saved) return;
    const { cachedAccount } = await import('../lib/account');
    await setAccount(await cachedAccount());
    await refreshStories();
  }

  /* ---------- step 2: the recovery code (only after a signup) ---------- */
  if (recoveryCode) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Kissa" />
            <Text style={[styles.wordmark, { color: theme.textFaint }]}>{KISSA.wordmark} · {KISSA.tagline}</Text>
          </View>

          <Text style={[styles.kicker, { color: theme.gold }]}>EK AAKHRI CHEEZ</Text>
          <Text style={[styles.title, { color: theme.text }]}>Apna recovery code sambhalo</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Kissa me koi email nahi hota, isliye password bhoolne par yahi code tumhara account wapas dilata hai.
            Ye sirf ab dikh raha hai — hum ise dobara nahi dikha sakte.
          </Text>

          <View style={[styles.codeCard, { backgroundColor: withAlpha(theme.gold, 0.07), borderColor: withAlpha(theme.gold, 0.32) }]}>
            <Text style={[styles.codeCaption, { color: theme.textFaint }]}>RECOVERY CODE</Text>
            <Text style={[styles.code, { color: theme.text }]} selectable accessibilityLabel="Recovery code">
              {recoveryCode}
            </Text>
            <Pressable
              onPress={() => void copyCode()}
              accessibilityRole="button"
              accessibilityLabel="Copy recovery code"
              style={[styles.copyBtn, { backgroundColor: withAlpha(theme.gold, 0.14), borderColor: withAlpha(theme.gold, 0.3) }]}
            >
              <Icon name={copied ? 'checkmark-circle' : 'document-text'} size={16} color={theme.gold} />
              <Text style={[styles.copyText, { color: theme.gold }]}>{copied ? 'Copy ho gaya' : 'Copy karo'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.bullets, { color: theme.textDim }]}>
            • Kahan rakhein: notes app, screenshot, ya kagaz par likh lo.{'\n'}
            • Isi phone par password bhoolne par code ke bina bhi reset ho sakta hai.{'\n'}
            • Kisi ko na dena — jise ye milega wo account le sakta hai.
          </Text>

          <Pressable
            onPress={() => {
              lightBuzz();
              setSaved((v) => !v);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saved }}
            style={[styles.checkRow, { borderColor: saved ? withAlpha(theme.success, 0.4) : theme.border }, saved && { backgroundColor: withAlpha(theme.success, 0.07) }]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: saved ? theme.success : theme.textFaint,
                  backgroundColor: saved ? withAlpha(theme.success, 0.2) : 'transparent',
                },
              ]}
            >
              {saved ? <Icon name="checkmark" size={14} color={theme.success} /> : null}
            </View>
            <Text style={[styles.checkText, { color: theme.text }]}>Maine code save kar liya hai</Text>
          </Pressable>

          <GradientButton title="Shuru karo" onPress={() => void finish()} disabled={!saved} accessibilityLabel="Finish signup" />
        </ScrollView>
      </Screen>
    );
  }

  /* ---------- the front door ---------- */
  const isSignup = mode === 'signup';
  const heroTitle = isSignup ? 'Apni kahani' : 'Wapas aa gaye';

  return (
    // poster-cover-exempt: decorative full-bleed background, not story artwork.
    // A background must fill the screen; NaturalImage's contain rule protects
    // covers the reader recognises, which this is not.
    <ImageBackground source={LOGIN_POSTER} style={styles.flex} resizeMode="cover">
      {/* Scrim: the poster stays the star, the text stays readable. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.scrimTop} />
        <View style={styles.scrimBottom} />
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={[styles.flex, { paddingTop: insets.top + 10 }]}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Wordmark floats on the artwork, no logo tile — the poster is the brand story. */}
          <View style={styles.brandRow}>
            <Text style={styles.wordmark}>KISSA</Text>
            <View style={styles.wordmarkRule} />
            <Text style={styles.tagline}>{KISSA.tagline}</Text>
          </View>

          <Text style={styles.hero} accessibilityRole="header">
            {heroTitle}
            {'\n'}
            <Text style={styles.heroAccent}>{isSignup ? 'shuru karo' : ''}</Text>
          </Text>
          <Text style={styles.heroSub}>
            {isSignup
              ? 'Bas username aur password. Koi email, koi OTP nahi.'
              : 'Username aur password daalo — sab kuch wahin milega jahan chhoda tha.'}
          </Text>
        </ScrollView>

        {/* ---- the glass panel: docked to the bottom, rounded top only ---- */}
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
          <View style={styles.grabber} />

          <View style={styles.tabs}>
            {(['signup', 'login'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={m === 'signup' ? 'Naya account' : 'Log in'}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                    {m === 'signup' ? 'Naya account' : 'Log in'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Plain View, NOT a ScrollView: Android ka ScrollView TextInput ka
              touch kha jaata hai aur keyboard khulta hi nahi (v2.17.0 bug).
              Fields yahan seedhe hain, isliye tap focus hota hai. */}
          <View style={styles.form}>
            <Field
              label="Username"
              value={username}
              onChangeText={(t) => {
                setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                setError(null);
              }}
              placeholder={isSignup ? 'arjun_07' : 'tumhara username'}
              prefix="@"
              error={isSignup ? userError : null}
              hint={isSignup ? '3-20 characters · a-z, 0-9, _' : undefined}
              inputRef={passRef}
              inputProps={{
                autoComplete: 'username',
                maxLength: 20,
                returnKeyType: 'next',
                onSubmitEditing: () => passRef.current?.focus(),
                submitBehavior: 'submit',
              }}
            />

            <Field
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder={isSignup ? 'kam se kam 8 characters' : 'tumhara password'}
              secret={{ shown: show, onToggle: () => setShow((v) => !v) }}
              error={isSignup ? passError : null}
              hint={isSignup ? 'Ek letter aur ek number zaroori hai' : undefined}
              inputRef={isSignup ? confirmRef : undefined}
              inputProps={{
                autoComplete: isSignup ? 'new-password' : 'current-password',
                returnKeyType: isSignup ? 'next' : 'go',
                onSubmitEditing: () => (isSignup ? confirmRef.current?.focus() : void go()),
                submitBehavior: 'submit',
              }}
            />

            {isSignup ? (
              <Field
                label="Password dobara"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="wahi password, ek baar aur"
                secret={{ shown: show, onToggle: () => setShow((v) => !v) }}
                error={confirmError}
                inputProps={{ autoComplete: 'new-password', returnKeyType: 'go', onSubmitEditing: () => void go() }}
              />
            ) : null}

            {error ? (
              <View style={styles.errorRow}>
                <Icon name="alert-circle" size={16} color={GLASS.accent} />
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              </View>
            ) : null}

            {!isSignup ? (
              <Pressable onPress={() => navigation.navigate('ForgotPassword')} accessibilityRole="button" style={styles.linkRow}>
                <Text style={styles.link}>Password bhool gaye?</Text>
              </Pressable>
            ) : null}
          </View>

          <GradientButton
            title={isSignup ? 'Account banao' : 'Log in'}
            onPress={() => void go()}
            disabled={!valid}
            loading={busy}
            accessibilityLabel={isSignup ? 'Create account' : 'Log in'}
          />

          <Text style={styles.footer}>
            Sab kuch isi phone par safe hai · koi email, koi OTP nahi
            {'\n'}
            <Text style={styles.footerFaint}>
              Help: {SUPPORT_EMAIL} · {stamp}
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: SPACING.page, paddingTop: 14, paddingBottom: SPACING.xxl },

  /* Poster scrims: darken top (headline) and bottom (panel), keep the middle neon. */
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '60%',
    backgroundColor: 'rgba(6,7,10,0.55)',
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: 'rgba(6,7,10,0.72)',
  },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  wordmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 4.2 },
  wordmarkRule: { width: 26, height: 1, backgroundColor: GLASS.accent, opacity: 0.8 },
  tagline: { color: GLASS.textFaint, fontSize: 10, letterSpacing: 1.7, fontWeight: '700' },

  hero: { color: '#FFFFFF', fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1.4 },
  heroAccent: { color: GLASS.accent, fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1.4 },
  heroSub: { color: GLASS.textDim, fontSize: 14, lineHeight: 21, marginTop: 12, maxWidth: 320 },

  /* ---- glass panel ---- */
  panel: {
    backgroundColor: GLASS.panel,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: GLASS.panelEdge,
    paddingHorizontal: SPACING.page,
    paddingTop: 10,
    gap: 13,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: GLASS.tabIdle,
    borderRadius: RADIUS.pill,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: 'rgba(240, 86, 126, 0.22)', borderColor: 'rgba(245, 138, 165, 0.55)' },
  tabText: { color: GLASS.textFaint, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  tabTextActive: { color: '#FFFFFF' },

  form: { gap: 12, paddingTop: 2 },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 138, 165, 0.45)',
    backgroundColor: 'rgba(240, 86, 126, 0.14)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { ...TYPE.caption, color: '#FFD9E2', fontSize: 12, lineHeight: 17, flex: 1 },
  linkRow: { alignItems: 'center', paddingVertical: 6 },
  link: { color: GLASS.accent, fontSize: 13, fontWeight: '700' },

  footer: { color: GLASS.textFaint, fontSize: 10.5, lineHeight: 16, textAlign: 'center', letterSpacing: 0.2 },
  footerFaint: { color: 'rgba(255,255,255,0.34)' },

  /* ---- recovery-code step (same poster, one card) ---- */
  brandRowPlain: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.lg },
  logo: { width: 54, height: 54 },
  logoWordmark: { ...TYPE.overline, fontSize: 10.5, letterSpacing: 1.8 },
  kicker: { ...TYPE.overline, letterSpacing: 1.6, marginBottom: 8 },
  title: { ...TYPE.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.8, marginBottom: 8 },
  sub: { ...TYPE.body, fontSize: 14.5, lineHeight: 21, marginBottom: SPACING.lg },
  codeCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: 12, marginBottom: SPACING.lg },
  codeCaption: { ...TYPE.overline, fontSize: 10, letterSpacing: 1.5 },
  code: { ...TYPE.title, fontSize: 24, letterSpacing: 3, fontWeight: '700' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 16 },
  copyText: { ...TYPE.caption, fontWeight: '700' },
  bullets: { ...TYPE.caption, fontSize: 12, lineHeight: 20, marginBottom: SPACING.lg },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: SPACING.lg,
  },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkText: { ...TYPE.body, fontSize: 14 },
});
