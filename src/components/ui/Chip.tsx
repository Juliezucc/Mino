import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'blue' | 'neutral';
}

/** Single-tap selector used for reward amounts, children, repeat days. */
export function Chip({ label, selected, onPress, icon, style, tone = 'blue' }: Props) {
  const activeBg = tone === 'blue' ? colors.blue : colors.navy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: activeBg, borderColor: activeBg } : styles.idle,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        variant="label"
        color={selected ? colors.onBrand : colors.textMuted}
        numberOfLines={1}
      >
        {icon ? `${icon} ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    minHeight: 46,
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});

export default Chip;
