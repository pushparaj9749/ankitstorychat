/** Onboarding screen 2: "How old are you?" — drives catalog filtering. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AgeGroup, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SPACING } from '../theme';
import { nowIso } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAge'>;

export function OnboardingAge({ navigation, route }: Props) {
  const { theme, saveProfile } = useApp();
  const [age, setAge] = useState<AgeGroup | null>(null);
  const [saving, setSaving] = useState(false);

  async function getStarted() {
    if (!age || saving) return;
    setSaving(true);
    try {
      await saveProfile({ nickname: route.params.nickname, ageGroup: age, createdAt: nowIso() });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setSaving(false);
    }
  }

  function card(value: AgeGroup, emoji: string, title: string, desc: string) {
    const selected = age === value;
    return (
      <Pressable
        onPress={() => setAge(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={title}
        style={[
          styles.card,
          {
            backgroundColor: selected ? theme.primarySoft : theme.surface,
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: theme.textDim }]}>{desc}</Text>
        </View>
        <View
          style={[
            styles.radio,
            { borderColor: selected ? theme.primary : theme.textFaint },
          ]}
        >
          {selected ? <View style={[styles.radioDot, { backgroundColor: theme.primary }]} /> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: theme.text }]}>How old are you?</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Iske hisaab se tumhe sahi stories dikhengi. 12–17 walo ko sirf age-appropriate
          catalog dikhega. 🔞
        </Text>
        {card('12-17', '🎒', '12–17', 'Teen-safe stories. Mature content hidden rahega.')}
        <View style={{ height: SPACING.md }} />
        {card('18+', '🌙', '18+', 'Full catalog — teen + mature stories.')}
        <View style={styles.spacer} />
        <GradientButton title="Get Started" disabled={!age} loading={saving} onPress={getStarted} />
        <Text style={[styles.note, { color: theme.textFaint }]}>
          Baad mein Settings → Profile se badal sakte ho.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACING.xxl },
  title: { fontSize: 30, fontWeight: '900', marginBottom: SPACING.sm },
  sub: { fontSize: FONTS.body, lineHeight: 22, marginBottom: SPACING.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  emoji: { fontSize: 36 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FONTS.heading, fontWeight: '800' },
  cardDesc: { fontSize: FONTS.small, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  spacer: { flex: 1 },
  note: { fontSize: FONTS.tiny, textAlign: 'center', marginTop: SPACING.md },
});
