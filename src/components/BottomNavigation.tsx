/**
 * KISSA v2.10 — Bottom Navigation
 * Floating graphite capsule: Home · Explore · [ + ] · Library · You.
 * A soft rose-glass pill slides (spring, native driver) behind the active
 * tab, which shows a filled SVG icon; idle tabs show quiet line icons. The
 * centre "+" is a gradient orb with a glass sheen and a hairline halo ring.
 * Direction-aware auto-hide with hysteresis, no flicker (unchanged).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { GLASS, GRADIENTS, RADIUS, SCALE, SHADOWS, TOUCH, withAlpha } from '../theme';
import { Icon, type IconName } from './icons';

interface TabMeta {
  label: string;
  icon: IconName;
}

const TAB_CONFIG: Record<string, TabMeta> = {
  Home: { label: 'Home', icon: 'home' },
  Discover: { label: 'Explore', icon: 'compass' },
  Library: { label: 'Library', icon: 'library' },
  Settings: { label: 'You', icon: 'person' },
};

export function KissaBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const { tabBarTranslateY, tabBarOpacity } = useNavScroll();

  /* Sliding highlight. Five equal slots: tabs 0,1 · create · tabs 2,3. */
  const [innerWidth, setInnerWidth] = useState(0);
  const slotWidth = innerWidth / 5;
  const activeSlot = state.index >= 2 ? state.index + 1 : state.index;
  const pillX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!slotWidth) return;
    const to = activeSlot * slotWidth;
    if (!placed.current) {
      placed.current = true;
      pillX.setValue(to);
      return;
    }
    Animated.spring(pillX, { toValue: to, useNativeDriver: true, damping: 18, stiffness: 210, mass: 0.8 }).start();
  }, [activeSlot, slotWidth, pillX]);
  const onBarLayout = (e: LayoutChangeEvent) => setInnerWidth(Math.max(0, e.nativeEvent.layout.width - BAR_PAD * 2 - 2));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          transform: [{ translateY: tabBarTranslateY }],
          opacity: tabBarOpacity,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View onLayout={onBarLayout} style={[styles.bar, { backgroundColor: GLASS.bgStrong, borderColor: GLASS.stroke }, SHADOWS.floating]}>
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            testID="tab-pill"
            style={[
              styles.pill,
              {
                width: slotWidth - 8,
                backgroundColor: withAlpha(theme.primary, 0.13),
                borderColor: withAlpha(theme.primary, 0.3),
                transform: [{ translateX: pillX }],
              },
            ]}
          >
            <View style={[styles.pillGlint, { backgroundColor: withAlpha(theme.accent, 0.55) }]} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const meta = TAB_CONFIG[route.name] ?? { label: route.name, icon: 'ellipse' as IconName };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const tab = (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.idle}>
                <Icon
                  name={(isFocused ? meta.icon : `${meta.icon}-outline`) as IconName}
                  size={22}
                  color={isFocused ? theme.accent : theme.textFaint}
                />
                <Text
                  style={[styles.label, { color: isFocused ? theme.text : theme.textFaint }, isFocused && styles.labelActive]}
                  numberOfLines={1}
                >
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
          if (index !== 1) return tab;
          return (
            <React.Fragment key={route.key}>
              {tab}
              <View style={styles.tabItem}>
                <Pressable
                  onPress={() => (navigation as any).navigate('SubmitStory')}
                  accessibilityRole="button"
                  accessibilityLabel="Create a story"
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.createRing,
                    { borderColor: withAlpha(theme.primary, 0.32), transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                >
                  <View style={[styles.create, SHADOWS.glowRose]}>
                    <LinearGradient colors={[...GRADIENTS.rose]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 0.6 }}
                      style={styles.createSheen}
                    />
                    <Icon name="add" size={24} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </Animated.View>
  );
}

const BAR_PAD = 6;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 6,
    zIndex: 100,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: BAR_PAD,
  },
  pill: {
    position: 'absolute',
    left: BAR_PAD + 4,
    top: 6,
    bottom: 6,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  pillGlint: { width: 18, height: 2, borderRadius: 1, marginTop: -1 },
  tabItem: {
    flex: 1,
    minHeight: TOUCH.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: {
    fontSize: SCALE.micro - 0.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: { fontWeight: '700' },
  createRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  createSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 24 },
});
