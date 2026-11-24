/**
 * Login — the app is account-gated from v2.14.
 *
 * Username + password only (no email is ever collected). Password recovery has
 * three no-email paths, all reachable from here: the one-time recovery code
 * from signup, a same-device reset, or a request the Kissa team approves.
 */
import React, { useEffect, useState } from 'react';
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
import { AccountError, login, SUPPORT_EMAIL } from '../lib/account';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function Login({ navigation }: Props) {
  const { theme, settings, setAccount, profile } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.nickname && !username) setUsername(profile.nickname.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valid = username.trim().length >= 3 && password.length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await login({ username, password }, settings?.contentApiBaseUrl);
      await setAccount(res.account);
      lightBuzz();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Login nahi ho paya. Dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]} showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Kissa" />
            <Text style={[styles.wordmark, { color: theme.textFaint }]}>
              {KISSA.wordmark} · {KISSA.tagline}
            </Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Apne account me aao</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Kissa ab account ke saath chalta hai. Tumhari purani kahaniyan, chats aur saves isi device par
            safe hain — login karte hi sab wahin milenge.
          </Text>

          <View style={[styles.card, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.soft]}>
            <Text style={[styles.label, { color: theme.textFaint }]}>USERNAME</Text>
            <TextInput
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              placeholder="jaise arjun_07"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface2 }]}
              accessibilityLabel="Username"
            />

            <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>PASSWORD</Text>
            <View style={[styles.passRow, { borderColor: theme.border, backgroundColor: theme.surface2 }]}>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                placeholder="Tumhara password"
                placeholderTextColor={theme.textFaint}
                style={[styles.passInput, { color: theme.text }]}
                accessibilityLabel="Password"
                onSubmitEditing={() => void submit()}
              />
              <Pressable
                onPress={() => setShow((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={show ? 'Hide password' : 'Show password'}
                hitSlop={10}
              >
                <Icon name={show ? 'lock-closed' : 'lock-closed-outline'} size={18} color={theme.textDim} />
              </Pressable>
            </View>

            {error ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <GradientButton
              title="Log in"
              onPress={() => void submit()}
              disabled={!valid}
              loading={busy}
              accessibilityLabel="Log in"
            />
          </View>

          <Pressable
            onPress={() => navigation.navigate('Signup')}
            accessibilityRole="button"
            style={styles.linkRow}
          >
            <Text style={[styles.linkText, { color: theme.textDim }]}>Naya account? </Text>
            <Text style={[styles.linkStrong, { color: theme.primary }]}>Account banao</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityRole="button"
            style={styles.linkRow}
          >
            <Text style={[styles.linkStrong, { color: theme.accent }]}>Password bhool gaye?</Text>
          </Pressable>

          <Text style={[styles.footer, { color: theme.textFaint }]}>
            Koi email nahi, koi OTP nahi — sirf username aur password. Help chahiye? {SUPPORT_EMAIL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: SPACING.page, paddingTop: SPACING.xxl },
  brand: { alignItems: 'center', gap: 8, marginBottom: SPACING.xl },
  logo: { width: 64, height: 64 },
  wordmark: { ...TYPE.caption, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { ...TYPE.display, marginBottom: 8 },
  sub: { ...TYPE.body, lineHeight: 22, marginBottom: SPACING.lg },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
  label: { ...TYPE.caption, letterSpacing: 1.4 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, height: SCALE.h2, ...TYPE.body },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: SCALE.h2,
    gap: 10,
  },
  passInput: { flex: 1, ...TYPE.body },
  error: { ...TYPE.caption, marginTop: SPACING.xs },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  linkText: { ...TYPE.body },
  linkStrong: { ...TYPE.body, fontWeight: '700' },
  footer: { ...TYPE.caption, textAlign: 'center', marginTop: SPACING.xl, lineHeight: 18 },
});
