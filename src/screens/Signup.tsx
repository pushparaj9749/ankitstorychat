/**
 * Signup — username + password, then the one-time recovery code.
 *
 * There is no email, so the recovery code shown on step 2 is the ONLY way back
 * into the account if the password is forgotten on another device. The copy on
 * that step says so plainly, and it cannot be dismissed without confirming it
 * was saved.
 */
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { Icon } from '../components/icons';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import {
  AccountError,
  checkUsername,
  signup,
  validatePassword,
  validateUsername,
} from '../lib/account';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function Signup({ navigation }: Props) {
  const { theme, settings, setAccount, profile, refreshStories } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
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
  const userError = useMemo(() => (cleanUser ? validateUsername(cleanUser) : null), [cleanUser]);
  const passError = useMemo(
    () => (password ? validatePassword(password, cleanUser) : null),
    [password, cleanUser],
  );
  const confirmError = confirm && confirm !== password ? 'Dono password same nahi hain.' : null;
  const valid = !userError && !passError && !confirmError && !!cleanUser && !!password && !!confirm;

  async function create() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Server truth beats the local regex (reserved names, races).
      const check = await checkUsername(cleanUser, settings?.contentApiBaseUrl).catch(() => null);
      if (check && !check.available) {
        setError(check.message ?? 'Ye username already le liya gaya hai.');
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
      setStep(2);
      lightBuzz();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Account nahi ban paya. Dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    await Clipboard.setStringAsync(recoveryCode);
    setCopied(true);
    lightBuzz();
  }

  async function finish() {
    if (!saved) return;
    const { cachedAccount } = await import('../lib/account');
    const acc = await cachedAccount();
    await setAccount(acc);
    await refreshStories();
  }

  if (step === 2) {
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
            • Kahan rakhein: notes app, screenshots, ya kagaz par likh lo.{'\n'}
            • Isi device par password bhoolne par code ke bina bhi reset ho sakta hai.{'\n'}
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
                { borderColor: saved ? theme.success : theme.border, backgroundColor: saved ? withAlpha(theme.success, 0.18) : 'transparent' },
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

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.kicker, { color: theme.gold }]}>NAYA ACCOUNT</Text>
          <Text style={[styles.title, { color: theme.text }]}>Apna account banao</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Bas username aur password. Koi email, koi OTP, koi phone number nahi.
          </Text>

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
              maxLength={20}
              placeholder="arjun_07"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text }]}
              accessibilityLabel="Username"
            />
          </View>
          <Text style={[styles.hint, { color: userError ? theme.danger : theme.textFaint }]}>
            {userError ?? '3-20 characters, sirf a-z, 0-9 aur _'}
          </Text>

          <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.md }]}>PASSWORD</Text>
          <View style={[styles.inputRow, { borderColor: passError ? theme.danger : theme.border, backgroundColor: theme.surface2 }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: theme.text }]}
              accessibilityLabel="Password"
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Show password">
              <Icon name={show ? 'lock-closed' : 'lock-closed-outline'} size={18} color={theme.textDim} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: passError ? theme.danger : theme.textFaint }]}>
            {passError ?? 'Kam se kam 8 characters, ek letter aur ek number'}
          </Text>

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

          {error ? (
            <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <View style={{ marginTop: SPACING.lg }}>
            <GradientButton
              title="Account banao"
              onPress={() => void create()}
              disabled={!valid}
              loading={busy}
              accessibilityLabel="Create account"
            />
          </View>

          <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="button" style={styles.linkRow}>
            <Text style={[styles.linkText, { color: theme.textDim }]}>Pehle se account hai? </Text>
            <Text style={[styles.linkStrong, { color: theme.primary }]}>Log in</Text>
          </Pressable>
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
  label: { ...TYPE.caption, letterSpacing: 1.4, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: SCALE.h2,
    gap: 8,
  },
  at: { ...TYPE.body },
  input: { flex: 1, ...TYPE.body },
  hint: { ...TYPE.caption, marginTop: 5, lineHeight: 16 },
  error: { ...TYPE.caption, marginTop: SPACING.md },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  linkText: { ...TYPE.body },
  linkStrong: { ...TYPE.body, fontWeight: '700' },
  codeCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: 10, marginBottom: SPACING.lg },
  code: { fontSize: 21, fontWeight: '800', letterSpacing: 2.4 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyText: { ...TYPE.caption, fontWeight: '700' },
  bullets: { ...TYPE.small, lineHeight: 21, marginBottom: SPACING.lg },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.lg },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkText: { ...TYPE.body },
});
