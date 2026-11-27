/**
 * Forgot password — the three no-email ways back in.
 *
 *   1. Recovery code (from signup, or issued by the team) → new password.
 *   2. This device is still signed in → reset without the old password.
 *   3. Neither works → ask the team (username + one submission id), an admin
 *      approves it and shares a one-time code.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { LAYOUT, RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import {
  AccountError,
  SUPPORT_EMAIL,
  getToken,
  requestRecovery,
  resetOnThisDevice,
  resetWithRecoveryCode,
  validatePassword,
} from '../lib/account';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

type Mode = 'code' | 'device' | 'support';

export function ForgotPassword({ navigation }: Props) {
  const { theme, settings, setAccount, account } = useApp();
  const apiBase = settings?.contentApiBaseUrl;
  const [mode, setMode] = useState<Mode>('code');
  const [username, setUsername] = useState(account?.username ?? '');
  const [code, setCode] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean>(!!account);

  React.useEffect(() => {
    void getToken().then((t) => setHasSession(!!t || !!account));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const passError = password ? validatePassword(password, username.trim().toLowerCase()) : null;
  const confirmError = confirm && confirm !== password ? 'Dono password same nahi hain.' : null;

  async function reset() {
    if (busy || passError || confirmError || !password || !username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await resetWithRecoveryCode(
        {
          username: username.trim().toLowerCase(),
          recoveryCode: code.trim().toUpperCase(),
          newPassword: password,
        },
        apiBase,
      );
      setDone(`Password badal gaya. Tumhara naya recovery code: ${res.recoveryCode}\n\nIse abhi save kar lo — dobara nahi dikhega.`);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Reset nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function deviceReset() {
    if (busy || passError || confirmError || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await resetOnThisDevice(password, apiBase);
      setDone(`Password badal gaya. Tumhara naya recovery code: ${res.recoveryCode}\n\nIse abhi save kar lo.`);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Reset nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function askSupport() {
    if (busy || !username.trim() || !submissionId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestRecovery(
        { username: username.trim().toLowerCase(), submissionId: submissionId.trim() },
        apiBase,
      );
      setDone(
        `Request chali gayi hai. Kissa team verify karke ek one-time code bhejegi. ` +
          `Jaldi chahiye? ${SUPPORT_EMAIL} par likh do.`,
      );
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Request nahi ja payi.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}>
          <Text style={[styles.title, { color: theme.text }]}>Ho gaya</Text>
          <View style={[styles.card, { backgroundColor: withAlpha(theme.success, 0.1), borderColor: withAlpha(theme.success, 0.4) }]}>
            <Text style={[styles.body, { color: theme.text }]} selectable>
              {done}
            </Text>
          </View>
          <GradientButton
            title="Login par jao"
            onPress={() => {
              void setAccount(null);
              navigation.replace('Login');
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  const tab = (m: Mode, label: string, enabled = true) => (
    <Pressable
      key={m}
      onPress={() => {
        setMode(m);
        setError(null);
      }}
      disabled={!enabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === m }}
      style={[
        styles.tab,
        {
          backgroundColor: mode === m ? withAlpha(theme.primary, 0.18) : 'transparent',
          borderColor: mode === m ? withAlpha(theme.primary, 0.5) : theme.border,
          opacity: enabled ? 1 : 0.4,
        },
      ]}
    >
      <Text style={[styles.tabText, { color: mode === m ? theme.text : theme.textDim }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}>
          <Text style={[styles.kicker, { color: theme.gold }]}>KOI EMAIL NAHI</Text>
          <Text style={[styles.title, { color: theme.text }]}>Account wapas lo</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Kissa me email nahi hota, isliye teen raaste hain. Jo tumhare paas hai wahi chuno.
          </Text>

          <View style={styles.tabs}>
            {tab('code', 'Recovery code')}
            {tab('device', 'Isi device se', hasSession)}
            {tab('support', 'Team se help')}
          </View>

          {mode !== 'device' ? (
            <>
              <Text style={[styles.label, { color: theme.textFaint }]}>USERNAME</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="arjun_07"
                placeholderTextColor={theme.textFaint}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface2 }]}
                textAlignVertical="center"
                accessibilityLabel="Username"
              />
            </>
          ) : (
            <Text style={[styles.sub, { color: theme.textDim }]}>
              Tum is device par already logged in ho, isliye purana password bhoolne par bhi naya set kar
              sakte ho. Baaki devices log out ho jayenge.
            </Text>
          )}

          {mode === 'code' ? (
            <>
              <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>RECOVERY CODE</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={theme.textFaint}
                style={[styles.input, styles.code, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface2 }]}
                accessibilityLabel="Recovery code"
              />
            </>
          ) : null}

          {mode === 'support' ? (
            <>
              <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>EK SUBMISSION ID</Text>
              <TextInput
                value={submissionId}
                onChangeText={setSubmissionId}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="idea_… / story_…"
                placeholderTextColor={theme.textFaint}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface2 }]}
                accessibilityLabel="Submission id"
              />
              <Text style={[styles.hint, { color: theme.textFaint }]}>
                Jo ID tumne submit ki thi (My Submissions me dikhti hai). Isse team confirm karti hai ki
                account tumhara hai.
              </Text>
            </>
          ) : null}

          {mode !== 'support' ? (
            <>
              <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>NAYA PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: theme.text, borderColor: passError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}
                accessibilityLabel="New password"
              />
              {passError ? <Text style={[styles.hint, { color: theme.danger }]}>{passError}</Text> : null}

              <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>DOBARA</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: theme.text, borderColor: confirmError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}
                accessibilityLabel="Confirm new password"
              />
              {confirmError ? <Text style={[styles.hint, { color: theme.danger }]}>{confirmError}</Text> : null}
            </>
          ) : null}

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <View style={{ marginTop: SPACING.lg }}>
            {mode === 'code' ? (
              <GradientButton
                title="Password reset karo"
                onPress={() => void reset()}
                disabled={!username.trim() || !code.trim() || !password || !!passError || !!confirmError}
                loading={busy}
              />
            ) : mode === 'device' ? (
              <GradientButton
                title="Is device se reset karo"
                onPress={() => void deviceReset()}
                disabled={!password || !!passError || !!confirmError}
                loading={busy}
              />
            ) : (
              <GradientButton
                title="Team ko request bhejo"
                onPress={() => void askSupport()}
                disabled={!username.trim() || !submissionId.trim()}
                loading={busy}
              />
            )}
          </View>

          <Text style={[styles.hint, { color: theme.textFaint, marginTop: SPACING.lg, textAlign: 'center' }]}>
            Madad chahiye? {SUPPORT_EMAIL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: SPACING.page, paddingTop: SPACING.xxl },
  kicker: { ...TYPE.overline, marginBottom: 6 },
  title: { ...TYPE.display, marginBottom: 8 },
  sub: { ...TYPE.body, lineHeight: 21, marginBottom: SPACING.lg },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: SPACING.lg },
  tab: { flex: 1, borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: 9, alignItems: 'center' },
  tabText: { ...TYPE.caption, fontWeight: '700' },
  label: { ...TYPE.caption, letterSpacing: 1.4, marginBottom: 6 },
  // height must be a TOUCH target, never a type token: SCALE.h2 is 22 (a font
  // size) and made every field 22px tall, clipping the value out of view.
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
    ...TYPE.body,
    fontSize: 16,
    lineHeight: 21,
    textAlignVertical: 'center',
  },
  code: { letterSpacing: 2, fontWeight: '700' },
  hint: { ...TYPE.caption, marginTop: 5, lineHeight: 16 },
  error: { ...TYPE.caption, marginTop: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  body: { ...TYPE.body, lineHeight: 22 },
});
