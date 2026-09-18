/**
 * Branded Boot Splash for Kissa v2.4.2.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../theme';
import { KISSA_LOGO } from './brand';

export function BootSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [fade, scale]);

  return (
    <View style={[styles.wrap, { backgroundColor: COLORS.midnight.bg }]}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <Image source={KISSA_LOGO} style={[styles.logo, SHADOWS.glowRose]} resizeMode="contain" accessibilityLabel="Kissa" />
        <Text style={styles.name}>KISSA</Text>
        <Text style={styles.tag}>Interactive Cinematic Story Platform</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.xl,
    marginBottom: 20,
  },
  name: { fontSize: 34, fontWeight: '900', color: '#F6F4F8', letterSpacing: 4 },
  tag: { fontSize: 13, color: '#B8B1C6', marginTop: 10, letterSpacing: 0.6, fontWeight: '600' },
});
