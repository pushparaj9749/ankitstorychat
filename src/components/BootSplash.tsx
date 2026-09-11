/** Branded boot splash shown while the local DB loads (no context needed). */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../theme';

export function BootSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
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
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { fontSize: 52, fontWeight: '900', color: '#fff' },
  name: { fontSize: 40, fontWeight: '900', color: '#F5F1FF', letterSpacing: 1 },
  tag: { fontSize: 14, color: '#B9AEE0', marginTop: 8 },
});
