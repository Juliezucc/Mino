import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AvatarKey } from '@/domain/types';
import { colors, radii } from '@/theme';

import { Text } from './Text';

/** Six friendly animals — a child picks a picture, never types a name. */
export const AVATARS: { key: AvatarKey; emoji: string; label: string; color: string }[] = [
  { key: 'fox', emoji: '🦊', label: 'Renard', color: '#FFE2CE' },
  { key: 'cat', emoji: '🐱', label: 'Chat', color: '#FFEFD1' },
  { key: 'panda', emoji: '🐼', label: 'Panda', color: '#E7ECFB' },
  { key: 'rabbit', emoji: '🐰', label: 'Lapin', color: '#FFD9E6' },
  { key: 'bear', emoji: '🐻', label: 'Ours', color: '#FFE3C7' },
  { key: 'owl', emoji: '🦉', label: 'Hibou', color: '#E0E1FF' },
];

export function avatarFor(key: AvatarKey) {
  return AVATARS.find((a) => a.key === key) ?? AVATARS[0];
}

interface Props {
  avatarKey: AvatarKey;
  size?: number;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}

export function Avatar({ avatarKey, size = 56, style, selected }: Props) {
  const avatar = avatarFor(avatarKey);
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: avatar.color,
        },
        selected && styles.selected,
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{avatar.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  selected: {
    borderWidth: 3,
    borderColor: colors.blue,
  },
});

export default Avatar;
