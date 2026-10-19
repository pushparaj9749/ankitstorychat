/* KISSA classic template ("Kissa Night", pre-v2.7 UI) — kept so users can switch back in Settings → Appearance. */
/**
 * KISSA v2.6 — Bottom Navigation
 * Floating glass capsule; the active tab expands into a magenta→violet pill
 * with a filled (duotone) SVG icon + label, idle tabs show line icons.
 * Direction-aware auto-hide with hysteresis, no flicker (unchanged).
 */
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../../state/AppContext';
import { useNavScroll } from '../../navigation/NavScrollContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GLASS, GRADIENTS, RADIUS, SCALE, SHADOWS, TOUCH } from './theme';
import { Icon, type IconName } from '../../components/icons';

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
      <View style={[styles.bar, { backgroundColor: GLASS.bgStrong, borderColor: GLASS.stroke }, SHADOWS.floating]}>
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

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tabItem, isFocused && styles.tabItemActive, { opacity: pressed ? 0.7 : 1 }]}
            >
              {isFocused ? (
                <View style={[styles.activePill, SHADOWS.glowAccent]}>
                  <LinearGradient
                    colors={[...GRADIENTS.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Icon name={meta.icon} size={19} color="#FFFFFF" />
                  <Text style={styles.activeLabel} numberOfLines={1}>
                    {meta.label}
                  </Text>
                </View>
              ) : (
                <View style={styles.idle}>
                  <Icon name={`${meta.icon}-outline` as IconName} size={21} color={theme.textDim} />
                  <Text style={[styles.label, { color: theme.textFaint }]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

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
    height: 66,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    minHeight: TOUCH.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: { flex: 1.55 },
  activePill: {
    height: 50,
    alignSelf: 'stretch',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  activeLabel: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.1 },
  idle: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: {
    fontSize: SCALE.micro - 1,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
