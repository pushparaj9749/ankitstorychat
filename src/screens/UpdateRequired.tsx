/**
 * Update gate — a full-screen block for installs older than the server's
 * minimum version (v2.14 account rollout).
 *
 * Nothing else is mounted while this is showing: the account system, the API
 * and the story sync all expect the current app.
 */
import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { KISSA_LOGO } from '../components/brand';
import { RELEASES_PAGE } from '../lib/links';
import { SPACING, TYPE } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UpdateRequired'>;

export function UpdateRequired(_props: Props) {
  const { theme } = useApp();
  return (
    <Screen>
      <View style={styles.page}>
        <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Kissa" />
        <Text style={[styles.title, { color: theme.text }]}>Kissa update karo</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          Ye version purana ho gaya hai. Ab accounts, submissions aur notifications naye version me hi
          chalte hain — purana app kaam nahi karega.
        </Text>
        <GradientButton
          title="Naya version download karo"
          onPress={() => {
            void Linking.openURL(RELEASES_PAGE);
          }}
          accessibilityLabel="Download the new Kissa version"
        />
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          Tumhari kahaniyan, chats aur saves isi device par safe hain — update ke baad sab wahin milega.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.page, gap: SPACING.md },
  logo: { width: 72, height: 72, marginBottom: SPACING.sm },
  title: { ...TYPE.display, textAlign: 'center' },
  sub: { ...TYPE.body, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.md },
  hint: { ...TYPE.caption, textAlign: 'center', lineHeight: 17, marginTop: SPACING.md },
});
