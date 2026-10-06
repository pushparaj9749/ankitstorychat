/**
 * Onboarding Screen 2: "How old are you?" — drives catalog filtering.
 * Kissa v2.4.2.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AgeGroup, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha, KISSA } from '../theme';
import { Icon, type IconName } from '../components/icons';
import { nowIso } from '../lib/utils';
import { lightBuzz } from '../lib/haptics';

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

  function card(value: AgeGroup, icon: IconName, title: string, desc: string) {
    const selected = age === value;
    return (
      <Pressable
        onPress={() => {
          lightBuzz();
          setAge(value);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={title}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: selected ? withAlpha(theme.primary, 0.14) : withAlpha(theme.surface, 0.9),
            borderColor: selected ? withAlpha(theme.primary, 0.5) : theme.border,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
          SHADOWS.card,
        ]}
      >
        <View
          style={[
            styles.emojiBox,
            {
              backgroundColor: selected ? withAlpha(theme.primary, 0.16) : withAlpha(theme.text, 0.05),
              borderColor: selected ? withAlpha(theme.primary, 0.3) : theme.border,
            },
          ]}
        >
          <Icon name={icon} size={22} color={selected ? theme.accent : theme.textDim} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: theme.textDim }]}>{desc}</Text>
        </View>
        <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.textFaint }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.page}>
          <View style={styles.steps}>
            <View style={[styles.stepBar, { backgroundColor: withAlpha(theme.primary, 0.35) }]} />
            <View style={styles.stepBar}>
              <LinearGradient
                colors={['#FF6B7E', '#E9435E']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Text style={[styles.stepText, { color: theme.textFaint }]}>STEP 2 / 2</Text>
          </View>

          <Text style={[styles.brand, { color: theme.textFaint }]}>{KISSA.wordmark} · {KISSA.tagline}</Text>
          <Text style={[styles.title, { color: theme.text }]}>How old are you?</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Iske hisaab se tumhe sahi stories dikhengi. 12–17 walo ko sirf age-appropriate catalog dikhega.
          </Text>
        </View>
        <View style={styles.page}>
          {card('12-17', 'school-outline', '12–17', 'Teen-safe stories. Mature content hidden rahega.')}
          <View style={{ height: SPACING.md }} />
          {card('18+', 'moon-outline', '18+', 'Full catalog — teen + mature stories.')}
          <Text style={[styles.privacy, { color: theme.textFaint }]}>
            Age is stored on your device and only filters the catalog.
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.page}>
          <GradientButton title="Get Started" disabled={!age} loading={saving} onPress={getStarted} />
          <Text style={[styles.note, { color: theme.textFaint }]}>
            Baad mein Settings → Profile se badal sakte ho.
          </Text>
        </View>
        <View style={{ height: SPACING.lg }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACING.xl },
  page: { width: '100%', maxWidth: LAYOUT.contentMaxWidth, alignSelf: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepBar: { flex: 1, height: 3, borderRadius: RADIUS.pill, overflow: 'hidden' },
  stepText: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.2, marginLeft: 3 },
  brand: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1.4, marginTop: SPACING.xxl },
  title: { ...TYPE.displayXL, marginTop: SPACING.md, marginBottom: SPACING.sm },
  sub: { fontSize: SCALE.body, lineHeight: 23, marginBottom: SPACING.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    minHeight: 76,
  },
  emojiBox: { width: 42, height: 42, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: SCALE.title, fontWeight: '800' },
  cardDesc: { fontSize: SCALE.small, marginTop: 3, lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  spacer: { flex: 1 },
  note: { fontSize: SCALE.micro, textAlign: 'center', marginTop: SPACING.md },
  privacy: { fontSize: SCALE.micro, fontWeight: '600', marginTop: SPACING.md, lineHeight: 16 },
});
