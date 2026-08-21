import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="section">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* `hitSlop` étendait la zone tactile mais laissait le bouton minuscule
          à l'œil, et un doigt vise ce qu'il voit. Mesuré à 19 px de haut :
          c'est une vraie hauteur qu'il lui faut, pas une marge invisible. */}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.action}
        >
          <Text variant="label" color={colors.blueInk}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  texts: { gap: 2, flexShrink: 1 },
  action: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.sm },
});

export default SectionHeader;
