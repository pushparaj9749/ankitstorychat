/**
 * "Naya version aaya hai" banner (Home). Reads only the public GitHub
 * release (see lib/updateCheck). Hidden when switched off in About, when the
 * user tapped "Baad mein" for this version, or when already up to date.
 *
 * It appears by itself: checks shortly after launch, again every time the
 * app returns to the foreground (and every 30 min while open), and also
 * reacts at once to a manual "Check now" in About.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { IconGlyph } from './iconGlyph';
import { checkForUpdate, dismissUpdate, isUpdateDismissed, onUpdateStatus, type ReleaseInfo, type UpdateStatus } from '../lib/updateCheck';
import { RADIUS, SCALE, SPACING, withAlpha } from '../theme';

/** Wait a moment after launch so the check never competes with the first paint. */
const START_DELAY_MS = 2500;
/** While the app stays open, look again this often (the check itself is throttled). */
const PERIODIC_MS = 30 * 60 * 1000;

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
    const shown = { version: '' };

    const apply = async (s: UpdateStatus) => {
      if (!alive) return;
      if (!s.available || !s.latest) {
        if (s.latest) {
          // Already on the newest (e.g. just updated) — hide a stale banner.
          shown.version = '';
          setInfo(null);
        }
        return;
      }
      if (s.latest.version === shown.version) return;
      if (await isUpdateDismissed(s.latest.version)) return;
      if (!alive) return;
      shown.version = s.latest.version;
      setInfo({ latest: s.latest, current: s.current });
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    };

    const unsubscribe = onUpdateStatus((s) => void apply(s));
    const check = () => void checkForUpdate();
    const t = setTimeout(check, START_DELAY_MS);
    const every = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, PERIODIC_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(every);
      sub.remove();
      unsubscribe();
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
          Tum v{info.current} par ho. Update kar lo — saari chats safe rahengi.
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
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: SPACING.md,
    marginHorizontal: SPACING.page,
    gap: 12,
  },
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
