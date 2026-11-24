/**
 * Account settings — who you are on Kissa.
 *
 * Username is permanent (it is the sign-in name). The creator/display name is
 * what appears on submissions and can be changed here. Recovery code, session
 * handling and account deletion live on this screen too.
 */
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { Icon } from '../components/icons';
import { LAYOUT, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import {
  AccountError,
  deleteAccount,
  logout,
  rotateRecoveryCode,
  SUPPORT_EMAIL,
  updateDisplayName,
} from '../lib/account';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export function Account({ navigation }: Props) {
  const { theme, account, settings, setAccount } = useApp();
  const apiBase = settings?.contentApiBaseUrl;
  const [name, setName] = useState(account?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = !!account && name.trim() !== account.displayName && name.trim().length > 0;

  async function saveName() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateDisplayName(name.trim(), apiBase);
      await setAccount(next);
      setMsg('Naam update ho gaya.');
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Naam save nahi hua.');
    } finally {
      setSaving(false);
    }
  }

  async function newRecoveryCode() {
    setBusy(true);
    setError(null);
    try {
      const { recoveryCode } = await rotateRecoveryCode(apiBase);
      setRevealed(recoveryCode);
      setMsg('Naya recovery code ban gaya — purana ab kaam nahi karega.');
      lightBuzz();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'Code nahi bana.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!revealed) return;
    await Clipboard.setStringAsync(revealed);
    setMsg('Copy ho gaya — safe jagah rakh lo.');
  }

  async function signOut() {
    Alert.alert('Log out?', 'Tumhari kahaniyan, chats aur saves isi device par rahenge.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await logout(apiBase);
            await setAccount(null);
          })();
        },
      },
    ]);
  }

  async function removeAccount() {
    Alert.alert(
      'Account delete karein?',
      'Account, login aur notifications hat jayenge. Device ki kahaniyan/chats waisi hi rahengi. Ye wapas nahi aayega.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteAccount(apiBase);
                await setAccount(null);
              } catch (e) {
                setError(e instanceof AccountError ? e.message : 'Delete nahi hua.');
              }
            })();
          },
        },
      ],
    );
  }

  if (!account) {
    return (
      <Screen>
        <View style={styles.page}>
          <Text style={[styles.title, { color: theme.text }]}>Login karo</Text>
          <GradientButton title="Login" onPress={() => navigation.navigate('Login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: LAYOUT.navClearance }]}>
        <Text style={[styles.kicker, { color: theme.gold }]}>ACCOUNT</Text>
        <View style={[styles.hero, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.soft]}>
          <View style={[styles.avatar, { backgroundColor: withAlpha(theme.primary, 0.2), borderColor: withAlpha(theme.primary, 0.4) }]}>
            <Text style={[styles.avatarLetter, { color: theme.text }]}>{(account.displayName[0] ?? 'K').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>
              @{account.username}
            </Text>
            <Text style={[styles.small, { color: theme.textDim }]}>
              Kissa me shuru se — {new Date(account.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={[styles.label, { color: theme.textFaint }]}>CREATOR NAME</Text>
        <Text style={[styles.small, { color: theme.textDim, marginBottom: 8 }]}>
          Ye naam tumhari submissions par dikhta hai. Username alag hai aur badal nahi sakta.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface2 }]}
          accessibilityLabel="Creator name"
        />
        <View style={{ marginTop: SPACING.sm }}>
          <GradientButton title="Save name" onPress={() => void saveName()} disabled={!dirty} loading={saving} variant="secondary" />
        </View>

        <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.xl }]}>RECOVERY CODE</Text>
        <Text style={[styles.small, { color: theme.textDim, marginBottom: 8 }]}>
          Koi email nahi hai, isliye code hi password wapas dilata hai. Naya banane par purana band ho jata hai.
        </Text>
        {revealed ? (
          <View style={[styles.codeBox, { borderColor: withAlpha(theme.gold, 0.5), backgroundColor: withAlpha(theme.gold, 0.08) }]}>
            <Text style={[styles.code, { color: theme.text }]} selectable>
              {revealed}
            </Text>
            <Pressable onPress={() => void copy()} accessibilityRole="button" style={styles.inline}>
              <Icon name="document-text-outline" size={15} color={theme.accent} />
              <Text style={[styles.link, { color: theme.accent }]}>Copy</Text>
            </Pressable>
          </View>
        ) : null}
        <GradientButton
          title={revealed ? 'Ek aur naya code banao' : 'Naya recovery code banao'}
          onPress={() => void newRecoveryCode()}
          loading={busy}
          variant="secondary"
        />

        <Text style={[styles.label, { color: theme.textFaint, marginTop: SPACING.xl }]}>SECURITY</Text>
        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          accessibilityRole="button"
          style={[styles.row, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface, 0.9) }]}
        >
          <Icon name="lock-closed-outline" size={18} color={theme.textDim} />
          <Text style={[styles.rowText, { color: theme.text }]}>Password badlo</Text>
          <Icon name="chevron-forward" size={16} color={theme.textFaint} />
        </Pressable>
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          style={[styles.row, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface, 0.9) }]}
        >
          <Icon name="download-outline" size={18} color={theme.textDim} />
          <Text style={[styles.rowText, { color: theme.text }]}>Log out</Text>
          <Icon name="chevron-forward" size={16} color={theme.textFaint} />
        </Pressable>
        <Pressable
          onPress={() => void removeAccount()}
          accessibilityRole="button"
          style={[styles.row, { borderColor: withAlpha(theme.danger, 0.4), backgroundColor: withAlpha(theme.danger, 0.08) }]}
        >
          <Icon name="trash-outline" size={18} color={theme.danger} />
          <Text style={[styles.rowText, { color: theme.danger }]}>Account delete karo</Text>
        </Pressable>

        {msg ? <Text style={[styles.small, { color: theme.success, marginTop: SPACING.md }]}>{msg}</Text> : null}
        {error ? <Text style={[styles.small, { color: theme.danger, marginTop: SPACING.md }]}>{error}</Text> : null}

        <Text style={[styles.small, { color: theme.textFaint, marginTop: SPACING.xl, textAlign: 'center' }]}>
          Help: {SUPPORT_EMAIL}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.page, paddingTop: SPACING.xxl },
  kicker: { ...TYPE.overline, marginBottom: 8 },
  title: { ...TYPE.display, marginBottom: SPACING.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xl },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 22, fontWeight: '800' },
  username: { ...TYPE.heading },
  small: { ...TYPE.caption, lineHeight: 17 },
  label: { ...TYPE.caption, letterSpacing: 1.4, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, ...TYPE.body },
  codeBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: 8, marginBottom: SPACING.sm },
  code: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { ...TYPE.caption, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: SPACING.md, marginTop: 8 },
  rowText: { flex: 1, ...TYPE.body },
});
