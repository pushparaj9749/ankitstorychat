/** Appearance: theme, text size, animations, reduced motion. All live. */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsAppearance'>;

export function SettingsAppearance(_props: Props) {
  const { theme, settings, updateSettings } = useApp();

  function optionRow<T extends string>(label: string, value: T, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        key={value}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[
          styles.opt,
          {
            backgroundColor: selected ? theme.primarySoft : theme.surface,
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
      >
        <Text style={[styles.optText, { color: selected ? '#D9CFFF' : theme.text }]}>{label}</Text>
      </Pressable>
    );
  }

  function toggleRow(label: string, desc: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View style={[styles.toggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.toggleBody}>
          <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.toggleDesc, { color: theme.textDim }]}>{desc}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} />
      </View>
    );
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>Appearance</Text>
      <SectionHeader title="Theme" />
      <View style={styles.row}>
        {optionRow('🌙 Midnight', 'midnight', settings.theme === 'midnight', () => void updateSettings({ theme: 'midnight' }))}
        {optionRow('⬛ AMOLED', 'amoled', settings.theme === 'amoled', () => void updateSettings({ theme: 'amoled' }))}
      </View>
      <SectionHeader title="Text size" />
      <View style={styles.row}>
        {optionRow('Small', 'small', settings.textSize === 'small', () => void updateSettings({ textSize: 'small' }))}
        {optionRow('Medium', 'medium', settings.textSize === 'medium', () => void updateSettings({ textSize: 'medium' }))}
        {optionRow('Large', 'large', settings.textSize === 'large', () => void updateSettings({ textSize: 'large' }))}
      </View>
      <Text style={[styles.preview, { color: theme.textDim, fontSize: [13, 15, 18][['small', 'medium', 'large'].indexOf(settings.textSize)] }]}>
        Preview: "Arre, tum yahan itni raat ko kya kar rahe ho?"
      </Text>
      <SectionHeader title="Motion" />
      {toggleRow('Animations', 'Smooth transitions across the app', settings.animations, (v) => void updateSettings({ animations: v }))}
      {toggleRow('Reduced motion', 'Minimize movement effects', settings.reducedMotion, (v) => void updateSettings({ reducedMotion: v }))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  opt: { flex: 1, borderWidth: 2, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  optText: { fontWeight: '700', fontSize: FONTS.small },
  preview: { marginTop: 12, fontStyle: 'italic' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  toggleBody: { flex: 1 },
  toggleLabel: { fontSize: FONTS.body, fontWeight: '700' },
  toggleDesc: { fontSize: FONTS.small, marginTop: 2 },
});
