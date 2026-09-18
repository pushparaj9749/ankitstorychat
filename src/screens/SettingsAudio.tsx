/**
 * Audio Settings: Sound effects, ambient music, and haptic feedback.
 * Kissa v2.4.1.
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { setAmbientPlaying } from '../lib/sound';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsAudio'>;

export function SettingsAudio(_props: Props) {
  const { theme, settings, updateSettings } = useApp();

  async function setMusic(v: boolean) {
    await updateSettings({ music: v });
    setAmbientPlaying(v);
  }

  function row(label: string, desc: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
          SHADOWS.card,
        ]}
      >
        <View style={styles.body}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.textDim }]}>{desc}</Text>
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
        <Text style={[styles.kicker, { color: theme.accent }]}>ATMOSPHERE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Sound & Haptics</Text>
      </View>

      {row('Message Sounds', 'Subtle audio cues during interactive dialogue', settings.sound, (v) =>
        void updateSettings({ sound: v }),
      )}
      {row('Ambient Music', 'Cinematic background mood while reading', settings.music, (v) =>
        void setMusic(v),
      )}
      {row('Haptics', 'Tactile vibrations on key interactions & choices', settings.haptics, (v) =>
        void updateSettings({ haptics: v }),
      )}

      <Text style={[styles.note, { color: theme.textFaint }]}>
        🎵 Original soundscapes and haptic patterns designed specifically for Kissa.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 10 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
  },
  body: { flex: 1 },
  label: { fontSize: FONTS.body, fontWeight: '700' },
  desc: { fontSize: FONTS.small, marginTop: 2 },
  note: { fontSize: FONTS.tiny, marginTop: 10, lineHeight: 18 },
});
