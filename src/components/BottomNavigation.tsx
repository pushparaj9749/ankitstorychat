/**
 * KISSA v2.4.2 — Bottom Navigation
 * Original, minimal, editorial, safe-area aware.
 * Direction-aware auto-hide with hysteresis, no flicker.
 */
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { RADIUS, SHADOWS, withAlpha, LAYOUT } from '../theme';
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
      style={[
        styles.container,
        {
          transform: [{ translateY: tabBarTranslateY }],
          opacity: tabBarOpacity,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: withAlpha(theme.bgSoft, 0.96),
          borderTopColor: theme.borderSoft,
          height: LAYOUT.tabBarHeight + Math.max(insets.bottom, 8),
        },
        SHADOWS.floating,
      ]}
    >
      <View style={styles.inner}>
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
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.iconBox,
                  isFocused && {
                    backgroundColor: theme.text,
                  },
                ]}
              >
                <Icon
                  name={(isFocused ? meta.icon : (`${meta.icon}-outline` as IconName))}
                  size={18}
                  color={isFocused ? theme.bg : theme.textFaint}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.text : theme.textFaint,
                    fontWeight: isFocused ? '700' : '500',
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
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    zIndex: 100,
    justifyContent: 'flex-start',
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    flex: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  iconBox: {
    width: 30,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
