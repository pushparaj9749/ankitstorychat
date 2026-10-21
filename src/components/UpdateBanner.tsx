/**
 * "Naya version aaya hai" banner (Home). Reads only the public GitHub
 * release (see lib/updateCheck). Hidden when switched off in About, when the
 * user tapped "Baad mein" for this version, or when already up to date.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { IconGlyph } from './iconGlyph';
import { checkForUpdate, dismissUpdate, isUpdateDismissed, type ReleaseInfo } from '../lib/updateCheck';
import { RADIUS, SCALE, withAlpha } from '../theme';

/** Wait a moment after launch so the check never competes with the first paint. */
const START_DELAY_MS = 2500;

export function UpdateBanner() {
  const { theme, settings } = useApp();
  const on = settings.updateBanner !== false && Platform.OS !== 'ios';
  const [info, setInfo] = useState<{ latest: ReleaseInfo; current: string } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) {
      setInfo(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        const s = await checkForUpdate();
        if (!alive || !s.available || !s.latest) return;
        if (await isUpdateDismissed(s.latest.version)) return;
        if (!alive) return;
        setInfo({ latest: s.latest, current: s.current });
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      })();
    }, START_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [on, fade]);

  if (!on || !info) return null;

  const later = () => {
    void dismissUpdate(info.latest.version);
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setInfo(null));
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity: fade, backgroundColor: withAlpha(theme.surface2, 0.92), borderColor: withAlpha(theme.accent, 0.3) },
      ]}
      testID="update-banner"
    >
      <View style={[styles.iconWrap, { backgroundColor: withAlpha(theme.accent, 0.14) }]}>
        <IconGlyph name="download" size={20} color={theme.accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          Naya version aaya hai · v{info.latest.version}
        </Text>
        <Text style={[styles.sub, { color: theme.textDim }]} numberOfLines={2}>
          Tum v{info.current} chala rahe ho. Naye features aur fixes ke liye update kar lo — chats safe rahengi.
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => void Linking.openURL(info.latest.downloadUrl)}
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Download Kissa version ${info.latest.version}`}
          >
            <Text style={styles.primaryText}>Download</Text>
          </Pressable>
          <Pressable onPress={later} style={styles.ghost} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.ghostText, { color: theme.textFaint }]}>Baad mein</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 4, marginBottom: 14, gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: SCALE.body, fontWeight: '700' },
  sub: { fontSize: SCALE.small, marginTop: 3, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  primary: { borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8 },
  primaryText: { color: '#fff', fontSize: SCALE.small, fontWeight: '800', letterSpacing: 0.2 },
  ghost: { paddingVertical: 8 },
  ghostText: { fontSize: SCALE.small, fontWeight: '600' },
});
