import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useCountUp } from '@/hooks/useCountUp';
import { colors, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  /** Minutes available. */
  minutes: number;
  /** Full ring value. Defaults to a 60-minute dial. */
  max?: number;
  size?: number;
  label?: string;
  /** Animate digits and ring when the value changes (the 35 → 50 moment). */
  animate?: boolean;
}

/**
 * The single most important object in the child app: how much time I have.
 * Big digits, a ring that fills, and a plain-language label under it.
 */
export function TimeRing({
  minutes,
  max = 60,
  size = 240,
  label = 'min disponibles',
  animate = true,
}: Props) {
  const animated = useCountUp(minutes, { enabled: animate });
  const shown = Math.round(animated);

  const stroke = size * 0.075;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, animated / Math.max(max, 1)));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.blue} />
            <Stop offset="1" stopColor={colors.purple} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceSunken}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text
          variant="display"
          color={colors.blue}
          style={{ fontSize: size * 0.24, lineHeight: size * 0.28 }}
          accessibilityLabel={`${shown} minutes disponibles`}
        >
          {`${shown}:00`}
        </Text>
        <Text variant="label" color={colors.textMuted} center>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});

export default TimeRing;
