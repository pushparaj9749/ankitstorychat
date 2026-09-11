/** Onboarding screen 1: "What should we call you?" */
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
import { FONTS, GRADIENTS, RADIUS, SPACING } from '../theme';

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
        <LinearGradient colors={[...GRADIENTS.hero]} style={styles.logo}>
          <Text style={styles.logoText}>कि</Text>
        </LinearGradient>
        <Text style={[styles.title, { color: theme.text }]}>What should we call you?</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Yehi naam story ke characters use karenge. Koi account nahi, koi password nahi — bas
          tum aur tumhari kahaniyan. ✨
        </Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setTouched(true);
          }}
          placeholder="Nickname — e.g. Ankit"
          placeholderTextColor={theme.textFaint}
          maxLength={20}
          autoFocus
          accessibilityLabel="Nickname"
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
        />
        {touched && !valid ? (
          <Text style={[styles.hint, { color: theme.danger }]}>
            Nickname 2–20 characters ka ho.
          </Text>
        ) : (
          <Text style={[styles.hint, { color: theme.textFaint }]}>
            Sirf tumhare device par save hoga. 🔒
          </Text>
        )}
        <View style={styles.spacer} />
        <GradientButton
          title="Continue"
          disabled={!valid}
          onPress={() => navigation.navigate('OnboardingAge', { nickname: clean })}
        />
        <View style={{ height: SPACING.md }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACING.xxl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  logoText: { fontSize: 38, fontWeight: '900', color: '#fff' },
  title: { fontSize: 30, fontWeight: '900', marginBottom: SPACING.sm },
  sub: { fontSize: FONTS.body, lineHeight: 22, marginBottom: SPACING.xl },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: 17,
  },
  hint: { fontSize: FONTS.small, marginTop: SPACING.sm },
  spacer: { flex: 1 },
});
