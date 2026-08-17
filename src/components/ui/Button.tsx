import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, hitSize, radii, shadows, spacing } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'kid' | 'default' | 'small';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Emoji or short glyph shown before the label — icon + text, never text alone. */
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

const palette: Record<ButtonVariant, { bg: string; fg: string; shadow: keyof typeof shadows }> = {
  primary: { bg: colors.blue, fg: colors.onBrand, shadow: 'brand' },
  success: { bg: colors.mint, fg: colors.onBrand, shadow: 'soft' },
  secondary: { bg: colors.surface, fg: colors.text, shadow: 'soft' },
  ghost: { bg: 'transparent', fg: colors.textMuted, shadow: 'none' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, shadow: 'none' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  disabled,
  loading,
  full = true,
  style,
  haptic = true,
}: Props) {
  const tone = palette[variant];
  const isKid = size === 'kid';

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: tone.bg,
          minHeight: isKid ? hitSize.kid : size === 'small' ? 40 : hitSize.parent,
          paddingHorizontal: isKid ? spacing.xl : spacing.lg,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        variant === 'secondary' && styles.secondaryBorder,
        shadows[tone.shadow],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Text variant={isKid ? 'buttonKid' : 'button'} style={styles.icon}>
              {icon}
            </Text>
          ) : null}
          <Text variant={isKid ? 'buttonKid' : 'button'} color={tone.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: { fontSize: 20 },
  secondaryBorder: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.45,
  },
});

export default Button;
