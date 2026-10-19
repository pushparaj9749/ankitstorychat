/**
 * KISSA v2.7 — opening animation.
 *
 * ~1.3 s intro, then a smooth reveal of the app underneath:
 *   1. the logo springs in while a thin rose ring ripples outwards
 *   2. K · I · S · S · A rise in one letter at a time
 *   3. a hairline sweeps under the wordmark, the tagline fades up
 *   4. once the app is ready (it mounts BEHIND the splash, so the first screen
 *      is already drawn), the splash fades and gently zooms away.
 *
 * Every animation uses the native driver, so it stays smooth on the UI thread
 * even while the JS thread is busy mounting the first screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { COLORS } from '../theme';
import { KISSA_LOGO } from './brand';

const WORD = 'KISSA'.split('');
const ROSE = COLORS.midnight.primary;
const BG = COLORS.midnight.bg;
const RING = 168;

export function BootSplash({ ready = false, onDone }: { ready?: boolean; onDone?: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const tag = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const native = { useNativeDriver: true } as const;
    const anim = Animated.parallel([
      Animated.spring(logo, { toValue: 1, friction: 6, tension: 60, ...native }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ring, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(420),
        Animated.timing(ring2, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.stagger(
          70,
          letters.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.7)), ...native }),
          ),
        ),
      ]),
      Animated.sequence([
        Animated.delay(640),
        Animated.timing(bar, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.cubic), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(760),
        Animated.timing(tag, { toValue: 1, duration: 460, easing: Easing.out(Easing.quad), ...native }),
      ]),
    ]);
    anim.start(() => setIntroDone(true));
    return () => anim.stop();
  }, [logo, ring, ring2, letters, bar, tag]);

  useEffect(() => {
    if (!ready || !introDone) return;
    const out = Animated.timing(exit, {
      toValue: 1,
      duration: 440,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    out.start(({ finished }) => finished && onDone?.());
    return () => out.stop();
  }, [ready, introDone, exit, onDone]);

  const ripple = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.9] }) }],
  });

  return (
    <Animated.View
      pointerEvents={ready && introDone ? 'none' : 'auto'}
      style={[
        StyleSheet.absoluteFill,
        styles.wrap,
        { backgroundColor: BG, opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}
      accessibilityLabel="Kissa"
    >
      <Animated.View
        style={[
          styles.center,
          { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
        ]}
      >
        <View style={styles.logoStage}>
          <Animated.View style={[styles.ring, ripple(ring)]} />
          <Animated.View style={[styles.ring, ripple(ring2)]} />
          <View style={styles.halo} />
          <Animated.View
            style={{
              opacity: logo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [
                { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
              ],
            }}
          >
            <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <View style={styles.word}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                {
                  opacity: letters[i],
                  transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        <Animated.View style={[styles.bar, { transform: [{ scaleX: bar }] }]} />

        <Animated.Text
          style={[
            styles.tag,
            {
              opacity: tag,
              transform: [{ translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
            },
          ]}
        >
          INTERACTIVE STORIES
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  center: { alignItems: 'center' },
  logoStage: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: ROSE,
  },
  halo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(240, 86, 126, 0.07)',
  },
  logo: { width: 92, height: 92, borderRadius: 24 },
  word: { flexDirection: 'row', marginTop: 18 },
  letter: { fontSize: 34, fontWeight: '700', color: '#F4F5F8', marginHorizontal: 4 },
  bar: { width: 56, height: 2, borderRadius: 1, backgroundColor: ROSE, marginTop: 14 },
  tag: { fontSize: 11, color: '#747887', marginTop: 12, letterSpacing: 3, fontWeight: '600' },
});
