/**
 * Welcome — ONE screen for both login and signup (v2.15).
 *
 * Before this, a new reader landed on a Login screen that said "Log in", had to
 * find the small "Naya account? Account banao" link, and then retype everything
 * on a second screen. Most people bounced, and it read like a corporate login
 * wall on a story app.
 *
 * Now the screen opens on "Naya account" with three fields (username, password,
 * password again) and a single tap. Existing readers switch the tab to "Log in"
 * (two fields). The backend, recovery flow and everything after signup are
 * unchanged — this is only the front door.
 */
import React, { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { Icon } from '../components/icons';
import { KISSA_LOGO } from '../components/brand';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha, KISSA } from '../theme';
import {
  AccountError,
  login,
  signup,
  validatePassword,
  validateUsername,
  SUPPORT_EMAIL,
} from '../lib/account';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type Mode = 'signup' | 'login';

const KEEP_SIGNED_IN_NOTE = 'Tumhari purani kahaniyan, chats aur saves isi phone par safe hain.';

export function Login({ navigation }: Props) {
  const { theme, settings, setAccount, profile, refreshStories } = useApp();
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
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}>
          <Text style={[styles.kicker, { color: theme.gold }]}>EK AAKHRI CHEEZ</Text>
          <Text style={[styles.title, { color: theme.text }]}>Apna recovery code sambhalo</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Kissa me koi email nahi hota, isliye password bhoolne par yahi code tumhara account wapas
            dilata hai. Ye sirf ab dikh raha hai — hum ise dobara nahi dikha sakte.
          </Text>

          <View style={[styles.codeCard, { backgroundColor: withAlpha(theme.gold, 0.08), borderColor: withAlpha(theme.gold, 0.4) }]}>
            <Text style={[styles.code, { color: theme.text }]} selectable accessibilityLabel="Recovery code">
              {recoveryCode}
            </Text>
            <Pressable onPress={() => void copyCode()} accessibilityRole="button" style={styles.copyRow}>
              <Icon name={copied ? 'checkmark-circle-outline' : 'document-text-outline'} size={16} color={theme.accent} />
              <Text style={[styles.copyText, { color: theme.accent }]}>{copied ? 'Copy ho gaya' : 'Copy karo'}</Text>
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
            style={styles.checkRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: saved ? theme.success : theme.border,
                  backgroundColor: saved ? withAlpha(theme.success, 0.18) : 'transparent',
                },
              ]}
            >
              {saved ? <Icon name="checkmark" size={14} color={theme.success} /> : null}
            </View>
            <Text style={[styles.checkText, { color: theme.text }]}>Maine code save kar liya hai</Text>
          </Pressable>

          <GradientButton
            title="Shuru karo"
            onPress={() => void finish()}
            disabled={!saved}
            accessibilityLabel="Finish signup"
          />
        </ScrollView>
      </Screen>
    );
  }

  /* ---------- the front door ---------- */
  const isSignup = mode === 'signup';
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Kissa" />
            <Text style={[styles.wordmark, { color: theme.textFaint }]}>
              {KISSA.wordmark} · {KISSA.tagline}
            </Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            {isSignup ? 'Apni kahani shuru karo' : 'Wapas aa gaye'}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            {isSignup
              ? 'Bas ek username aur password. Koi email, koi OTP nahi.'
              : 'Username aur password daalo — sab kuch wahin milega jahan chhoda tha.'}
          </Text>

          <View style={[styles.tabs, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
            {(['signup', 'login'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tab,
                    active && { backgroundColor: withAlpha(theme.primary, 0.16), borderColor: withAlpha(theme.primary, 0.5) },
                  ]}
                >
                  <Text style={[styles.tabText, { color: active ? theme.text : theme.textDim }]}>
                    {m === 'signup' ? 'Naya account' : 'Log in'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.card, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.soft]}>
            <Text style={[styles.label, { color: theme.textFaint }]}>USERNAME</Text>
            <View style={[styles.inputRow, { borderColor: userError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}>
              <Text style={[styles.at, { color: theme.textFaint }]}>@</Text>
              <TextInput
                value={username}
                onChangeText={(t) => {
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={20}
                placeholder={isSignup ? 'arjun_07' : 'tumhara username'}
                placeholderTextColor={theme.textFaint}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="Username"
                returnKeyType="next"
              />
            </View>
            {isSignup ? (
              <Text style={[styles.hint, { color: userError ? theme.danger : theme.textFaint }]}>
                {userError ?? '3-20 characters, sirf a-z, 0-9 aur _'}
              </Text>
            ) : null}

            <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>PASSWORD</Text>
            <View style={[styles.inputRow, { borderColor: passError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'kam se kam 8 characters' : 'tumhara password'}
                placeholderTextColor={theme.textFaint}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="Password"
                onSubmitEditing={() => (isSignup ? undefined : void go())}
              />
              <Pressable
                onPress={() => setShow((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={show ? 'Hide password' : 'Show password'}
              >
                <Icon name={show ? 'lock-closed' : 'lock-closed-outline'} size={18} color={theme.textDim} />
              </Pressable>
            </View>
            {isSignup ? (
              <Text style={[styles.hint, { color: passError ? theme.danger : theme.textFaint }]}>
                {passError ?? 'Ek letter aur ek number zaroori hai'}
              </Text>
            ) : null}

            {isSignup ? (
              <>
                <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>PASSWORD DOBARA</Text>
                <View style={[styles.inputRow, { borderColor: confirmError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}>
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { color: theme.text }]}
                    accessibilityLabel="Confirm password"
                  />
                </View>
                {confirmError ? <Text style={[styles.hint, { color: theme.danger }]}>{confirmError}</Text> : null}
              </>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: SPACING.md }}>
              <GradientButton
                title={isSignup ? 'Account banao' : 'Log in'}
                onPress={() => void go()}
                disabled={!valid}
                loading={busy}
                accessibilityLabel={isSignup ? 'Create account' : 'Log in'}
              />
            </View>
          </View>

          {!isSignup ? (
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              style={styles.linkRow}
            >
              <Text style={[styles.linkStrong, { color: theme.accent }]}>Password bhool gaye?</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.footer, { color: theme.textFaint }]}>
            {KEEP_SIGNED_IN_NOTE}
            {'\n'}Koi email nahi, koi OTP nahi. Help: {SUPPORT_EMAIL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: SPACING.page, paddingTop: SPACING.xxl },
  kicker: { ...TYPE.caption, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 },
  brand: { alignItems: 'center', gap: 8, marginBottom: SPACING.lg },
  logo: { width: 60, height: 60 },
  wordmark: { ...TYPE.caption, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { ...TYPE.display, marginBottom: 8 },
  sub: { ...TYPE.body, lineHeight: 22, marginBottom: SPACING.md },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 4,
    gap: 4,
    marginBottom: SPACING.md,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'transparent' },
  tabText: { ...TYPE.body, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.xs },
  label: { ...TYPE.caption, letterSpacing: 1.4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: SCALE.h2,
    gap: 10,
  },
  at: { ...TYPE.body, fontWeight: '700' },
  input: { flex: 1, ...TYPE.body },
  hint: { ...TYPE.caption, marginTop: 2 },
  error: { ...TYPE.caption, marginTop: SPACING.sm },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  linkStrong: { ...TYPE.body, fontWeight: '700' },
  footer: { ...TYPE.caption, textAlign: 'center', marginTop: SPACING.xl, lineHeight: 18 },
  codeCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: 10, marginVertical: SPACING.md },
  code: { ...TYPE.title, letterSpacing: 2 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyText: { ...TYPE.caption, fontWeight: '700' },
  bullets: { ...TYPE.caption, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: SPACING.lg },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkText: { ...TYPE.body },
});
