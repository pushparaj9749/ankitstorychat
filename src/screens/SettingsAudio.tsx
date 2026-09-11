/** Audio: message sounds, ambient music, haptics. All wired live. */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { setAmbientPlaying } from '../lib/sound';
import { FONTS, RADIUS } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsAudio'>;

export function SettingsAudio(_props: Props) {
  const { theme, settings, updateSettings } = useApp();

  async function setMusic(v: boolean) {
    await updateSettings({ music: v });
    setAmbientPlaying(v);
  }

  function row(label: string, desc: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.body}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.desc, { color: theme.textDim }]}>{desc}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} />
      </View>
    );
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>Sound & Haptics</Text>
      {row('Message sounds', 'Soft blips when you send / receive', settings.sound, (v) =>
        void updateSettings({ sound: v }),
      )}
      {row('Ambient music', 'Gentle loop while you read stories', settings.music, (v) =>
        void setMusic(v),
      )}
      {row('Haptics', 'Subtle vibrations on send & milestones', settings.haptics, (v) =>
        void updateSettings({ haptics: v }),
      )}
      <Text style={[styles.note, { color: theme.textFaint }]}>
        🎵 All sounds are original, generated for Kissa. No downloads, no streaming.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  body: { flex: 1 },
  label: { fontSize: FONTS.body, fontWeight: '700' },
  desc: { fontSize: FONTS.small, marginTop: 2 },
  note: { fontSize: FONTS.tiny, marginTop: 8, lineHeight: 18 },
});
