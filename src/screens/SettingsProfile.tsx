/**
 * Profile Settings: Nickname + Age Group (local-only storage).
 * Kissa v2.4.1.
 */
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AgeGroup, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsProfile'>;

export function SettingsProfile({ navigation }: Props) {
  const { theme, profile, saveProfile, refreshRecent } = useApp();
  const [name, setName] = useState(profile?.nickname ?? '');
  const [age, setAge] = useState<AgeGroup>(profile?.ageGroup ?? '12-17');
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length >= 2 && name.trim().length <= 20;

  async function save() {
    if (!profile || !valid || saving) return;
    const ageChanged = age !== profile.ageGroup;
    const doSave = async () => {
      setSaving(true);
      try {
        await saveProfile({ ...profile, nickname: name.trim(), ageGroup: age });
        await refreshRecent();
        navigation.goBack();
      } finally {
        setSaving(false);
      }
    };
    if (ageChanged) {
      Alert.alert(
        'Change Age Group?',
        age === '12-17'
          ? 'Mature (18+) stories will be hidden across Home, Search, and Library.'
          : 'Full catalog will be unlocked, including 18+ stories.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm & Save', onPress: () => void doSave() }],
      );
    } else {
      await doSave();
    }
  }

  function ageCard(value: AgeGroup, title: string, desc: string) {
    const selected = age === value;
    return (
      <Pressable
        onPress={() => {
          lightBuzz();
          setAge(value);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[
          styles.card,
          {
            backgroundColor: selected ? theme.primarySoft : withAlpha(theme.surface, 0.9),
            borderColor: selected ? theme.accent : theme.border,
          },
          SHADOWS.card,
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: theme.textDim }]}>{desc}</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>LOCAL IDENTITY</Text>
        <Text style={[styles.title, { color: theme.text }]}>Profile & Age</Text>
      </View>

      <Text style={[styles.label, { color: theme.textDim }]}>Your Story Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={20}
        placeholder="Nickname"
        placeholderTextColor={theme.textFaint}
        accessibilityLabel="Nickname"
        style={[
          styles.input,
          { backgroundColor: withAlpha(theme.surface, 0.94), borderColor: theme.border, color: theme.text },
        ]}
      />

      <Text style={[styles.label, { color: theme.textDim, marginTop: SPACING.lg }]}>Age Group Filter</Text>
      <View style={styles.ageRow}>
        {ageCard('12-17', '🎒 12–17', 'Teen-safe catalog')}
        {ageCard('18+', '🌙 18+', 'Full catalog (18+)')}
      </View>

      <Text style={[styles.note, { color: theme.textFaint }]}>
        🔒 Your nickname and age are stored strictly on your local device.
      </Text>

      <View style={styles.spacer} />
      <GradientButton title="Save Changes" disabled={!valid} loading={saving} onPress={save} />
      <View style={{ height: SPACING.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2, marginBottom: 12 },
  label: { fontSize: FONTS.small, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  ageRow: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.lg, padding: 14 },
  cardTitle: { fontSize: FONTS.body, fontWeight: '800' },
  cardDesc: { fontSize: FONTS.tiny, marginTop: 4, lineHeight: 16 },
  note: { fontSize: FONTS.tiny, marginTop: SPACING.md, lineHeight: 18 },
  spacer: { flex: 1 },
});
