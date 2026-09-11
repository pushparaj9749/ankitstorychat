/** Shared legal-document renderer (Terms, Privacy). */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { FONTS, SPACING } from '../theme';

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
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.updated, { color: theme.textFaint }]}>Updated: {updated}</Text>
        {sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={[styles.heading, { color: theme.accent }]}>{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={[styles.para, { color: theme.textDim }]}>
                {p}
              </Text>
            ))}
          </View>
        ))}
        {footer ? <Text style={[styles.footer, { color: theme.textFaint }]}>{footer}</Text> : null}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900', marginTop: 8 },
  updated: { fontSize: FONTS.small, marginTop: 4, marginBottom: 8 },
  section: { marginTop: 16 },
  heading: { fontSize: FONTS.body, fontWeight: '800', marginBottom: 6 },
  para: { fontSize: FONTS.small, lineHeight: 21, marginBottom: 8 },
  footer: { fontSize: FONTS.tiny, marginTop: 20, fontStyle: 'italic', lineHeight: 18 },
});
