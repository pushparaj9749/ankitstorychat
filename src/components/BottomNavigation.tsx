/**
 * KISSA v2.6 — Bottom Navigation
 * Floating glass bar: the tab strip hovers above the content instead of
 * slicing the screen with a hard 64px band, so artwork keeps the whole stage.
 * Direction-aware auto-hide with hysteresis, no flicker (unchanged).
 */
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { GLASS, RADIUS, SCALE, SHADOWS, TOUCH, withAlpha } from '../theme';
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

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[
                  styles.iconBox,
                  isFocused
                    ? {
                        backgroundColor: withAlpha(theme.primary, 0.18),
                        borderColor: withAlpha(theme.primary, 0.42),
                      }
                    : { borderColor: 'transparent' },
                ]}
              >
                <Icon
                  name={isFocused ? meta.icon : (`${meta.icon}-outline` as IconName)}
                  size={19}
                  color={isFocused ? theme.accent : theme.textFaint}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.text : theme.textFaint,
                    fontWeight: isFocused ? '800' : '600',
                  },
                ]}
              >
                {meta.label}
              </Text>
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
    paddingHorizontal: 14,
    paddingTop: 6,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 62,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    minHeight: TOUCH.min,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconBox: {
    width: 46,
    height: 28,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: SCALE.micro,
    letterSpacing: 0.3,
  },
});
