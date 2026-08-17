import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MissionState } from '@/domain/missions';
import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

const STATES: Record<MissionState, { label: string; icon: string; bg: string; fg: string }> = {
  todo: { label: 'À FAIRE', icon: '⭐', bg: colors.blueSoft, fg: colors.blueDark },
  pending: { label: 'EN ATTENTE', icon: '⏳', bg: colors.yellowSoft, fg: '#B27A11' },
  done: { label: 'VALIDÉE', icon: '✓', bg: colors.mintSoft, fg: colors.mint },
};

/** Mission status — icon + word, so it reads without knowing the colour code. */
export function StatusPill({ state }: { state: MissionState }) {
  const tone = STATES[state];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text variant="overline" color={tone.fg}>
        {`${tone.icon} ${tone.label}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
});

export default StatusPill;
