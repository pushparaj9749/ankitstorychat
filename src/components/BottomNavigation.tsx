/**
 * Custom Cinematic Bottom Navigation for Kissa v2.4.1.
 *
 * Features:
 *  - Direction-aware auto-hide (smoothly translates down on scroll down, returns on scroll up)
 *  - Frosted glass finish with subtle border glow
 *  - Safe area aware (Android gesture navigation & iOS home bar)
 *  - Minimal, high-clarity iconography + typography
 */
import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { FONTS, RADIUS, SHADOWS, withAlpha } from '../theme';

interface TabMeta {
  glyph: string;
  label: string;
}

const TAB_CONFIG: Record<string, TabMeta> = {
  Home: { glyph: '◆', label: 'Home' },
  Discover: { glyph: '◎', label: 'Explore' },
  Library: { glyph: '▣', label: 'Library' },
  Settings: { glyph: '○', label: 'Profile' },
};

export function KissaBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const { tabBarTranslateY, tabBarOpacity } = useNavScroll();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: tabBarTranslateY }],
          opacity: tabBarOpacity,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: withAlpha(theme.bgSoft, 0.96),
          borderTopColor: theme.border,
        },
        SHADOWS.floating,
      ]}
    >
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const meta = TAB_CONFIG[route.name] ?? { glyph: '•', label: route.name };

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
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.iconBox,
                  isFocused && {
                    backgroundColor: withAlpha(theme.primary, 0.16),
                    borderColor: withAlpha(theme.primary, 0.35),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.glyph,
                    {
                      color: isFocused ? theme.accent : theme.textFaint,
                      fontWeight: isFocused ? '800' : '500',
                      fontSize: isFocused ? 16 : 14,
                    },
                  ]}
                >
                  {meta.glyph}
                </Text>
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
              {isFocused ? (
                <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
              ) : (
                <View style={styles.idleDot} />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    zIndex: 100,
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  iconBox: {
    width: 32,
    height: 30,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  glyph: {
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  idleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
    opacity: 0,
  },
});
