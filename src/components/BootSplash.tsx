/** Branded boot splash shown while the local DB loads (no context needed). */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, INK } from '../theme';

export function BootSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [fade, scale]);

  return (
    <View style={[styles.wrap, { backgroundColor: COLORS.midnight.bg }]}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <LinearGradient colors={[...GRADIENTS.hero]} style={styles.logo}>
          <Text style={styles.logoText}>कि</Text>
        </LinearGradient>
        <Text style={styles.name}>Kissa</Text>
        <Text style={styles.tag}>Tumhari kahani, tumhare words.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoText: { fontSize: 46, fontWeight: '800', color: INK },
  name: { fontSize: 36, fontWeight: '800', color: '#F4EDE4', letterSpacing: 1.4 },
  tag: { fontSize: 14, color: '#C4B6A6', marginTop: 8, letterSpacing: 0.2 },
});
