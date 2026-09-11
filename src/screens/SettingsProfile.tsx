/** Profile settings: nickname + age group (local only). */
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AgeGroup, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SPACING } from '../theme';

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
        'Age group badal rahe ho?',
        age === '12-17'
          ? 'Mature (18+) stories hide ho jayengi — Home, Search, sab jagah.'
          : 'Full catalog dikhega, including 18+ stories. Sirf tab karo jab tum 18+ ho.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: () => void doSave() }],
      );
    } else {
      await doSave();
    }
  }

  function ageCard(value: AgeGroup, title: string, desc: string) {
    const selected = age === value;
    return (
      <Pressable
        onPress={() => setAge(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[
          styles.card,
          {
            backgroundColor: selected ? theme.primarySoft : theme.surface,
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: theme.textDim }]}>{desc}</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
      <Text style={[styles.label, { color: theme.textDim }]}>Nickname</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={20}
        placeholder="Nickname"
        placeholderTextColor={theme.textFaint}
        accessibilityLabel="Nickname"
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
      />
      <Text style={[styles.label, { color: theme.textDim, marginTop: SPACING.xl }]}>Age group</Text>
      <View style={styles.ageRow}>
        {ageCard('12-17', '12–17', 'Teen-safe catalog')}
        {ageCard('18+', '18+', 'Full catalog')}
      </View>
      <Text style={[styles.note, { color: theme.textFaint }]}>
        🔒 Sirf tumhare device par save hota hai. Koi account, koi server nahi.
      </Text>
      <View style={styles.spacer} />
      <GradientButton title="Save" disabled={!valid} loading={saving} onPress={save} />
      <View style={{ height: SPACING.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 16 },
  label: { fontSize: FONTS.small, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  ageRow: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderWidth: 2, borderRadius: RADIUS.md, padding: 12 },
  cardTitle: { fontSize: FONTS.body, fontWeight: '800' },
  cardDesc: { fontSize: FONTS.tiny, marginTop: 2 },
  note: { fontSize: FONTS.tiny, marginTop: SPACING.md, lineHeight: 18 },
  spacer: { flex: 1 },
});
