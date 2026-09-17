/** "Submitted successfully" confirmation screen. */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SPACING } from '../theme';
import { formatRemaining } from '../content/submissions';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmissionSuccess'>;

export function SubmissionSuccess({ navigation, route }: Props) {
  const { theme } = useApp();
  const { id, type, creatorName, resetsAt } = route.params;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, resetsAt - now);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.check, { color: theme.success }]}>✓</Text>
        <Text style={[styles.title, { color: theme.text }]}>Submitted successfully.</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          {type === 'idea'
            ? 'Your idea is now in the review queue. The Kissa team will look at it within 24 hours.'
            : 'Your story is now in the review queue. If approved it will appear in the catalog.'}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="Type" value={type === 'idea' ? '💡 Idea' : '📖 Complete story'} />
          <Row label="Creator" value={creatorName} />
          <Row label="Submission ID" value={id} mono />
          <Row label="Review window" value={`Expires in ${formatRemaining(remaining)} (24h)`} />
        </View>

        <Text style={[styles.note, { color: theme.textFaint }]}>
          Pending submissions are private — they do not appear in the catalog, search or story API until
          approved. If rejected they are removed automatically.
        </Text>

        <View style={{ height: SPACING.xl }} />
        <GradientButton title="Done" onPress={() => navigation.popToTop()} />
        <View style={{ height: SPACING.md }} />
        <GradientButton title="Submit another" variant="ghost" onPress={() => navigation.replace('SubmitStory', { mode: type })} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { theme } = useApp();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textDim }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: theme.text, fontFamily: mono ? (Platform.select({ ios: 'Menlo', default: 'monospace' }) as string) : undefined }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: { paddingTop: 40, paddingBottom: 40 },
  check: { fontSize: 64, textAlign: 'center', fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  sub: { fontSize: FONTS.body, textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: 20 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginTop: SPACING.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  rowLabel: { fontSize: FONTS.small, fontWeight: '700', width: 110 },
  rowValue: { fontSize: FONTS.small, flex: 1, textAlign: 'right' },
  note: { fontSize: FONTS.small, marginTop: SPACING.lg, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
