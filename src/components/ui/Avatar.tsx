import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AvatarKey } from '@/domain/types';
import { colors, radii } from '@/theme';

import { Text } from './Text';
import { avatarImage } from './avatarAssets';

/**
 * Six little creatures from Mino's own world — a child picks a picture, never
 * types a name.
 *
 * They are keyed and labelled by colour on purpose: a five-year-old who cannot
 * read yet finds their profile as "the pink one", instantly, and colour is the
 * one attribute that survives being shown at 26px in a list.
 *
 * The emoji are a fallback for as long as the artwork is missing, and a safety
 * net if a file ever fails to load.
 */
export const AVATARS: { key: AvatarKey; emoji: string; label: string; color: string }[] = [
  { key: 'blue', emoji: '🐲', label: 'Bleu', color: '#DCEBFF' },
  { key: 'green', emoji: '🌱', label: 'Vert', color: '#E2F6DA' },
  { key: 'pink', emoji: '🐙', label: 'Rose', color: '#FFD9E6' },
  { key: 'yellow', emoji: '👁️', label: 'Jaune', color: '#FFF0CE' },
  { key: 'purple', emoji: '👾', label: 'Violet', color: '#EAE0FF' },
  { key: 'teal', emoji: '🦕', label: 'Turquoise', color: '#D6F3F1' },
];

/**
 * Profiles created before the creatures replaced the animals. Kept so an
 * existing family does not open the app to a blank avatar.
 */
const LEGACY: Record<string, AvatarKey> = {
  fox: 'yellow',
  cat: 'pink',
  panda: 'teal',
  rabbit: 'purple',
  bear: 'blue',
  owl: 'green',
};

export function avatarFor(key: AvatarKey) {
  const resolved = LEGACY[key] ?? key;
  return AVATARS.find((a) => a.key === resolved) ?? AVATARS[0];
}

interface Props {
  avatarKey: AvatarKey;
  size?: number;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}

export function Avatar({ avatarKey, size = 56, style, selected }: Props) {
  const avatar = avatarFor(avatarKey);
  const image = avatarImage(avatar.key);

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
      {image ? (
        <Image
          source={image}
          style={{ width: size * 0.86, height: size * 0.86 }}
          contentFit="contain"
          transition={0}
        />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{avatar.emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  selected: {
    borderWidth: 3,
    borderColor: colors.blue,
  },
});

export default Avatar;
