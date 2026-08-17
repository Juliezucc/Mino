import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { MascotExpression } from '@/components/mascot/types';
import { colors, spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

interface Props {
  title: string;
  message?: string;
  expression?: MascotExpression;
  action?: { label: string; onPress: () => void; icon?: string };
  compact?: boolean;
}

/** Empty lists still say something friendly instead of showing a blank page. */
export function EmptyState({ title, message, expression = 'happy', action, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Mascot expression={expression} size={compact ? 90 : 130} />
      <Text variant={compact ? 'cardTitle' : 'section'} center>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color={colors.textMuted} center>
          {message}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} icon={action.icon} onPress={action.onPress} full={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  compact: { paddingVertical: spacing.lg },
});

export default EmptyState;
