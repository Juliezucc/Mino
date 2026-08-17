import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevation?: 'none' | 'soft' | 'lifted';
  background?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Airy white card, very round corners, barely-there shadow. No hard borders. */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  elevation = 'soft',
  background = colors.surface,
  accessibilityLabel,
  disabled,
}: Props) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: background },
    shadows[elevation],
    padded && styles.padded,
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Card;
