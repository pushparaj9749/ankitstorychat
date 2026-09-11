/**
 * AI Add-ons: user configures their OWN AI provider.
 * Explains clearly: APP LIMIT = none; PROVIDER LIMITS = provider's own.
 */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { EmptyState } from '../components/states';
import { deleteProvider } from '../lib/db';
import { deleteApiKey } from '../lib/secureKeys';
import { FONTS, RADIUS, SPACING } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AIAddons'>;

export function AIAddons({ navigation }: Props) {
  const {
    theme,
    providers,
    providersWithKeys,
    settings,
    updateSettings,
    refreshProviders,
  } = useApp();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => void refreshProviders());
    return unsub;
  }, [navigation, refreshProviders]);

  async function setActive(id: string | null) {
    setBusy(true);
    try {
      await updateSettings({ activeProviderId: id });
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert('Delete provider?', `"${name}" aur uski saved API key device se delete ho jayegi.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await deleteProvider(id);
            await deleteApiKey(id);
            if (settings.activeProviderId === id) await updateSettings({ activeProviderId: null });
            await refreshProviders();
          })(),
      },
    ]);
  }

  const offlineActive = !settings.activeProviderId;

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>🤖 AI Add-ons</Text>
      <View style={[styles.info, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.infoText, { color: theme.textDim }]}>
          <Text style={{ color: theme.success, fontWeight: '800' }}>APP LIMIT: NONE</Text>
          {' — Kissa tumhari chat kabhi limit nahi karta. Koi coins, koi energy, koi daily cap nahi.\n\n'}
          <Text style={{ color: theme.accent, fontWeight: '800' }}>PROVIDER LIMITS:</Text>
          {' — tum apni API key lagate ho; us provider ke apne rates/limits apply honge. Key sirf tumhare device par rehti hai 🔒'}
        </Text>
      </View>

      <SectionHeader title="Mode" />
      <Pressable
        onPress={() => void setActive(null)}
        disabled={busy}
        style={[
          styles.card,
          {
            backgroundColor: offlineActive ? theme.primarySoft : theme.surface,
            borderColor: offlineActive ? theme.primary : theme.border,
          },
        ]}
      >
        <Text style={styles.emoji}>📖</Text>
        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.text }]}>Offline Story Mode</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Bina AI key ke scripted kahaniyan. Hamesha free, hamesha offline.
          </Text>
        </View>
        <Switch value={offlineActive} onValueChange={() => void setActive(null)} disabled={busy} />
      </Pressable>

      <SectionHeader title="Your providers" />
      {providers.length === 0 ? (
        <EmptyState
          emoji="🔑"
          title="No AI provider yet"
          subtitle="Apni API key add karo for free-style AI chat with story characters."
        />
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => p.id}
          scrollEnabled={false}
          renderItem={({ item: p }) => {
            const active = settings.activeProviderId === p.id;
            const hasKey = providersWithKeys.has(p.id);
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: active ? theme.primarySoft : theme.surface,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <View style={styles.body}>
                  <Text style={[styles.name, { color: theme.text }]}>
                    {p.name} {active ? '✓' : ''}
                  </Text>
                  <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={1}>
                    {p.model || '(no model)'} • {hasKey ? '🔑 key saved' : '⚠️ no key'}
                  </Text>
                  <Text style={[styles.sub, { color: theme.textFaint }]} numberOfLines={1}>
                    {p.baseUrl}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {!active ? (
                    <Pressable onPress={() => void setActive(p.id)} style={styles.link}>
                      <Text style={[styles.linkText, { color: theme.primary }]}>Use</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => navigation.navigate('ProviderEditor', { providerId: p.id })}
                    style={styles.link}
                  >
                    <Text style={[styles.linkText, { color: theme.textDim }]}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(p.id, p.name)} style={styles.link}>
                    <Text style={[styles.linkText, { color: theme.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={{ height: SPACING.md }} />
      <GradientButton title="+ Add AI provider" onPress={() => navigation.navigate('ProviderEditor', {})} />
      <View style={{ height: SPACING.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  info: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12 },
  infoText: { fontSize: FONTS.small, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  emoji: { fontSize: 26 },
  body: { flex: 1 },
  name: { fontSize: FONTS.body, fontWeight: '800' },
  sub: { fontSize: FONTS.small, marginTop: 2 },
  actions: { gap: 6, alignItems: 'flex-end' },
  link: { paddingVertical: 2, paddingHorizontal: 4 },
  linkText: { fontWeight: '700', fontSize: FONTS.small },
});
