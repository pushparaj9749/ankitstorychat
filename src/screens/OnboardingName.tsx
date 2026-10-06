/**
 * Onboarding 1 of 2 — "What should we call you?"
 *
 * Layout pass: a step indicator, a larger brand mark and a 56px input make the
 * first screen feel like the opening title card of the app rather than a form.
 */
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KISSA_LOGO } from '../components/brand';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { Icon } from '../components/icons';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha, KISSA } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingName'>;

export function OnboardingName({ navigation }: Props) {
  const { theme } = useApp();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const clean = name.trim();
  const valid = clean.length >= 2 && clean.length <= 20;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.page}>
          {/* Step indicator */}
          <View style={styles.steps}>
            <View style={styles.stepBar}>
              <LinearGradient
                colors={['#FF6B7E', '#E9435E']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={[styles.stepBar, styles.stepBarIdle, { backgroundColor: withAlpha(theme.text, 0.1) }]} />
            <Text style={[styles.stepText, { color: theme.textFaint }]}>STEP 1 / 2</Text>
          </View>

          <View style={styles.brandBlock}>
            <Image source={KISSA_LOGO} style={[styles.logo, SHADOWS.glowRose]} resizeMode="contain" accessibilityLabel="Kissa" />
            <Text style={[styles.wordmark, { color: theme.textFaint }]}>{KISSA.wordmark} · {KISSA.tagline}</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>What should we call you?</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Yehi naam story ke characters use karenge. Koi account nahi, koi password nahi — bas tum aur
            tumhari interactive kahaniyan.
          </Text>

          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: withAlpha(theme.surface, 0.94),
                borderColor: touched && !valid ? withAlpha(theme.danger, 0.5) : valid ? withAlpha(theme.primary, 0.4) : theme.border,
              },
            ]}
          >
            <Icon name="person-outline" size={18} color={theme.textFaint} />
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
              style={[styles.input, { color: theme.text }]}
            />
            {clean.length > 0 ? <Text style={[styles.counter, { color: theme.textFaint }]}>{clean.length}/20</Text> : null}
          </View>

          {touched && !valid ? (
            <Text style={[styles.hint, { color: theme.danger }]}>Nickname 2–20 characters ka ho.</Text>
          ) : (
            <Text style={[styles.hint, { color: theme.textFaint }]}>Sirf tumhare device par encrypted save hoga.</Text>
          )}

          <View style={styles.spacer} />

          <GradientButton
            title="Continue"
            disabled={!valid}
            onPress={() => navigation.navigate('OnboardingAge', { nickname: clean })}
          />
          <Text style={[styles.foot, { color: theme.textFaint }]}>
            No login · No coins · No message limits
          </Text>
          <View style={{ height: SPACING.lg }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACING.xl },
  page: { flex: 1, width: '100%', maxWidth: LAYOUT.contentMaxWidth, alignSelf: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepBar: { flex: 1, height: 3, borderRadius: RADIUS.pill, overflow: 'hidden' },
  stepBarIdle: { opacity: 0.6 },
  stepText: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.2, marginLeft: 3 },
  brandBlock: { alignItems: 'flex-start', marginTop: SPACING.xxl },
  logo: { width: 78, height: 78, borderRadius: 24 },
  wordmark: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1.4, marginTop: 12 },
  title: { ...TYPE.displayXL, marginTop: SPACING.xl },
  sub: { fontSize: SCALE.body, lineHeight: 23, marginTop: SPACING.md, marginBottom: SPACING.xxl },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 56,
  },
  input: { flex: 1, fontSize: 17, fontWeight: '600', paddingVertical: 14 },
  counter: { fontSize: SCALE.micro, fontWeight: '700' },
  hint: { fontSize: SCALE.small, marginTop: SPACING.sm, letterSpacing: 0.1 },
  spacer: { flex: 1 },
  foot: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center', marginTop: SPACING.md },
});
