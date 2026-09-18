/**
 * Shared legal-document renderer (Terms, Privacy).
 * Kissa v2.4.2.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { FONTS, RADIUS, SPACING, TYPE, withAlpha } from '../theme';

export interface LegalSectionT {
  heading: string;
  body: string[];
}

export function LegalDoc({
  title,
  updated,
  sections,
  footer,
}: {
  title: string;
  updated: string;
  sections: LegalSectionT[];
  footer?: string;
}) {
  const { theme } = useApp();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>LEGAL & POLICIES</Text>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.updated, { color: theme.textFaint }]}>Last Updated: {updated}</Text>
        </View>

        {sections.map((s) => (
          <View
            key={s.heading}
            style={[
              styles.sectionCard,
              { backgroundColor: withAlpha(theme.surface, 0.85), borderColor: theme.border },
            ]}
          >
            <Text style={[styles.heading, { color: theme.accent }]}>{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={[styles.para, { color: theme.textDim }]}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        {footer ? <Text style={[styles.footer, { color: theme.textFaint }]}>{footer}</Text> : null}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 10 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  updated: { fontSize: FONTS.small, marginTop: 4, marginBottom: 8 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 12,
  },
  heading: { fontSize: FONTS.body, fontWeight: '800', marginBottom: 8 },
  para: { fontSize: FONTS.small, lineHeight: 22, marginBottom: 8 },
  footer: { fontSize: FONTS.tiny, marginTop: 24, fontStyle: 'italic', lineHeight: 18, textAlign: 'center' },
});
