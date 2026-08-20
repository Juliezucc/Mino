import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, fonts, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  size?: number;
  color?: string;
  /** Show the baseline under the wordmark. */
  baseline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wordmark: lowercase "mino" in a very round type, with a small blue bubble
 * standing for the minute you just earned.
 */
export function Logo({ size = 40, color = colors.navy, baseline, style }: Props) {
  const dot = size * 0.18;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Text
          style={{ fontFamily: fonts.black, fontSize: size, lineHeight: size * 1.15, letterSpacing: -size * 0.03 }}
          color={color}
        >
          mino
        </Text>
        <View style={styles.dots}>
          {/* A minute rising off the wordmark: small bubble above, big one below. */}
          <View
            style={{
              width: dot * 0.5,
              height: dot * 0.5,
              borderRadius: dot,
              backgroundColor: colors.blue,
              opacity: 0.55,
              alignSelf: 'flex-end',
              marginBottom: dot * 0.3,
            }}
          />
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot,
              backgroundColor: colors.blue,
            }}
          />
        </View>
      </View>
      {baseline ? (
        <Text variant="body" color={colors.textMuted}>
          Grandir, une mission à la fois.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dots: { marginLeft: 3, marginTop: 2 },
});

export default Logo;
