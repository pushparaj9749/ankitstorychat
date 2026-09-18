/**
 * Appearance Settings: Theme, text size, animations, reduced motion.
 * Kissa v2.4.1.
 */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { lightBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsAppearance'>;

export function SettingsAppearance(_props: Props) {
  const { theme, settings, updateSettings } = useApp();

  function optionRow<T extends string>(label: string, value: T, selected: boolean, onPress: () => void) {
    return (
      <Pressable
        key={value}
        onPress={() => {
          lightBuzz();
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[
          styles.opt,
          {
            backgroundColor: selected ? theme.primarySoft : withAlpha(theme.surface, 0.9),
            borderColor: selected ? theme.accent : theme.border,
          },
          SHADOWS.card,
        ]}
      >
        <Text style={[styles.optText, { color: selected ? theme.accent : theme.text }]}>{label}</Text>
      </Pressable>
    );
  }

  function toggleRow(label: string, desc: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View
        style={[
          styles.toggle,
          { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
          SHADOWS.card,
        ]}
      >
        <View style={styles.toggleBody}>
          <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.toggleDesc, { color: theme.textDim }]}>{desc}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.surface2, true: theme.primary }}
          thumbColor={value ? theme.accent : theme.textFaint}
        />
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>DISPLAY & FEEL</Text>
        <Text style={[styles.title, { color: theme.text }]}>Appearance</Text>
      </View>

      <SectionHeader title="Visual Theme" kicker="Palette" />
      <View style={styles.row}>
        {optionRow('🌙 Midnight Obsidian', 'midnight', settings.theme === 'midnight', () =>
          void updateSettings({ theme: 'midnight' }),
        )}
        {optionRow('⬛ Pure AMOLED', 'amoled', settings.theme === 'amoled', () =>
          void updateSettings({ theme: 'amoled' }),
        )}
      </View>

      <SectionHeader title="Typography Scale" kicker="Reading" />
      <View style={styles.row}>
        {optionRow('Small', 'small', settings.textSize === 'small', () =>
          void updateSettings({ textSize: 'small' }),
        )}
        {optionRow('Standard', 'medium', settings.textSize === 'medium', () =>
          void updateSettings({ textSize: 'medium' }),
        )}
        {optionRow('Large', 'large', settings.textSize === 'large', () =>
          void updateSettings({ textSize: 'large' }),
        )}
      </View>

      <View
        style={[
          styles.previewBox,
          { backgroundColor: withAlpha(theme.surface, 0.7), borderColor: theme.border },
        ]}
      >
        <Text
          style={[
            styles.preview,
            {
              color: theme.textDim,
              fontSize: [13, 15, 18][['small', 'medium', 'large'].indexOf(settings.textSize)],
            },
          ]}
        >
          Preview: "Arre, tum yahan itni raat ko kya kar rahe ho?"
        </Text>
      </View>

      <SectionHeader title="Motion & Effects" kicker="Performance" />
      {toggleRow('Smooth Animations', 'Fluid 60fps transitions across the app', settings.animations, (v) =>
        void updateSettings({ animations: v }),
      )}
      {toggleRow('Reduced Motion', 'Minimize movement effects for comfort', settings.reducedMotion, (v) =>
        void updateSettings({ reducedMotion: v }),
      )}

      <View style={{ height: SPACING.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  opt: { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  optText: { fontWeight: '700', fontSize: FONTS.small },
  previewBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginTop: 12 },
  preview: { fontStyle: 'italic', lineHeight: 22 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
  },
  toggleBody: { flex: 1 },
  toggleLabel: { fontSize: FONTS.body, fontWeight: '700' },
  toggleDesc: { fontSize: FONTS.small, marginTop: 2 },
});
