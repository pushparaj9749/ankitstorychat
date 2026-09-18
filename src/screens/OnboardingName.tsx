/**
 * Onboarding Screen 1: "What should we call you?"
 * Kissa v2.4.1.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, GRADIENTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingName'>;

export function OnboardingName({ navigation }: Props) {
  const { theme } = useApp();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const clean = name.trim();
  const valid = clean.length >= 2 && clean.length <= 20;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <LinearGradient colors={[...GRADIENTS.hero]} style={[styles.logo, SHADOWS.glowRose]}>
          <Text style={styles.logoText}>✦</Text>
        </LinearGradient>
        <Text style={[styles.title, { color: theme.text }]}>What should we call you?</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Yehi naam story ke characters use karenge. Koi account nahi, koi password nahi — bas
          tum aur tumhari interactive kahaniyan. 🔒
        </Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setTouched(true);
          }}
          placeholder="Nickname — e.g. Rahul"
          placeholderTextColor={theme.textFaint}
          maxLength={20}
          autoFocus
          accessibilityLabel="Nickname"
          style={[
            styles.input,
            { backgroundColor: withAlpha(theme.surface, 0.94), borderColor: theme.border, color: theme.text },
          ]}
        />
        {touched && !valid ? (
          <Text style={[styles.hint, { color: theme.danger }]}>
            Nickname 2–20 characters ka ho.
          </Text>
        ) : (
          <Text style={[styles.hint, { color: theme.textFaint }]}>
            Sirf tumhare device par encrypted save hoga. ✦
          </Text>
        )}
        <View style={styles.spacer} />
        <GradientButton
          title="Continue"
          disabled={!valid}
          onPress={() => navigation.navigate('OnboardingAge', { nickname: clean })}
        />
        <View style={{ height: SPACING.lg }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACING.xxl },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  logoText: { fontSize: 32, fontWeight: '900', color: '#0E070B' },
  title: { fontSize: 30, fontWeight: '900', marginBottom: SPACING.sm, letterSpacing: -0.5 },
  sub: { fontSize: FONTS.body, lineHeight: 22, marginBottom: SPACING.xl },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: 17,
  },
  hint: { fontSize: FONTS.small, marginTop: SPACING.sm, letterSpacing: 0.1 },
  spacer: { flex: 1 },
});
