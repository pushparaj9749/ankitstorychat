/**
 * Submission Success Confirmation Screen.
 * Kissa v2.4.1.
 */
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.checkCircle, { backgroundColor: withAlpha(theme.success, 0.15), borderColor: theme.success }]}>
          <Text style={[styles.check, { color: theme.success }]}>✓</Text>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Submitted Successfully</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          {type === 'idea'
            ? 'Your story idea is now in the review queue. The Kissa curation team will review it within 24 hours.'
            : 'Your story submission is in the review queue. Once approved, it will be added to the live catalog.'}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
            SHADOWS.card,
          ]}
        >
          <Row label="Type" value={type === 'idea' ? '💡 Story Concept' : '📖 Complete Story Package'} />
          <Row label="Creator" value={creatorName} />
          <Row label="Submission ID" value={id} mono />
          <Row label="Review Window" value={`Expires in ${formatRemaining(remaining)} (24h)`} />
        </View>

        <Text style={[styles.note, { color: theme.textFaint }]}>
          Pending submissions are strictly private. If approved, your name will be credited as author.
        </Text>

        <View style={{ height: SPACING.xl }} />
        <GradientButton title="Return to Home" onPress={() => navigation.popToTop()} />
        <View style={{ height: SPACING.md }} />
        <GradientButton
          title="Submit Another"
          variant="ghost"
          onPress={() => navigation.replace('SubmitStory', { mode: type })}
        />
        <View style={{ height: SPACING.xxl }} />
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
        style={[
          styles.rowValue,
          {
            color: theme.text,
            fontFamily: mono ? (Platform.select({ ios: 'Menlo', default: 'monospace' }) as string) : undefined,
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 40, paddingBottom: 40 },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  check: { fontSize: 44, fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontSize: FONTS.body, textAlign: 'center', marginTop: 10, lineHeight: 22, paddingHorizontal: 16 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginTop: SPACING.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  rowLabel: { fontSize: FONTS.small, fontWeight: '700', width: 110 },
  rowValue: { fontSize: FONTS.small, flex: 1, textAlign: 'right', fontWeight: '600' },
  note: { fontSize: FONTS.small, marginTop: SPACING.lg, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
});
