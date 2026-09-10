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
  /**
   * Ce qu'un lecteur d'écran annonce, quand le libellé visible ne suffit pas.
   *
   * Un bouton peut être elliptique à l'œil et incompréhensible à l'oreille :
   * « Pas encore » a du sens sous une carte qui nomme l'enfant et sa mission,
   * et n'en a aucun lu seul. Par défaut on annonce le libellé, qui est le bon
   * choix dans la grande majorité des cas.
   */
  accessibilityLabel?: string;
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
  danger: { bg: colors.dangerSoft, fg: colors.dangerInk, shadow: 'none' },
};

export function Button({
  label,
  accessibilityLabel,
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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: tone.bg,
          // 44 est le plancher d'Apple : un bouton « small » reste un bouton.
          minHeight: isKid ? hitSize.kid : size === 'small' ? 44 : hitSize.parent,
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
          {/**
            * Deux lignes, et non une — c'est ce qui sépare « prend en charge
            * les grandes polices » de la case cochée à tort.
            *
            * Le bouton grandit avec le texte : sa hauteur est un `minHeight`,
            * pas une hauteur. Mais son intitulé était coupé à une ligne, si
            * bien qu'à 200 % — le seuil d'Apple pour « Police plus grande » —
            * « Terminer, aller à mon espace » devenait « Terminer, aller… » sur
            * le bouton principal de chaque écran. Une personne malvoyante y
            * perdait précisément ce qu'elle avait agrandi pour lire.
            */}
          <Text
            variant={isKid ? 'buttonKid' : 'button'}
            color={tone.fg}
            numberOfLines={2}
            style={styles.label}
          >
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
  // `flexShrink` plutôt que rien : sans lui, un intitulé sur deux lignes pousse
  // au-delà du bouton au lieu de se replier dedans.
  label: { flexShrink: 1 },
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
