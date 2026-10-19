/**
 * KISSA v2.7 — circular progress ring (react-native-svg).
 * A thin hairline track with a single rose arc; the percentage sits inside.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const ProgressRing = memo(function ProgressRing({
  value,
  size = 48,
  stroke = 4,
  color,
  trackColor = 'rgba(255,255,255,0.10)',
  textColor = '#F4F5F8',
  showLabel = true,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  textColor?: string;
  showLabel?: boolean;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(v * 100);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${pct}% complete`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {v > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - v)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {showLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text style={[styles.label, { color: textColor, fontSize: Math.max(10, size * 0.25) }]}>{pct}%</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', letterSpacing: -0.2 },
});
