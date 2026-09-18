/**
 * Direction-Aware Scroll Auto-Hide System for Kissa (v2.4.2).
 *
 * Implements silky-smooth, direction-aware auto-hiding for:
 *  - Screen headers (smoothly translate upward offscreen on scroll down)
 *  - Bottom navigation bar (smoothly translates downward offscreen on scroll down)
 *
 * Requirements:
 *  - Screen opens with header and bottom navigation FULLY VISIBLE.
 *  - Meaningful scroll DOWN hides header & bottom bar.
 *  - Meaningful scroll UP reveals header & bottom bar immediately.
 *  - Hysteresis & threshold prevent rapid jitter / flickering.
 *  - Native driver animations for 60fps performance without layout jumps.
 */
import React, { createContext, useCallback, useContext, useRef } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

interface NavScrollContextValue {
  headerTranslateY: Animated.Value;
  tabBarTranslateY: Animated.Value;
  headerOpacity: Animated.Value;
  tabBarOpacity: Animated.Value;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  resetVisibility: () => void;
  hideChrome: () => void;
  showChrome: () => void;
}

const NavScrollContext = createContext<NavScrollContextValue | null>(null);

export const HEADER_HEIGHT = 64;
export const TAB_BAR_HEIGHT = 68;
const SCROLL_THRESHOLD = 14;
const HYSTERESIS = 8;

export function NavScrollProvider({ children }: { children: React.ReactNode }) {
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;

  const lastOffsetY = useRef(0);
  const isHidden = useRef(false);
  const scrollAccumulator = useRef(0);

  const showChrome = useCallback(() => {
    if (!isHidden.current) return;
    isHidden.current = false;
    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerTranslateY, tabBarTranslateY, headerOpacity, tabBarOpacity]);

  const hideChrome = useCallback(() => {
    if (isHidden.current) return;
    isHidden.current = true;
    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: -HEADER_HEIGHT - 20,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarTranslateY, {
        toValue: TAB_BAR_HEIGHT + 40,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tabBarOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerTranslateY, tabBarTranslateY, headerOpacity, tabBarOpacity]);

  const resetVisibility = useCallback(() => {
    lastOffsetY.current = 0;
    scrollAccumulator.current = 0;
    showChrome();
  }, [showChrome]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastOffsetY.current;
      lastOffsetY.current = currentY;

      // Always show chrome when near the top
      if (currentY <= 15) {
        scrollAccumulator.current = 0;
        showChrome();
        return;
      }

      // Track directional scroll with hysteresis
      if (delta > 0) {
        // Scrolling down
        if (scrollAccumulator.current < 0) scrollAccumulator.current = 0;
        scrollAccumulator.current += delta;
        if (scrollAccumulator.current > SCROLL_THRESHOLD && currentY > 50) {
          hideChrome();
        }
      } else if (delta < -HYSTERESIS) {
        // Scrolling up meaningfully
        if (scrollAccumulator.current > 0) scrollAccumulator.current = 0;
        scrollAccumulator.current += delta;
        if (Math.abs(scrollAccumulator.current) > SCROLL_THRESHOLD) {
          showChrome();
        }
      }
    },
    [hideChrome, showChrome],
  );

  return (
    <NavScrollContext.Provider
      value={{
        headerTranslateY,
        tabBarTranslateY,
        headerOpacity,
        tabBarOpacity,
        handleScroll,
        resetVisibility,
        hideChrome,
        showChrome,
      }}
    >
      {children}
    </NavScrollContext.Provider>
  );
}

export function useNavScroll(): NavScrollContextValue {
  const ctx = useContext(NavScrollContext);
  if (!ctx) {
    // Fallback if rendered outside provider (e.g. unit tests)
    const anim0 = new Animated.Value(0);
    const anim1 = new Animated.Value(1);
    return {
      headerTranslateY: anim0,
      tabBarTranslateY: anim0,
      headerOpacity: anim1,
      tabBarOpacity: anim1,
      handleScroll: () => undefined,
      resetVisibility: () => undefined,
      hideChrome: () => undefined,
      showChrome: () => undefined,
    };
  }
  return ctx;
}
