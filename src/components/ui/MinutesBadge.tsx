import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { formatMinos } from '@/domain/minos';
import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  minutes: number;
  tone?: 'blue' | 'mint' | 'purple' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  /** Show a sign in front of the value (+15 / -20). */
  signed?: boolean;
  /**
   * Whose words to use. Children read minos, parents read minutes; the number
   * is the same either way (see `domain/minos`).
   */
  unit?: 'minutes' | 'minos';
}

const tones = {
  blue: { bg: colors.blueSoft, fg: colors.blueDark },
  mint: { bg: colors.mintSoft, fg: colors.mint },
  purple: { bg: colors.purpleSoft, fg: colors.purple },
  muted: { bg: colors.surfaceSunken, fg: colors.textMuted },
} as const;

/** The reward pill: "+15 min" for a parent, "+15 minos" for a child. */
export function MinutesBadge({
  minutes,
  tone = 'blue',
  size = 'md',
  style,
  signed = true,
  unit = 'minutes',
}: Props) {
  const t = tones[tone];
  const label =
    unit === 'minos'
      ? formatMinos(minutes, { signed })
      : `${signed && minutes > 0 ? '+' : ''}${minutes} min`;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: t.bg },
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        style,
      ]}
    >
      <Text
        variant={size === 'lg' ? 'section' : size === 'sm' ? 'caption' : 'label'}
        color={t.fg}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  lg: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});

export default MinutesBadge;
