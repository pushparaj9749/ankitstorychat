/**
 * AI Setup / Providers — Redesigned for Kissa v2.4.2.
 * Mandatory AI configuration with clean visual cards.
 */
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader } from '../components/bits';
import { EmptyState } from '../components/states';
import { deleteProvider } from '../lib/db';
import { deleteApiKey } from '../lib/secureKeys';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

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
  const [_busy, setBusy] = useState(false);

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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>INTELLIGENCE ENGINE</Text>
        <Text style={[styles.title, { color: theme.text }]}>AI Setup</Text>
      </View>

      <View
        style={[
          styles.info,
          {
            backgroundColor: withAlpha(theme.surface, 0.92),
            borderColor: theme.border,
          },
          SHADOWS.card,
        ]}
      >
        <Text style={[styles.infoText, { color: theme.textDim }]}>
          <Text style={{ color: theme.accent, fontWeight: '800' }}>AI STORY CHAT:</Text>
          {' Kissa brings characters to life with an OpenAI-compatible LLM.\n\n'}
          <Text style={{ color: theme.accentAmber, fontWeight: '800' }}>PRIVATE API KEY:</Text>
          {' Your key stays encrypted on your device and is never sent to our servers.'}
        </Text>
      </View>

      <SectionHeader title="Your Providers" kicker="Configured" />
      {providers.length === 0 ? (
        <EmptyState
          icon="key-outline"
          title="No AI provider added"
          subtitle="Add an API key to bring story characters and worlds to life."
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
                    backgroundColor: active ? theme.primarySoft : withAlpha(theme.surface, 0.88),
                    borderColor: active ? theme.accent : theme.border,
                  },
                  SHADOWS.card,
                ]}
              >
                <View style={styles.body}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: theme.text }]}>{p.name}</Text>
                    {active ? (
                      <View style={[styles.activeBadge, { backgroundColor: theme.accent }]}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={1}>
                    {p.model || '(no model)'} • {hasKey ? 'Key Encrypted' : 'No key'}
                  </Text>
                  <Text style={[styles.subUrl, { color: theme.textFaint }]} numberOfLines={1}>
                    {p.baseUrl}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {!active ? (
                    <Pressable
                      onPress={() => void setActive(p.id)}
                      style={[styles.useBtn, { backgroundColor: theme.primary }]}
                    >
                      <Text style={styles.useBtnText}>Use</Text>
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
      <GradientButton
        title="+ Add AI Provider"
        onPress={() => navigation.navigate('ProviderEditor', {})}
      />
      <View style={{ height: SPACING.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  info: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 10 },
  infoText: { fontSize: FONTS.small, lineHeight: 21 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: FONTS.body, fontWeight: '800' },
  activeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  activeBadgeText: { color: '#0E070B', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  sub: { fontSize: FONTS.small, marginTop: 2 },
  subUrl: { fontSize: FONTS.tiny, marginTop: 1 },
  actions: { gap: 8, alignItems: 'flex-end' },
  useBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  useBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  link: { paddingVertical: 2, paddingHorizontal: 4 },
  linkText: { fontWeight: '700', fontSize: FONTS.small },
});
