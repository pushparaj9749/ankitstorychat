/**
 * About Kissa — app version, links, and credits.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { KISSA_LOGO } from '../components/brand';
import { Icon, ICON_SIZE } from '../components/icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { DonateCard } from '../components/DonateCard';
import { RELEASES_PAGE, checkForUpdate, type UpdateStatus } from '../lib/updateCheck';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { SUPPORT_EMAIL } from '../lib/account';
import { checkForOtaUpdate, restartToApply, type OtaCheckResult } from '../lib/ota';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

const REPO = 'https://github.com/pushparaj9749/ankitstorychat';

export function About({ navigation }: Props) {
  const { theme, settings, updateSettings } = useApp();
  const version = Constants.expoConfig?.version ?? '2.13.0';
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateStatus | 'error' | null>(null);
  const [ota, setOta] = useState<OtaCheckResult | null>(null);
  const [otaBusy, setOtaBusy] = useState(false);

  /**
   * OTA: fetch a JS-only update. Small fixes (copy, layout, a broken screen)
   * arrive this way without installing a new APK; a native change still needs
   * the APK above.
   */
  async function checkOta() {
    setOtaBusy(true);
    try {
      const r = await checkForOtaUpdate();
      setOta(r);
    } finally {
      setOtaBusy(false);
    }
  }

  async function checkNow() {
    setChecking(true);
    try {
      const s = await checkForUpdate({ force: true });
      setResult(s.latest ? s : 'error');
    } finally {
      setChecking(false);
    }
  }

  const statusLine =
    result === 'error'
      ? 'Check nahi ho paya — internet on karke phir try karo.'
      : result?.available && result.latest
        ? `Naya version v${result.latest.version} aa gaya hai!`
        : result
          ? `Sab up to date hai — v${result.current} sabse naya hai.`
          : 'Naya Kissa APK aaya hai ya nahi, yahan check karo.';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.wrap, styles.page]}>
        <Image source={KISSA_LOGO} style={[styles.logo, SHADOWS.glowRose]} resizeMode="contain" accessibilityLabel="Kissa" />
        <Text style={[styles.name, { color: theme.text }]}>Kissa</Text>
        <Text style={[styles.ver, { color: theme.accent }]}>v{version} • Cinematic Interactive Story Platform</Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>
          Tumhari kahani, tumhare words. Koi ads nahi, koi coins nahi, koi message limits
          nahi — bas immersive kahaniyan. Sab kuch tumhare device par 100% private.
        </Text>


        <View
          style={[styles.upd, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.card]}
          testID="about-updates"
        >
          <View style={styles.updHead}>
            <Icon name="download" size={ICON_SIZE.md} color={theme.accent} />
            <Text style={[styles.updTitle, { color: theme.text }]}>App Updates</Text>
          </View>
          <Text style={[styles.updLine, { color: result && result !== 'error' && result.available ? theme.accent : theme.textDim }]}>
            {statusLine}
          </Text>
          <View style={styles.updActions}>
            {result && result !== 'error' && result.available && result.latest ? (
              <GradientButton title={`Download v${result.latest.version}`} onPress={() => void Linking.openURL(result.latest!.downloadUrl)} />
            ) : (
              <Pressable
                onPress={() => void checkNow()}
                disabled={checking}
                style={({ pressed }) => [styles.checkBtn, { borderColor: theme.border, opacity: pressed || checking ? 0.7 : 1 }]}
                accessibilityRole="button"
              >
                {checking ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                <Text style={[styles.checkText, { color: theme.text }]}>{checking ? 'Check ho raha hai…' : 'Update check karo'}</Text>
              </Pressable>
            )}
          </View>
          <View style={[styles.updToggle, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.updToggleLabel, { color: theme.text }]}>Chhota update (OTA)</Text>
              <Text style={[styles.updToggleSub, { color: theme.textFaint }]}>
                {ota
                  ? ota.state === 'downloaded'
                    ? `Naya update mil gaya — restart karke lag jayega.${ota.notes ? ` ${ota.notes}` : ''}`
                    : ota.state === 'applied'
                      ? 'Update lag gaya. Kholte hi naya version chalega.'
                      : ota.state === 'blocked'
                        ? 'Update ka signature verify nahi hua — is build par yeh update nahi lagega.'
                        : ota.state === 'error'
                          ? `Update check fail hua — dobara try karo.${ota.notes ? ` (${ota.notes})` : ''}`
                          : `Sab latest hai — koi chhota update pending nahi${
                              ota.id ? ` (id ${ota.id.slice(0, 8)}…)` : ''
                            }.`
                  : 'Bina APK install kiye chhote fixes. Native change ke liye APK.'}
              </Text>
              {ota?.runtime ? (
                <Text style={[styles.updToggleSub, { color: theme.textFaint, marginTop: 2 }]}>
                  {`runtime ${ota.runtime}${ota.id ? ` · update ${ota.id.slice(0, 8)}…` : ''}`}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => void checkOta()}
                  disabled={otaBusy}
                  style={({ pressed }) => [styles.checkBtn, { borderColor: theme.border, opacity: pressed || otaBusy ? 0.7 : 1 }]}
                  accessibilityRole="button"
                >
                  {otaBusy ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                  <Text style={[styles.checkText, { color: theme.text }]}>
                    {otaBusy ? 'Dekh raha hoon…' : 'OTA check karo'}
                  </Text>
                </Pressable>
                {ota?.state === 'downloaded' ? (
                  <Pressable
                    onPress={() => void restartToApply()}
                    style={({ pressed }) => [styles.checkBtn, { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.checkText, { color: theme.accent }]}>Restart</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.updToggle, { borderTopColor: theme.border }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.updToggleLabel, { color: theme.text }]}>Home par update banner</Text>
              <Text style={[styles.updToggleSub, { color: theme.textFaint }]}>
                Sirf GitHub se latest version number padhta hai — tumhara koi data kahin nahi jaata.
              </Text>
            </View>
            <Switch
              value={settings.updateBanner !== false}
              onValueChange={(v) => void updateSettings({ updateBanner: v })}
              trackColor={{ false: theme.surface2, true: theme.primary }}
              thumbColor={settings.updateBanner !== false ? theme.accent : theme.textFaint}
              accessibilityLabel="Update banner on Home"
            />
          </View>
          <Pressable onPress={() => void Linking.openURL(RELEASES_PAGE)} accessibilityRole="link" hitSlop={6}>
            <Text style={[styles.link, { color: theme.textFaint }]}>Saare releases dekho</Text>
          </Pressable>
        </View>

        <View style={styles.gap}>
          <GradientButton title="GitHub Repository" variant="ghost" onPress={() => void Linking.openURL(REPO)} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="Terms & Conditions" variant="ghost" onPress={() => navigation.navigate('Terms')} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="Privacy Policy" variant="ghost" onPress={() => navigation.navigate('Privacy')} />
        </View>

        <View style={styles.gap}>
          <GradientButton
            title={`Support: ${SUPPORT_EMAIL}`}
            variant="ghost"
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Kissa%20support`)}
          />
        </View>

        <DonateCard repoUrl={REPO} />

        <Text style={[styles.credit, { color: theme.textFaint }]}>
          Original stories, artwork & sounds crafted for Kissa. Made with love in India.
        </Text>
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center' },
  wrap: { alignItems: 'center', paddingTop: SPACING.xl },
  logo: { width: 84, height: 84, borderRadius: 26 },
  name: { fontSize: 32, fontWeight: '800', marginTop: 14, letterSpacing: -0.5 },
  ver: { fontSize: SCALE.small, marginTop: 4, fontWeight: '700' },
  desc: { fontSize: SCALE.small, textAlign: 'center', lineHeight: 22, marginTop: 12, paddingHorizontal: 10 },
  gap: { width: '100%', marginTop: 10 },
  upd: { width: '100%', borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, marginBottom: 6 },
  updHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updTitle: { fontSize: SCALE.body, fontWeight: '700' },
  updLine: { fontSize: SCALE.small, marginTop: 8, lineHeight: 19 },
  updActions: { marginTop: 12 },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingVertical: 11,
  },
  checkText: { fontSize: SCALE.small, fontWeight: '700' },
  updToggle: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
  updToggleLabel: { fontSize: SCALE.small, fontWeight: '700' },
  updToggleSub: { fontSize: SCALE.micro, marginTop: 2, lineHeight: 16 },
  link: { fontWeight: '700', marginTop: 12, fontSize: SCALE.small },
  credit: { fontSize: SCALE.micro, textAlign: 'center', marginTop: SPACING.xl, lineHeight: 18 },
});
