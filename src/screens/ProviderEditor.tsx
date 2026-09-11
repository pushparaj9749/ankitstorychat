/** Add / edit one AI provider + test connection. Key -> SecureStore only. */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIError, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { getProvider, upsertProvider } from '../lib/db';
import { getApiKey, hasApiKey, saveApiKey } from '../lib/secureKeys';
import { aiErrorMessage, normalizeBaseUrl, PROVIDER_PRESETS, testConnection } from '../lib/ai';
import { FONTS, RADIUS, SPACING } from '../theme';
import { nowIso, uid } from '../lib/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderEditor'>;

export function ProviderEditor({ navigation, route }: Props) {
  const { theme, refreshProviders, updateSettings, settings } = useApp();
  const editingId = route.params.providerId;

  const [name, setName] = useState('My AI');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const p = await getProvider(editingId);
      if (p) {
        setName(p.name);
        setBaseUrl(p.baseUrl);
        setModel(p.model);
        setKeySaved(await hasApiKey(p.id));
      }
    })();
  }, [editingId]);

  function applyPreset(i: number) {
    const pr = PROVIDER_PRESETS[i];
    setName(pr.label);
    setBaseUrl(pr.baseUrl);
    setModel(pr.model);
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    setTestOk(null);
    try {
      let key = apiKey.trim();
      if (!key && editingId) key = (await getApiKey(editingId)) ?? '';
      if (!key) throw new Error('Pehle API key daalo, phir Test karo.');
      const res = await testConnection(
        { baseUrl: normalizeBaseUrl(baseUrl), model: model.trim(), temperature: 0.2 },
        key,
      );
      if (res.ok) {
        setTestOk(true);
        setTestResult(`Connected! Provider replied: "${res.sample || 'OK'}"`);
      } else {
        setTestOk(false);
        setTestResult(aiErrorMessage(res.error as AIError));
      }
    } catch (e) {
      setTestOk(false);
      setTestResult(e instanceof Error ? e.message : 'Test failed.');
    } finally {
      setTesting(false);
    }
  }

  async function onSave() {
    setError(null);
    if (!name.trim()) return setError('Provider ka naam likho.');
    if (!normalizeBaseUrl(baseUrl)) return setError('Base URL likho (https://...).');
    if (!model.trim()) return setError('Model ka naam likho.');
    const key = apiKey.trim();
    if (!key && !keySaved) return setError('API key daalo (sirf device par save hogi).');
    setSaving(true);
    try {
      const now = nowIso();
      const id = editingId ?? uid('prov');
      const existing = editingId ? await getProvider(editingId) : null;
      await upsertProvider({
        id,
        name: name.trim(),
        type: 'openai-compatible',
        baseUrl: normalizeBaseUrl(baseUrl),
        model: model.trim(),
        temperature: existing?.temperature ?? 0.8,
        maxTokens: existing?.maxTokens ?? 600,
        enabled: true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastTestedAt: testOk !== null ? now : existing?.lastTestedAt ?? null,
        lastTestOk: testOk ?? existing?.lastTestOk ?? null,
      });
      if (key) await saveApiKey(id, key);
      // First provider becomes active automatically.
      if (!settings.activeProviderId) await updateSettings({ activeProviderId: id });
      await refreshProviders();
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>
          {editingId ? 'Edit provider' : 'Add AI provider'}
        </Text>

        <Text style={[styles.label, { color: theme.textDim }]}>Preset</Text>
        <View style={styles.presets}>
          {PROVIDER_PRESETS.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => applyPreset(i)}
              style={[styles.preset, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.presetText, { color: theme.text }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          Preset sirf URL/model bharta hai — API key TUMHARI hogi.
        </Text>

        <Field label="Name" value={name} onChange={setName} placeholder="e.g. My OpenAI" theme={theme} />
        <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://..." autoCapitalize="none" theme={theme} />
        <Field label="Model" value={model} onChange={setModel} placeholder="e.g. gpt-4o-mini" autoCapitalize="none" theme={theme} />
        <Field
          label={keySaved && !apiKey ? 'API key (saved •••• — replace?)' : 'API key'}
          value={apiKey}
          onChange={setApiKey}
          placeholder={keySaved ? 'Nayi key yahan daalo (optional)' : 'sk-...'}
          secure
          autoCapitalize="none"
          theme={theme}
        />
        <Text style={[styles.hint, { color: theme.textFaint }]}>
          🔒 Key Android Keystore / iOS Keychain mein save hoti hai. GitHub par kabhi nahi jaati.
        </Text>

        {testResult ? (
          <View
            style={[
              styles.testBox,
              { backgroundColor: theme.surface, borderColor: testOk ? theme.success : theme.danger },
            ]}
          >
            <Text style={[styles.testText, { color: testOk ? theme.success : theme.danger }]}>
              {testOk ? '✅ ' : '❌ '}{testResult}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <View style={styles.btns}>
          <View style={styles.half}>
            <GradientButton title="Test" variant="ghost" loading={testing} onPress={onTest} />
          </View>
          <View style={styles.half}>
            <GradientButton title="Save" loading={saving} onPress={onSave} />
          </View>
        </View>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
  autoCapitalize,
  theme,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  autoCapitalize?: 'none';
  theme: { surface: string; border: string; text: string; textFaint: string; textDim: string };
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textDim }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  label: { fontSize: FONTS.small, fontWeight: '700', marginBottom: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  presetText: { fontSize: FONTS.small, fontWeight: '600' },
  hint: { fontSize: FONTS.tiny, marginTop: 6, lineHeight: 17 },
  field: { marginTop: 14 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  testBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 14 },
  testText: { fontSize: FONTS.small, lineHeight: 20 },
  error: { fontSize: FONTS.small, marginTop: 10 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  half: { flex: 1 },
});
