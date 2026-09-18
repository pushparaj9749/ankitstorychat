/** About: version, links, Help the Developer (Coming Soon). */
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, GRADIENTS, RADIUS, SPACING } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

const REPO = 'https://github.com/pushparaj9749/ankitstorychat';

export function About({ navigation }: Props) {
  const { theme } = useApp();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap}>
        <LinearGradient colors={[...GRADIENTS.hero]} style={styles.logo}>
          <Text style={[styles.logoText, { color: '#1A100C' }]}>कि</Text>
        </LinearGradient>
        <Text style={[styles.name, { color: theme.text }]}>Kissa</Text>
        <Text style={[styles.ver, { color: theme.textDim }]}>v{version} • Local-first AI story chat</Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>
          Tumhari kahani, tumhare words. Koi account nahi, koi coins nahi, koi message limits
          nahi — bas kahaniyan. Sab kuch tumhare device par. 🔒
        </Text>

        <View style={styles.gap}>
          <GradientButton title="⭐ GitHub Repository" variant="ghost" onPress={() => void Linking.openURL(REPO)} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="📄 Terms & Conditions" variant="ghost" onPress={() => navigation.navigate('Terms')} />
        </View>
        <View style={styles.gap}>
          <GradientButton title="🔒 Privacy Policy" variant="ghost" onPress={() => navigation.navigate('Privacy')} />
        </View>

        <View style={[styles.dev, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.devEmoji}>❤️</Text>
          <Text style={[styles.devTitle, { color: theme.text }]}>Help the Developer</Text>
          <Text style={[styles.soon, { backgroundColor: theme.accentSoft, color: theme.accent }]}>
            Coming Soon
          </Text>
          <Text style={[styles.devDesc, { color: theme.textDim }]}>
            Voluntary donations aa rahe hain. Tab tak — stories khelo, doston ko batao, aur GitHub
            par star ⭐ do! Koi payment kabhi zaroori nahi hoga.
          </Text>
          <Pressable onPress={() => void Linking.openURL(REPO)} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.primary }]}>Star on GitHub →</Text>
          </Pressable>
        </View>

        <Text style={[styles.credit, { color: theme.textFaint }]}>
          Original stories, art & sounds crafted for Kissa. Made with ❤️ in India.
        </Text>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: SPACING.xl },
  logo: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 44, fontWeight: '900', color: '#fff' },
  name: { fontSize: 30, fontWeight: '900', marginTop: 12 },
  ver: { fontSize: FONTS.small, marginTop: 4 },
  desc: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 21, marginTop: 12, paddingHorizontal: 8 },
  gap: { width: '100%', marginTop: 10 },
  dev: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  devEmoji: { fontSize: 40 },
  devTitle: { fontSize: FONTS.heading, fontWeight: '800', marginTop: 8 },
  soon: { fontSize: FONTS.tiny, fontWeight: '800', marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  devDesc: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 20, marginTop: 10 },
  link: { fontWeight: '700', marginTop: 10 },
  credit: { fontSize: FONTS.tiny, textAlign: 'center', marginTop: SPACING.xl },
});
