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
 * Restrained palette (one rose accent + champagne, no rainbow). The whole
 * intro is ONE native animation on one clock (see "one-clock choreography"),
 * and the app only mounts behind it once the intro has played, so nothing
 * competes with it for the UI or JS thread. With "reduce motion" on, it is a
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

// ---- one-clock choreography ------------------------------------------------
//
// WHY: the old intro was ~25 separate animations glued together with
// Animated.sequence / delay / stagger. With the native driver each step runs
// on the UI thread, but the hand-off from one step to the next is a JS
// callback. The app mounts behind the splash at exactly that moment, the JS
// thread is busy, and the next step starts late → the logo / letters
// "atak jaate the". Now the whole intro is ONE native timing on ONE clock
// (milliseconds) and every element is a pure interpolation of that clock, so
// once it has started nothing on the JS thread can stall it. Same for the exit.
// Native interpolation does not support easing functions, so each curve is
// pre-sampled into a fine piecewise-linear table (visually identical).

type Curve = (x: number) => number;
const outQuad: Curve = (x) => 1 - (1 - x) * (1 - x);
const outCubic: Curve = (x) => 1 - (1 - x) ** 3;
const inQuad: Curve = (x) => x * x;
const inOutQuad: Curve = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const inOutCubic: Curve = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Same curve as Animated.spring({ friction: 7, tension: 46 }) (≈5% overshoot). */
const SPRING_MS = 700;
const spring: Curve = (x) => {
  if (x >= 1) return 1;
  const k = (46 - 30) * 3.62 + 194; // origami tension → stiffness
  const c = (7 - 8) * 3 + 25; // origami friction → damping
  const w = Math.sqrt(k);
  const z = c / (2 * w);
  const wd = w * Math.sqrt(1 - z * z);
  const t = (x * SPRING_MS) / 1000;
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

/** Piecewise-linear map, like an interpolate() output table. */
const pw = (input: number[], output: number[]) => (p: number) => {
  if (p <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (p <= input[i]) {
      const f = (p - input[i - 1]) / (input[i] - input[i - 1] || 1);
      return output[i - 1] + (output[i] - output[i - 1]) * f;
    }
  }
  return output[output.length - 1];
};

/**
 * A segment of the clock: from `start` for `dur` ms, eased by `curve`, then
 * mapped by `map`. Clamped outside the window. Exported for tests.
 */
export function segment(
  clock: Animated.Value,
  start: number,
  dur: number,
  curve: Curve,
  map: (p: number) => number = (p) => p,
  steps = 12,
  unit = '',
) {
  const inputRange: number[] = [];
  const outputRange: (number | string)[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    inputRange.push(start + dur * f);
    const v = Math.round(map(curve(f)) * 10000) / 10000;
    outputRange.push(unit ? `${v}${unit}` : v);
  }
  return clock.interpolate({ inputRange, outputRange: outputRange as number[], extrapolate: 'clamp' });
}

export function BootSplash({
  ready = false,
  onDone,
  onIntroDone,
}: {
  ready?: boolean;
  onDone?: () => void;
  /** Fired once the intro has played; the app is mounted behind it then. */
  onIntroDone?: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();

  const clock = useRef(new Animated.Value(0)).current; // intro, in ms
  const exitClock = useRef(new Animated.Value(0)).current; // exit, in ms
  const calmIn = useRef(new Animated.Value(1)).current; // reduce-motion fade-in
  const motes = useRef(MOTES.map(() => new Animated.Value(0))).current;

  const [introDone, setIntroDone] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [exiting, setExiting] = useState(false);
  const exitStarted = useRef(false);
  const introRef = useRef<Animated.CompositeAnimation | null>(null);
  const driftRef = useRef<Animated.CompositeAnimation | null>(null);
  const introDoneRef = useRef(false);
  const onIntroDoneRef = useRef(onIntroDone);
  onIntroDoneRef.current = onIntroDone;

  const finishIntro = useRef(() => {
    if (introDoneRef.current) return;
    introDoneRef.current = true;
    setIntroDone(true);
  }).current;

  // ---- intro: starts on the very first frame, one native animation ----------
  useEffect(() => {
    const native = { useNativeDriver: true } as const;
    const drift = Animated.parallel(
      motes.map((v, i) =>
        Animated.loop(Animated.timing(v, { toValue: 1, duration: MOTES[i].d, easing: Easing.linear, ...native })),
      ),
    );
    const intro = Animated.timing(clock, {
      toValue: SPLASH_INTRO_MS,
      duration: SPLASH_INTRO_MS,
      easing: Easing.linear,
      ...native,
    });
    driftRef.current = drift;
    introRef.current = intro;
    drift.start();
    intro.start(({ finished }) => finished && finishIntro());
    return () => {
      intro.stop();
      drift.stop();
    };
  }, [clock, motes, finishIntro]);

  // "Reduce motion": swap to a short, calm fade (checked in parallel so the
  // intro never waits for it).
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!reduceMotion || introDoneRef.current) return;
    introRef.current?.stop();
    driftRef.current?.stop();
    clock.setValue(SPLASH_INTRO_MS);
    calmIn.setValue(0);
    const calm = Animated.timing(calmIn, { toValue: 1, duration: 260, useNativeDriver: true });
    calm.start(({ finished }) => finished && finishIntro());
    return () => calm.stop();
  }, [reduceMotion, clock, calmIn, finishIntro]);

  useEffect(() => {
    if (introDone) onIntroDoneRef.current?.();
  }, [introDone]);

  // ---- exit: lift the content, split the screen open (one animation) -------
  const startExit = useRef<() => void>(() => undefined);
  startExit.current = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;
    setExiting(true);
    Animated.timing(exitClock, {
      toValue: SPLASH_EXIT_MS,
      duration: reduceMotion ? 260 : SPLASH_EXIT_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone?.());
  };

  useEffect(() => {
    if (ready && introDone) startExit.current();
  }, [ready, introDone]);

  const skip = () => {
    if (!introDoneRef.current) {
      // Tap during the intro: jump to its last frame.
      introRef.current?.stop();
      clock.setValue(SPLASH_INTRO_MS);
      calmIn.setValue(1);
      finishIntro();
    } else if (ready) startExit.current();
  };

  // ---- interpolations (all derived from the two clocks) --------------------
  const half = H / 2;
  const a = useMemo(() => {
    const seg = (start: number, dur: number, curve: Curve, map?: (p: number) => number, steps?: number, unit?: string) =>
      segment(clock, start, dur, curve, map, steps, unit);
    const out = (start: number, dur: number, curve: Curve, map?: (p: number) => number, steps?: number) =>
      segment(exitClock, start, dur, curve, map, steps);
    const calmFadeOpacity = out(0, SPLASH_EXIT_MS, (x) => x, (p) => 1 - p, 1);
    return {
      dust: seg(0, 700, outQuad),
      bloom: {
        opacity: seg(0, 760, outCubic, pw([0, 0.5, 1], [0, 0.9, 0.55]), 16),
        scaleY: seg(0, 760, outCubic, (p) => 0.2 + 0.8 * p),
      },
      hairline: {
        opacity: seg(0, 760, outCubic, pw([0, 0.3, 1], [0, 1, 0.35]), 16),
        scaleX: seg(0, 760, outCubic),
      },
      logo: {
        opacity: seg(300, SPRING_MS, spring, pw([0, 0.35, 1], [0, 1, 1]), 24),
        translateY: seg(300, SPRING_MS, spring, (p) => 26 * (1 - p), 24),
        rotateX: seg(300, SPRING_MS, spring, (p) => 72 * (1 - p), 24, 'deg'),
        scale: seg(300, SPRING_MS, spring, (p) => 0.78 + 0.22 * p, 24),
      },
      ripple: {
        opacity: seg(620, 1100, outCubic, pw([0, 0.12, 1], [0, 0.5, 0]), 20),
        scale: seg(620, 1100, outCubic, (p) => 0.6 + 1.25 * p),
      },
      glint: seg(760, 720, inOutCubic, (p) => -LOGO + p * LOGO * 2.2),
      letters: WORD.map((_, i) => {
        const at = 700 + 75 * i;
        // The champagne crest passes each letter in turn (always inside 0..1,
        // so no letter is gold before or after the wave).
        const peak = 0.18 + (0.64 * i) / (WORD.length - 1);
        return {
          opacity: seg(at, 460, outCubic),
          translateY: seg(at, 460, outCubic, (p) => -10 * (1 - p)),
          scale: seg(at, 460, outCubic, (p) => 1.35 - 0.35 * p),
          gold: seg(1180, 620, inOutQuad, pw([peak - 0.18, peak, peak + 0.18], [0, 1, 0]), 24),
        };
      }),
      words: TAGLINE.map((_, i) => ({
        opacity: seg(1150 + 70 * i, 380, outQuad),
        translateY: seg(1150 + 70 * i, 380, outQuad, (p) => 8 * (1 - p)),
      })),
      contentOut: {
        opacity: out(0, 300, inQuad, (p) => 1 - p),
        transform: [
          { translateY: out(0, 300, inQuad, (p) => -14 * p) },
          { scale: out(0, 300, inQuad, (p) => 1 + 0.05 * p) },
        ],
      },
      calmFade: { opacity: calmFadeOpacity },
      calmContent: { opacity: Animated.multiply(calmIn, calmFadeOpacity) },
      topPanel: { transform: [{ translateY: out(120, SPLASH_EXIT_MS - 120, inOutCubic, (p) => -(half + 2) * p) }] },
      bottomPanel: { transform: [{ translateY: out(120, SPLASH_EXIT_MS - 120, inOutCubic, (p) => (half + 2) * p) }] },
      edge: { opacity: out(120, SPLASH_EXIT_MS - 120, inOutCubic, pw([0, 0.08, 0.7, 1], [0, 1, 0.6, 0]), 20) },
    };
  }, [clock, exitClock, calmIn, half]);

  const calmFade = reduceMotion ? a.calmFade : null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrap]}
      pointerEvents={exiting ? 'none' : 'auto'}
      onTouchEnd={skip}
      accessibilityLabel="Kissa"
    >
      {/* The two halves of the "book" — they part to reveal the app. */}
      <Animated.View style={[styles.panel, { top: 0, height: half + 1 }, calmFade ?? a.topPanel]}>
        <Animated.View style={[styles.edge, styles.edgeBottom, a.edge]} />
      </Animated.View>
      <Animated.View style={[styles.panel, { top: half, height: half + 1 }, calmFade ?? a.bottomPanel]}>
        <Animated.View style={[styles.edge, styles.edgeTop, a.edge]} />
      </Animated.View>

      {/* Everything that lifts away before the split. Rasterised while it
          fades out so Android composites one texture, not every child. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, reduceMotion ? a.calmContent : a.contentOut]}
        pointerEvents="none"
        renderToHardwareTextureAndroid={exiting}
        shouldRasterizeIOS={exiting}
      >
        {/* dust motes */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.dust }]}>
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
              { width: W, left: (RING - W) / 2, opacity: a.bloom.opacity, transform: [{ scaleY: a.bloom.scaleY }] },
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
                opacity: a.hairline.opacity,
                transform: [{ scaleX: a.hairline.scaleX }],
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

          <Animated.View style={[styles.ring, { opacity: a.ripple.opacity, transform: [{ scale: a.ripple.scale }] }]} />
          <Animated.View
            style={{
              opacity: a.logo.opacity,
              transform: [
                { perspective: 700 },
                { translateY: a.logo.translateY },
                { rotateX: a.logo.rotateX },
                { scale: a.logo.scale },
              ],
            }}
          >
            <View style={styles.logoClip}>
              <Image source={KISSA_LOGO} style={styles.logo} resizeMode="contain" fadeDuration={0} />
              <Animated.View style={[styles.glint, { transform: [{ translateX: a.glint }, { rotate: '18deg' }] }]}>
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
              const l = a.letters[i];
              return (
                <Animated.View
                  key={i}
                  style={{ opacity: l.opacity, transform: [{ translateY: l.translateY }, { scale: l.scale }] }}
                >
                  <Animated.Text style={styles.letter}>{ch}</Animated.Text>
                  <Animated.Text style={[styles.letter, styles.letterGold, { opacity: l.gold }]}>{ch}</Animated.Text>
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
                  { opacity: a.words[i].opacity, transform: [{ translateY: a.words[i].translateY }] },
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
