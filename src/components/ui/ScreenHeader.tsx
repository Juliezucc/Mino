import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/Icon';
import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Show a close cross instead of a back chevron (modal-like screens). */
  closeIcon?: boolean;
  right?: React.ReactNode;
  large?: boolean;
}

export function ScreenHeader({ title, subtitle, onBack, closeIcon, right, large }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={closeIcon ? 'Fermer' : 'Retour'}
          hitSlop={10}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Icon name={closeIcon ? 'close' : 'chevron-left'} color={colors.text} size={24} />
        </Pressable>
        <View style={styles.spacer} />
        {right}
      </View>
      {title ? (
        <View style={styles.titles}>
          <Text variant={large ? 'hero' : 'title'}>{title}</Text>
          {subtitle ? (
            <Text variant="body" color={colors.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  titles: { gap: spacing.sm },
});

export default ScreenHeader;
