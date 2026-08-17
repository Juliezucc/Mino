import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MINUTES_PER_CAPSULE, capsulesFor } from '@/domain/ledger';
import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  minutes: number;
  /** How many capsules to draw before collapsing into "+ n". */
  maxCapsules?: number;
  compact?: boolean;
}

/**
 * 1 capsule = 5 minutes. A child who cannot read the digits can still count
 * the dots and know how much time they own.
 */
export function TimeCapsules({ minutes, maxCapsules = 12, compact }: Props) {
  const { full, partial } = capsulesFor(minutes);
  const visible = Math.min(full, maxCapsules);
  const overflow = full - visible;
  const dot = compact ? 10 : 16;

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { gap: compact ? spacing.xs : spacing.sm }]}>
        {Array.from({ length: visible }).map((_, i) => (
          <View
            key={`full-${i}`}
            style={[styles.capsule, { width: dot, height: dot, borderRadius: dot / 2 }]}
          />
        ))}
        {partial > 0 && overflow === 0 ? (
          <View
            style={[
              styles.capsule,
              styles.partial,
              { width: dot, height: dot, borderRadius: dot / 2, opacity: 0.35 + partial * 0.4 },
            ]}
          />
        ) : null}
        {overflow > 0 ? (
          <Text variant="label" color={colors.textMuted}>
            {`+${overflow}`}
          </Text>
        ) : null}
      </View>
      {!compact ? (
        <Text variant="caption" color={colors.textSubtle}>
          {`1 capsule = ${MINUTES_PER_CAPSULE} minutes`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  capsule: {
    backgroundColor: colors.blue,
    borderRadius: radii.pill,
  },
  partial: { backgroundColor: colors.blueSoft },
});

export default TimeCapsules;
