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
import { RELEASES_PAGE, checkForUpdate, type UpdateStatus } from '../lib/updateCheck';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

const REPO = 'https://github.com/pushparaj9749/ankitstorychat';

export function About({ navigation }: Props) {
  const { theme, settings, updateSettings } = useApp();
  const version = Constants.expoConfig?.version ?? '2.9.3';
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateStatus | 'error' | null>(null);

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
          Tumhari kahani, tumhare words. Koi account nahi, koi coins nahi, koi message limits
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

        <View
          style={[
            styles.dev,
            {
              backgroundColor: withAlpha(theme.surface, 0.9),
              borderColor: theme.border,
            },
            SHADOWS.card,
          ]}
        >
          <Icon name="heart" size={ICON_SIZE.xl} color={theme.accent} />
          <Text style={[styles.devTitle, { color: theme.text }]}>Help the Developer</Text>
          <Text style={[styles.soon, { backgroundColor: theme.primarySoft, color: theme.accent }]}>
            Coming Soon
          </Text>
          <Text style={[styles.devDesc, { color: theme.textDim }]}>
            Voluntary donations are on the way. Until then — immerse yourself in stories, share with fellow storytellers, and star the repo on GitHub!
          </Text>
          <Pressable onPress={() => void Linking.openURL(REPO)} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.accent }]}>Star on GitHub</Text>
          </Pressable>
        </View>

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
  dev: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  devTitle: { fontSize: SCALE.title, fontWeight: '700', marginTop: 8 },
  soon: {
    fontSize: SCALE.micro,
    fontWeight: '700',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  devDesc: { fontSize: SCALE.small, textAlign: 'center', lineHeight: 21, marginTop: 10 },
  link: { fontWeight: '700', marginTop: 12, fontSize: SCALE.small },
  credit: { fontSize: SCALE.micro, textAlign: 'center', marginTop: SPACING.xl, lineHeight: 18 },
});
