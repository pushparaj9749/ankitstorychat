/**
 * KISSA v2.10 — Segmented control with a sliding indicator.
 *
 * A rose-glass thumb springs between options (measured per option, so labels
 * of any width line up). Used by Explore's For you / Newest / Popular sort.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useApp } from '../state/AppContext';
import { RADIUS, SCALE, withAlpha } from '../theme';

type Box = { x: number; w: number };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
}) {
  const { theme } = useApp();
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const box = boxes[value];

  useEffect(() => {
    if (!box) return;
    if (!placed.current) {
      placed.current = true;
      left.setValue(box.x);
      width.setValue(box.w);
      return;
    }
    const cfg = { useNativeDriver: false, damping: 20, stiffness: 240, mass: 0.8 } as const;
    Animated.parallel([
      Animated.spring(left, { toValue: box.x, ...cfg }),
      Animated.spring(width, { toValue: box.w, ...cfg }),
    ]).start();
  }, [box?.x, box?.w, left, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const onItemLayout = (key: T) => (e: LayoutChangeEvent) => {
    const { x, width: w } = e.nativeEvent.layout;
    setBoxes((prev) => (prev[key]?.x === x && prev[key]?.w === w ? prev : { ...prev, [key]: { x, w } }));
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: withAlpha(theme.surface2, 0.85), borderColor: withAlpha(theme.text, 0.08) }]}
    >
      {box ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left,
              width,
              backgroundColor: withAlpha(theme.primary, 0.2),
              borderColor: withAlpha(theme.primary, 0.42),
            },
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={opt}
            onLayout={onItemLayout(opt)}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={styles.item}
          >
            <Text style={[styles.text, { color: on ? theme.text : theme.textFaint }, on && styles.textOn]}>
              {labelFor ? labelFor(opt) : opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS.pill, padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  item: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: RADIUS.pill },
  text: { fontSize: SCALE.caption, fontWeight: '600' },
  textOn: { fontWeight: '700' },
});
