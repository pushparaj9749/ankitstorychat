/**
 * Update gate — a full-screen block for installs older than the server's
 * minimum version (v2.14 account rollout).
 *
 * Nothing else is mounted while this is showing: the account system, the API
 * and the story sync all expect the current app.
 */
import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { ActivityIndicator } from 'react-native';
import { KISSA_LOGO } from '../components/brand';
import { RELEASES_PAGE } from '../lib/links';
import { SPACING, TYPE } from '../theme';
import { appVersion } from '../lib/account';

type Props = NativeStackScreenProps<RootStackParamList, 'UpdateRequired'>;

export function UpdateRequired(_props: Props) {
  const { theme, recheckUpdateGate, minVersion } = useApp();
  const [checking, setChecking] = useState(false);
  const current = appVersion();

  /**
   * The wall is a server verdict, but it also used to be sticky: a remembered
   * 426 kept it up even after the server said the install was fine. This button
   * re-asks the server and closes the wall if the answer is "you're current" —
   * so nobody has to clear app data to get back in.
   */
  async function recheck() {
    if (checking) return;
    setChecking(true);
    try {
      await recheckUpdateGate();
    } finally {
      setChecking(false);
    }
  }

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
        <Pressable
          onPress={() => void recheck()}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Dobara check karo"
          style={({ pressed }) => [styles.recheck, { opacity: pressed || checking ? 0.6 : 1 }]}
        >
          {checking ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Text style={[styles.recheckText, { color: theme.accent }]}>Dobara check karo</Text>
          )}
        </Pressable>
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          {`Is app me ${current}${minVersion ? ` · server ko ${minVersion} chahiye` : ''}`}
        </Text>
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
  hint: { ...TYPE.caption, textAlign: 'center', lineHeight: 17, marginTop: SPACING.sm },
  recheck: { paddingVertical: 8, paddingHorizontal: 12 },
  recheckText: { ...TYPE.caption, fontWeight: '700' },
});
