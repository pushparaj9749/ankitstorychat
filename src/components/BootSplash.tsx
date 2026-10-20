/**
 * KISSA v2.8 — opening animation: "the story opens".
 *
 * ~1.8 s intro, then the screen opens like a book onto the app underneath:
 *   1. darkness; a few champagne dust motes drift upwards
 *   2. a rose hairline of light draws across the middle and blooms softly
 *   3. the logo lifts out of the light like a page turning up (3D tilt), a
 *      light glint sweeps across it and one soft ripple rings out
 *   4. K · I · S · S · A settle in one by one, then a champagne wave runs
 *      through the letters
 *   5. the tagline rises word by word: TUMHARI KAHANI · TUMHARE FAISLE
 *   6. once the app is ready (it mounts BEHIND the splash, so the first
 *      screen is already drawn) the content lifts away and the screen splits
 *      open — top half up, bottom half down — with a rose edge of light.
 *
 * Restrained palette (one rose accent + champagne, no rainbow). Every
 * animation uses the native driver, so it stays smooth on the UI thread while
 * the JS thread mounts the first screen. With "reduce motion" on, it is a
 * short, calm fade. Tapping skips the intro once the app is ready.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme';
import { KISSA_LOGO } from './brand';

const WORD = 'KISSA'.split('');
const TAGLINE = ['TUMHARI', 'KAHANI', '·', 'TUMHARE', 'FAISLE'];
const ROSE = COLORS.midnight.primary;
const GOLD = COLORS.midnight.gold;
const BG = COLORS.midnight.bg;
const LOGO = 96;
const RING = 176;

/** Intro length before the splash may open (ms). Exported for tests. */
export const SPLASH_INTRO_MS = 1810;
export const SPLASH_EXIT_MS = 620;

/** Fixed dust-mote layout (deterministic → no layout jump between renders). */
const MOTES = [
  { x: 0.12, y: 0.78, s: 3, d: 6400, o: 0.5 },
  { x: 0.22, y: 0.32, s: 2, d: 7600, o: 0.35 },
  { x: 0.31, y: 0.9, s: 2, d: 5800, o: 0.45 },
  { x: 0.4, y: 0.6, s: 3, d: 8200, o: 0.3 },
  { x: 0.48, y: 0.18, s: 2, d: 6900, o: 0.4 },
  { x: 0.57, y: 0.84, s: 3, d: 7200, o: 0.5 },
  { x: 0.66, y: 0.4, s: 2, d: 6100, o: 0.35 },
  { x: 0.74, y: 0.7, s: 2, d: 8800, o: 0.45 },
  { x: 0.83, y: 0.26, s: 3, d: 7000, o: 0.4 },
  { x: 0.9, y: 0.88, s: 2, d: 6600, o: 0.5 },
  { x: 0.08, y: 0.48, s: 2, d: 7900, o: 0.3 },
  { x: 0.94, y: 0.56, s: 2, d: 6300, o: 0.35 },
];

export function BootSplash({ ready = false, onDone }: { ready?: boolean; onDone?: () => void }) {
  const { width: W, height: H } = useWindowDimensions();

  const line = useRef(new Animated.Value(0)).current; // hairline draw + bloom
  const logo = useRef(new Animated.Value(0)).current; // page-lift
  const glint = useRef(new Animated.Value(0)).current; // light sweep over logo
  const ripple = useRef(new Animated.Value(0)).current;
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const wave = useRef(new Animated.Value(0)).current; // champagne wave through letters
  const words = useRef(TAGLINE.map(() => new Animated.Value(0))).current;
  const motes = useRef(MOTES.map(() => new Animated.Value(0))).current;
  const dust = useRef(new Animated.Value(0)).current; // dust layer fade-in
  const lift = useRef(new Animated.Value(0)).current; // content lifts away
  const open = useRef(new Animated.Value(0)).current; // screen splits open

  const [introDone, setIntroDone] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [exiting, setExiting] = useState(false);
  const exitStarted = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  // ---- intro ----------------------------------------------------------------
  useEffect(() => {
    if (reduceMotion === null) return;
    const native = { useNativeDriver: true } as const;

    if (reduceMotion) {
      // Calm version: everything simply fades in together.
      const all = [line, logo, ripple, glint, wave, dust, ...letters, ...words];
      const calm = Animated.parallel(all.map((v) => Animated.timing(v, { toValue: 1, duration: 260, ...native })));
      calm.start(() => setIntroDone(true));
      return () => calm.stop();
    }

    const drift = Animated.parallel(
      motes.map((v, i) =>
        Animated.loop(
          Animated.timing(v, { toValue: 1, duration: MOTES[i].d, easing: Easing.linear, ...native }),
        ),
      ),
    );
    drift.start();

    const intro = Animated.parallel([
      Animated.timing(dust, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), ...native }),
      Animated.timing(line, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), ...native }),
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(logo, { toValue: 1, friction: 7, tension: 46, ...native }),
      ]),
      Animated.sequence([
        Animated.delay(620),
        Animated.timing(ripple, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(760),
        Animated.timing(glint, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.cubic), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.stagger(
          75,
          letters.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), ...native }),
          ),
        ),
      ]),
      Animated.sequence([
        Animated.delay(1180),
        Animated.timing(wave, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), ...native }),
      ]),
      Animated.sequence([
        Animated.delay(1150),
        Animated.stagger(
          70,
          words.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), ...native }),
          ),
        ),
      ]),
    ]);
    intro.start(() => setIntroDone(true));
    return () => {
      intro.stop();
      drift.stop();
    };
  }, [reduceMotion, line, logo, ripple, glint, wave, dust, letters, words, motes]);

  // ---- exit: lift the content, split the screen open -----------------------
  const startExit = useRef<() => void>(() => undefined);
  startExit.current = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;
    setExiting(true);
    const native = { useNativeDriver: true } as const;
    const out = reduceMotion
      ? Animated.timing(open, { toValue: 1, duration: 260, ...native })
      : Animated.parallel([
          Animated.timing(lift, { toValue: 1, duration: 300, easing: Easing.in(Easing.quad), ...native }),
          Animated.sequence([
            Animated.delay(120),
            Animated.timing(open, { toValue: 1, duration: SPLASH_EXIT_MS - 120, easing: Easing.inOut(Easing.cubic), ...native }),
          ]),
        ]);
    out.start(({ finished }) => finished && onDone?.());
  };

  useEffect(() => {
    if (ready && introDone) startExit.current();
  }, [ready, introDone]);

  const skip = () => {
    if (ready) startExit.current();
  };

  // ---- interpolations -------------------------------------------------------
  const contentOut = useMemo(
    () => ({
      opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [
        { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
        { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
      ],
    }),
    [lift],
  );

  const half = H / 2;
  const calmFade = reduceMotion ? { opacity: open.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) } : null;
  const edge = { opacity: open.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.6, 0] }) };

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrap]}
      pointerEvents={exiting ? 'none' : 'auto'}
      onTouchEnd={skip}
      accessibilityLabel="Kissa"
    >
      {/* The two halves of the "book" — they part to reveal the app. */}
      <Animated.View
        style={[
          styles.panel,
          { top: 0, height: half + 1 },
          calmFade ?? { transform: [{ translateY: open.interpolate({ inputRange: [0, 1], outputRange: [0, -half - 2] }) }] },
        ]}
      >
        <Animated.View style={[styles.edge, styles.edgeBottom, edge]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { top: half, height: half + 1 },
          calmFade ?? { transform: [{ translateY: open.interpolate({ inputRange: [0, 1], outputRange: [0, half + 2] }) }] },
        ]}
      >
        <Animated.View style={[styles.edge, styles.edgeTop, edge]} />
      </Animated.View>

      {/* Everything that lifts away before the split. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, calmFade ?? contentOut]} pointerEvents="none">
        {/* dust motes */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: dust }]}>
          {MOTES.map((m, i) => {
            const travel = H * 0.22;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.mote,
                  {
                    left: m.x * W,
                    top: m.y * H,
                    width: m.s,
                    height: m.s,
                    borderRadius: m.s / 2,
                    opacity: motes[i].interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, m.o, m.o, 0] }),
                    transform: [{ translateY: motes[i].interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) }],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* logo stage — centred exactly on the screen's middle, where the
            light line draws and where the screen later splits open */}
        <View style={[styles.logoStage, { position: 'absolute', top: half - RING / 2, left: (W - RING) / 2 }]}>
          {/* hairline of light + its soft bloom, through the logo */}
          <Animated.View
            style={[
              styles.bloom,
              {
                width: W,
                left: (RING - W) / 2,
                opacity: line.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0.55] }),
                transform: [{ scaleY: line.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(240,86,126,0)', 'rgba(240,86,126,0.10)', 'rgba(240,86,126,0)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.hairline,
              {
                width: W * 0.72,
                left: (RING - W * 0.72) / 2,
                opacity: line.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.35] }),
                transform: [{ scaleX: line }],
              },
            ]}
          >
            <LinearGradient
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              colors={['rgba(240,86,126,0)', ROSE, 'rgba(240,86,126,0)']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ripple.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] }),
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.85] }) }],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: logo.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
              transform: [
                { perspective: 700 },
                { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                { rotateX: logo.interpolate({ inputRange: [0, 1], outputRange: ['72deg', '0deg'] }) },
                { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
              ],
            }}
          >
            <View style={styles.logoClip}>
              <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" />
              <Animated.View
                style={[
                  styles.glint,
                  {
                    transform: [
                      { translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-LOGO, LOGO * 1.2] }) },
                      { rotate: '18deg' },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </Animated.View>
        </View>

        <View style={[styles.textBlock, { top: half + RING / 2 - 8 }]}>
        {/* wordmark with a champagne wave */}
        <View style={styles.word}>
          {WORD.map((ch, i) => {
            const v = letters[i];
            // The champagne crest passes each letter in turn (always inside 0..1,
            // so no letter is gold before or after the wave).
            const peak = 0.18 + (0.64 * i) / (WORD.length - 1);
            return (
              <Animated.View
                key={i}
                style={{
                  opacity: v,
                  transform: [
                    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] }) },
                  ],
                }}
              >
                <Animated.Text style={styles.letter}>{ch}</Animated.Text>
                <Animated.Text
                  style={[
                    styles.letter,
                    styles.letterGold,
                    {
                      opacity: wave.interpolate({
                        inputRange: [peak - 0.18, peak, peak + 0.18],
                        outputRange: [0, 1, 0],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                >
                  {ch}
                </Animated.Text>
              </Animated.View>
            );
          })}
        </View>

        {/* tagline, word by word */}
        <View style={styles.tagRow}>
          {TAGLINE.map((w, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.tag,
                w === '·' && styles.tagDot,
                {
                  opacity: words[i],
                  transform: [{ translateY: words[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                },
              ]}
            >
              {w}
            </Animated.Text>
          ))}
        </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 1000 },
  panel: { position: 'absolute', left: 0, right: 0, backgroundColor: BG, overflow: 'visible' },
  edge: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: ROSE },
  edgeBottom: { bottom: 0 },
  edgeTop: { top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  mote: { position: 'absolute', backgroundColor: GOLD },
  bloom: { position: 'absolute', height: 260, top: RING / 2 - 130 },
  hairline: { position: 'absolute', height: 1.5, top: RING / 2 - 0.75 },
  logoStage: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: ROSE,
  },
  logoClip: { width: LOGO, height: LOGO, borderRadius: 26, overflow: 'hidden' },
  logo: { width: LOGO, height: LOGO },
  glint: { position: 'absolute', top: -LOGO * 0.3, width: 34, height: LOGO * 1.6 },
  textBlock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  word: { flexDirection: 'row' },
  letter: { fontSize: 36, fontWeight: '800', color: '#F4F5F8', marginHorizontal: 5, letterSpacing: 1 },
  letterGold: { position: 'absolute', left: 0, top: 0, color: GOLD },
  tagRow: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
  tag: { fontSize: 10.5, color: '#9A9EAD', letterSpacing: 2.6, fontWeight: '700', marginHorizontal: 3 },
  tagDot: { color: ROSE },
});
