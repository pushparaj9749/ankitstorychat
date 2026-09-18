/**
 * Screen wrapper: Safe Area aware, dark cinematic depth & ambient aura.
 * Kissa v2.4.1.
 */
import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';

export function Screen({
  children,
  padded = true,
  immersive = false,
}: {
  children: React.ReactNode;
  padded?: boolean;
  immersive?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} translucent={false} />
      {/* Cinematic subtle top aura & bottom vignette */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(230,57,100,0.08)', 'rgba(9,8,12,0.0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glowTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.36)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.vignetteBottom}
        />
      </View>
      <SafeAreaView
        style={styles.safe}
        edges={immersive ? ['left', 'right', 'bottom'] : ['top', 'left', 'right']}
      >
        <View style={[styles.body, padded && styles.padded]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1 },
  padded: { paddingHorizontal: 18 },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
    opacity: 1,
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    opacity: 0.9,
  },
});
