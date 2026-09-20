/**
 * About Kissa — Version 2.4.2, links, credits.
 */
import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { KISSA_LOGO } from '../components/brand';
import { Icon, ICON_SIZE } from '../components/icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

const REPO = 'https://github.com/pushparaj9749/ankitstorychat';

export function About({ navigation }: Props) {
  const { theme } = useApp();
  const version = Constants.expoConfig?.version ?? '2.5.0';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap}>
        <Image source={KISSA_LOGO} style={[styles.logo, SHADOWS.glowRose]} resizeMode="contain" accessibilityLabel="Kissa" />
        <Text style={[styles.name, { color: theme.text }]}>Kissa</Text>
        <Text style={[styles.ver, { color: theme.accent }]}>v{version} • Cinematic Interactive Story Platform</Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>
          Tumhari kahani, tumhare words. Koi account nahi, koi coins nahi, koi message limits
          nahi — bas immersive kahaniyan. Sab kuch tumhare device par 100% private.
        </Text>

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
  wrap: { alignItems: 'center', paddingTop: SPACING.xl },
  logo: { width: 84, height: 84, borderRadius: 26 },
  name: { fontSize: 32, fontWeight: '900', marginTop: 14, letterSpacing: -0.5 },
  ver: { fontSize: FONTS.small, marginTop: 4, fontWeight: '700' },
  desc: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 22, marginTop: 12, paddingHorizontal: 10 },
  gap: { width: '100%', marginTop: 10 },
  dev: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  devTitle: { fontSize: FONTS.heading, fontWeight: '800', marginTop: 8 },
  soon: {
    fontSize: FONTS.tiny,
    fontWeight: '800',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  devDesc: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 21, marginTop: 10 },
  link: { fontWeight: '800', marginTop: 12, fontSize: FONTS.small },
  credit: { fontSize: FONTS.tiny, textAlign: 'center', marginTop: SPACING.xl, lineHeight: 18 },
});
