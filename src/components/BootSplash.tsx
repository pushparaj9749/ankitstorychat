/**
 * Branded Boot Splash for Kissa v2.4.1.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, INK, RADIUS, SHADOWS } from '../theme';

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
        <LinearGradient colors={[...GRADIENTS.hero]} style={[styles.logo, SHADOWS.glowRose]}>
          <Text style={styles.logoText}>✦</Text>
        </LinearGradient>
        <Text style={styles.name}>KISSA</Text>
        <Text style={styles.tag}>Interactive Cinematic Story Platform</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: { fontSize: 44, fontWeight: '900', color: '#0E070B' },
  name: { fontSize: 34, fontWeight: '900', color: '#F6F4F8', letterSpacing: 4 },
  tag: { fontSize: 13, color: '#B8B1C6', marginTop: 10, letterSpacing: 0.6, fontWeight: '600' },
});
