/**
 * Privacy & Security: App Lock (fingerprint / PIN). Kissa v2.9.0.
 * Everything here stays on the phone — nothing is sent anywhere.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { PinDots, PinKeypad, pinColorsFor } from '../components/PinPad';
import { IconGlyph } from '../components/iconGlyph';
import {
  LOCK_DELAY_LABEL,
  PIN_LENGTH,
  authenticateBiometric,
  clearPin,
  getBiometricStatus,
  savePin,
  verifyPin,
  type AppLockDelay,
  type BiometricStatus,
} from '../lib/appLock';
import { lightBuzz, successBuzz, tapTick } from '../lib/haptics';
import { RADIUS, SCALE, SHADOWS, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSecurity'>;

/** What the PIN panel is doing right now. */
type Flow =
  | { step: 'idle' }
  | { step: 'new'; purpose: 'enable' | 'change' }
  | { step: 'confirm'; purpose: 'enable' | 'change'; first: string }
  | { step: 'verify'; then: 'disable' | 'change' };

const DELAYS: AppLockDelay[] = ['immediate', '1m', '5m'];

export function SettingsSecurity({ navigation }: Props) {
  const { theme, settings, updateSettings } = useApp();
  const [bio, setBio] = useState<BiometricStatus | null>(null);
  const [flow, setFlow] = useState<Flow>({ step: 'idle' });
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const haptics = settings.haptics;
  const enabled = settings.appLockEnabled;

  useEffect(() => {
    void getBiometricStatus().then(setBio);
  }, []);

  const startFlow = useCallback((f: Flow) => {
    setPin('');
    setError(null);
    setFlow(f);
  }, []);

  const fail = useCallback(
    (msg: string) => {
      void lightBuzz(haptics);
      setShakeKey((k) => k + 1);
      setPin('');
      setError(msg);
    },
    [haptics],
  );

  const finishVerified = useCallback(
    async (then: 'disable' | 'change') => {
      if (then === 'disable') {
        await clearPin();
        await updateSettings({ appLockEnabled: false });
        void successBuzz(haptics);
        startFlow({ step: 'idle' });
      } else {
        startFlow({ step: 'new', purpose: 'change' });
      }
    },
    [haptics, startFlow, updateSettings],
  );

  const handleComplete = useCallback(
    async (value: string) => {
      if (flow.step === 'new') {
        startFlow({ step: 'confirm', purpose: flow.purpose, first: value });
        return;
      }
      if (flow.step === 'confirm') {
        if (value !== flow.first) {
          fail('Dono PIN match nahi hue — phir se naya PIN daalo');
          setFlow({ step: 'new', purpose: flow.purpose });
          return;
        }
        try {
          await savePin(value);
        } catch {
          fail('PIN save nahi ho paya, phir se try karo');
          return;
        }
        if (flow.purpose === 'enable') {
          await updateSettings({ appLockEnabled: true, appLockBiometric: !!bio?.biometrics });
        }
        void successBuzz(haptics);
        startFlow({ step: 'idle' });
        Alert.alert(
          flow.purpose === 'enable' ? 'App Lock ON 🔒' : 'PIN badal gaya',
          flow.purpose === 'enable'
            ? 'Ab Kissa kholne par PIN' + (bio?.biometrics ? ` ya ${bio.label.toLowerCase()}` : '') + ' maanga jayega.'
            : 'Agli baar se naya PIN chalega.',
        );
        return;
      }
      if (flow.step === 'verify') {
        const r = await verifyPin(value);
        if (r.ok) return void finishVerified(flow.then);
        if (r.reason === 'no-pin') return void finishVerified(flow.then);
        const wait = r.lockedUntil ? Math.ceil((r.lockedUntil - Date.now()) / 1000) : 0;
        fail(wait > 0 ? `Bahut baar galat PIN. ${wait} sec baad try karo` : 'Galat PIN');
      }
    },
    [bio, fail, finishVerified, flow, haptics, startFlow, updateSettings],
  );

  const onDigit = useCallback(
    (d: string) => {
      void tapTick(haptics);
      setError(null);
      setPin((p) => {
        if (p.length >= PIN_LENGTH) return p;
        const next = p + d;
        if (next.length === PIN_LENGTH) setTimeout(() => void handleComplete(next), 90);
        return next;
      });
    },
    [haptics, handleComplete],
  );

  function onToggleLock(v: boolean) {
    if (v) startFlow({ step: 'new', purpose: 'enable' });
    else startFlow({ step: 'verify', then: 'disable' });
  }

  async function onToggleBio(v: boolean) {
    if (v) {
      // Make sure the fingerprint actually works before relying on it.
      const ok = await authenticateBiometric('Fingerprint check karo');
      if (!ok) return;
    }
    await updateSettings({ appLockBiometric: v });
  }

  /* ---------------- PIN panel ---------------- */
  if (flow.step !== 'idle') {
    const title =
      flow.step === 'new'
        ? flow.purpose === 'enable'
          ? 'Naya PIN banao'
          : 'Naya PIN daalo'
        : flow.step === 'confirm'
          ? 'PIN dobara daalo'
          : 'Abhi wala PIN daalo';
    const sub =
      flow.step === 'new'
        ? `${PIN_LENGTH} number ka PIN chuno jo sirf tumhe pata ho`
        : flow.step === 'confirm'
          ? 'Confirm karne ke liye wahi PIN phir se'
          : flow.then === 'disable'
            ? 'Lock band karne ke liye pehchaan confirm karo'
            : 'PIN badalne se pehle pehchaan confirm karo';
    const verifyBio = flow.step === 'verify' && settings.appLockBiometric && bio?.biometrics;
    return (
      <Screen>
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <View style={[styles.lockBadge, { backgroundColor: withAlpha(theme.accent, 0.12) }]}>
              <IconGlyph name="lock-closed" size={26} color={theme.accent} />
            </View>
            <Text style={[styles.panelTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.panelSub, { color: theme.textDim }]}>{sub}</Text>
            <PinDots filled={pin.length} colors={pinColorsFor(theme)} error={!!error} shakeKey={shakeKey} />
            <Text style={[styles.err, { color: theme.danger }]} accessibilityLiveRegion="polite">
              {error ?? ' '}
            </Text>
          </View>
          <PinKeypad
            colors={pinColorsFor(theme)}
            onDigit={onDigit}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
            leftAction={
              verifyBio && flow.step === 'verify'
                ? {
                    icon: 'finger-print',
                    label: bio?.label ?? 'Fingerprint',
                    onPress: () =>
                      void authenticateBiometric('Pehchaan confirm karo').then(
                        (ok) => ok && void finishVerified(flow.then),
                      ),
                  }
                : null
            }
          />
          <Pressable onPress={() => startFlow({ step: 'idle' })} style={styles.cancel} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.cancelText, { color: theme.textFaint }]}>Cancel</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  /* ---------------- settings list ---------------- */
  const card = [styles.card, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.card];
  const switchColors = (v: boolean) => ({
    trackColor: { false: theme.surface2, true: theme.primary },
    thumbColor: v ? theme.accent : theme.textFaint,
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>PRIVACY</Text>
          <Text style={[styles.title, { color: theme.text }]}>Privacy & Security</Text>
        </View>

        <View style={card}>
          <View style={styles.row}>
            <View style={styles.body}>
              <Text style={[styles.label, { color: theme.text }]}>App Lock</Text>
              <Text style={[styles.desc, { color: theme.textDim }]}>
                Kissa kholne par PIN{bio?.biometrics ? ` ya ${bio.label.toLowerCase()}` : ''} maange. Recent apps mein bhi story
                chhupi rahegi.
              </Text>
            </View>
            <Switch value={enabled} onValueChange={onToggleLock} accessibilityLabel="App Lock" testID="app-lock-switch" {...switchColors(enabled)} />
          </View>
        </View>

        {enabled ? (
          <>
            {bio?.biometrics ? (
              <View style={card}>
                <View style={styles.row}>
                  <IconGlyph name="finger-print" size={22} color={theme.accent} style={styles.rowIcon} />
                  <View style={styles.body}>
                    <Text style={[styles.label, { color: theme.text }]}>{bio.label} se kholo</Text>
                    <Text style={[styles.desc, { color: theme.textDim }]}>PIN hamesha backup ke taur par chalega</Text>
                  </View>
                  <Switch
                    value={settings.appLockBiometric}
                    onValueChange={(v) => void onToggleBio(v)}
                    accessibilityLabel={`${bio.label} unlock`}
                    {...switchColors(settings.appLockBiometric)}
                  />
                </View>
              </View>
            ) : (
              <Text style={[styles.hint, { color: theme.textFaint }]}>
                Fingerprint use karna hai? Pehle phone ki Settings mein fingerprint add karo — phir yahan option aa jayega.
              </Text>
            )}

            <View style={card}>
              <Text style={[styles.label, { color: theme.text }]}>Lock kab lage</Text>
              <Text style={[styles.desc, { color: theme.textDim }]}>App se bahar jaane ke kitni der baad PIN maange</Text>
              <View style={styles.chips}>
                {DELAYS.map((d) => {
                  const on = (settings.appLockDelay ?? 'immediate') === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => void updateSettings({ appLockDelay: d })}
                      style={[
                        styles.chip,
                        { borderColor: on ? theme.accent : theme.border, backgroundColor: on ? withAlpha(theme.accent, 0.14) : 'transparent' },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, { color: on ? theme.text : theme.textDim }]}>{LOCK_DELAY_LABEL[d]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable style={card} onPress={() => startFlow({ step: 'verify', then: 'change' })} accessibilityRole="button">
              <View style={styles.row}>
                <IconGlyph name="key-outline" size={20} color={theme.textDim} style={styles.rowIcon} />
                <Text style={[styles.label, styles.body, { color: theme.text }]}>PIN badlo</Text>
                <IconGlyph name="chevron-forward" size={18} color={theme.textFaint} />
              </View>
            </Pressable>
          </>
        ) : null}

        <View style={[styles.note, { borderColor: theme.border }]}>
          <IconGlyph name="shield-outline" size={18} color={theme.success} />
          <Text style={[styles.noteText, { color: theme.textFaint }]}>
            Sab kuch sirf is phone par rehta hai. PIN khud save nahi hota — sirf uska encrypted hash phone ke secure storage mein.
            Fingerprint phone khud check karta hai; Kissa ko kabhi nahi milta. PIN bhool gaye to phone ke screen lock se reset ho
            sakta hai.
          </Text>
        </View>

        <Pressable onPress={() => navigation.navigate('Privacy')} style={styles.link} accessibilityRole="link">
          <Text style={[styles.linkText, { color: theme.accent }]}>Privacy Policy padho</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  header: { paddingTop: 6, paddingBottom: 10 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.displaySmall, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { marginRight: 12 },
  body: { flex: 1, paddingRight: 10 },
  label: { fontSize: SCALE.body, fontWeight: '700' },
  desc: { fontSize: SCALE.small, marginTop: 3, lineHeight: 19 },
  hint: { fontSize: SCALE.small, lineHeight: 19, marginBottom: 12, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: SCALE.small, fontWeight: '600' },
  note: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginTop: 8 },
  noteText: { flex: 1, fontSize: SCALE.micro, lineHeight: 18 },
  link: { alignSelf: 'center', paddingVertical: 14 },
  linkText: { fontSize: SCALE.small, fontWeight: '700' },
  panel: { flex: 1, justifyContent: 'space-between', paddingTop: 24, paddingBottom: 16 },
  panelHead: { alignItems: 'center' },
  lockBadge: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  panelTitle: { ...TYPE.title, textAlign: 'center' },
  panelSub: { fontSize: SCALE.small, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  err: { fontSize: SCALE.small, minHeight: 18, textAlign: 'center' },
  cancel: { alignSelf: 'center', paddingVertical: 12, marginTop: 8 },
  cancelText: { fontSize: SCALE.body, fontWeight: '600' },
});
