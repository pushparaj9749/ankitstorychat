/**
 * KISSA v2.7 — Bottom Navigation
 * Floating graphite capsule: Home · Explore · [ + ] · Library · You.
 * The active tab shows a filled SVG icon in bright text with a small rose
 * indicator; idle tabs show quiet line icons. The centre "+" is the one
 * accent-coloured control (create / submit a story).
 * Direction-aware auto-hide with hysteresis, no flicker (unchanged).
 */
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { GLASS, RADIUS, SCALE, SHADOWS, TOUCH } from '../theme';
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
                  color={isFocused ? theme.text : theme.textFaint}
                />
                <Text
                  style={[styles.label, { color: isFocused ? theme.text : theme.textFaint }, isFocused && styles.labelActive]}
                  numberOfLines={1}
                >
                  {meta.label}
                </Text>
                <View style={[styles.indicator, { backgroundColor: isFocused ? theme.primary : 'transparent' }]} />
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
                    styles.create,
                    { backgroundColor: theme.primary, transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                >
                  <Icon name="add" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
            </React.Fragment>
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
    height: 64,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    minHeight: TOUCH.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  label: {
    fontSize: SCALE.micro - 0.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: { fontWeight: '700' },
  indicator: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  create: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
