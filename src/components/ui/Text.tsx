import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, type as typeScale } from '@/theme';

type Variant = keyof typeof typeScale;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

/** Every piece of copy goes through here, so the type scale is never bypassed. */
export function Text({
  variant = 'body',
  color = colors.text,
  center,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[typeScale[variant], { color }, center && styles.center, style]}
      // Respect the reader, but keep child screens from exploding on huge settings.
      maxFontSizeMultiplier={1.6}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});

export default Text;
