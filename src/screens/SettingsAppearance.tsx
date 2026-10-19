/**
 * Appearance Settings: Theme, text size, animations, reduced motion.
 * Kissa v2.4.2.
 */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { COLORS, GRADIENTS, RADIUS, SCALE, SHADOWS, SPACING, TYPE, withAlpha, type UiTemplate } from '../theme';
import { COLORS as CLASSIC_COLORS, GRADIENTS as CLASSIC_GRADIENTS } from '../ui/classic/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/icons';

/** The two whole-app looks, shown as mini previews. */
const TEMPLATES: { id: UiTemplate; name: string; tag: string; desc: string; bg: string; surface: string; accent: string; grad: readonly [string, string, ...string[]] }[] = [
  {
    id: 'noir',
    name: 'Kissa Noir',
    tag: 'NAYA',
    desc: 'Clean & professional — neutral dark, ek soft rose accent.',
    bg: COLORS.midnight.bg,
    surface: COLORS.midnight.surface2,
    accent: COLORS.midnight.primary,
    grad: GRADIENTS.primary,
  },
  {
    id: 'classic',
    name: 'Kissa Night',
    tag: 'PURANA',
    desc: 'Colourful night look — pink-violet gradients, gold accents.',
    bg: CLASSIC_COLORS.midnight.bg,
    surface: CLASSIC_COLORS.midnight.surface2,
    accent: CLASSIC_COLORS.midnight.primary,
    grad: CLASSIC_GRADIENTS.primary,
  },
];
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

      <SectionHeader title="UI Template" kicker="Poore app ka look" />
      <View style={styles.row}>
        {TEMPLATES.map((t) => {
          const selected = (settings.uiTemplate ?? 'noir') === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                lightBuzz();
                void updateSettings({ uiTemplate: t.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t.name} template`}
              style={({ pressed }) => [
                styles.tpl,
                { borderColor: selected ? theme.primary : theme.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {/* mini preview */}
              <View style={[styles.tplPreview, { backgroundColor: t.bg }]}>
                <View style={[styles.tplLine, { width: '58%', backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                <View style={[styles.tplLine, { width: '38%', backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 5 }]} />
                <View style={[styles.tplCard, { backgroundColor: t.surface }]}>
                  <LinearGradient colors={[...t.grad] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tplBtn} />
                </View>
                <View style={styles.tplDots}>
                  <View style={[styles.tplDot, { backgroundColor: t.accent }]} />
                  <View style={[styles.tplDot, { backgroundColor: t.surface }]} />
                  <View style={[styles.tplDot, { backgroundColor: t.surface }]} />
                </View>
                {selected ? (
                  <View style={[styles.tplCheck, { backgroundColor: theme.primary }]}>
                    <Icon name="checkmark" size={12} color="#fff" />
                  </View>
                ) : null}
              </View>
              <View style={styles.tplBody}>
                <View style={styles.tplTitleRow}>
                  <Text style={[styles.tplName, { color: theme.text }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.tplTag, { color: selected ? theme.primary : theme.textFaint }]}>{t.tag}</Text>
                </View>
                <Text style={[styles.tplDesc, { color: theme.textDim }]} numberOfLines={3}>{t.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Visual Theme" kicker="Palette" />
      <View style={styles.row}>
        {optionRow('Midnight Obsidian', 'midnight', settings.theme === 'midnight', () =>
          void updateSettings({ theme: 'midnight' }),
        )}
        {optionRow('Pure AMOLED', 'amoled', settings.theme === 'amoled', () =>
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
  title: { ...TYPE.displaySmall, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  opt: { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  optText: { fontWeight: '700', fontSize: SCALE.small },
  tpl: { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.lg, overflow: 'hidden' },
  tplPreview: { height: 112, padding: 12 },
  tplLine: { height: 6, borderRadius: 3 },
  tplCard: { marginTop: 12, height: 40, borderRadius: 10, padding: 8, justifyContent: 'flex-end' },
  tplBtn: { height: 12, width: '64%', borderRadius: 6 },
  tplDots: { flexDirection: 'row', gap: 5, marginTop: 9 },
  tplDot: { width: 7, height: 7, borderRadius: 3.5 },
  tplCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tplBody: { padding: 11 },
  tplTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tplName: { fontSize: SCALE.body, fontWeight: '700', flexShrink: 1 },
  tplTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tplDesc: { fontSize: SCALE.caption, lineHeight: 17, marginTop: 4 },
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
  toggleLabel: { fontSize: SCALE.body, fontWeight: '700' },
  toggleDesc: { fontSize: SCALE.small, marginTop: 2 },
});
