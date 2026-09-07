import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AvatarKey } from '@/domain/types';
import { colors, radii } from '@/theme';

import { Text } from './Text';
import { avatarImage } from './avatarAssets';

/**
 * Six animals — a child picks a picture, never types a name.
 *
 * Animals rather than little creatures, and that is the whole point. We tried a
 * set of round, bright-eyed monsters and they were charming, but they were also
 * Mino's siblings: at 40px, in a row, a child could not tell which one was the
 * guide and which one was them. Mino is the only character in this world.
 *
 * Each animal keeps a distinct tint, so a five-year-old who cannot read finds
 * their profile by colour and shape at once — the two things that survive being
 * drawn at 26px in a list.
 */
export const AVATARS: { key: AvatarKey; emoji: string; label: string; color: string }[] = [
  { key: 'fox', emoji: '🦊', label: 'Renard', color: '#FFE2CE' },
  { key: 'panda', emoji: '🐼', label: 'Panda', color: '#E7ECFB' },
  { key: 'rabbit', emoji: '🐰', label: 'Lapin', color: '#FFD9E6' },
  { key: 'koala', emoji: '🐨', label: 'Koala', color: '#D6F3F1' },
  { key: 'lion', emoji: '🦁', label: 'Lion', color: '#FFF0CE' },
  { key: 'frog', emoji: '🐸', label: 'Grenouille', color: '#E2F6DA' },
];

/**
 * Les clés qu'une version de développement a pu écrire, redirigées.
 *
 * Le commentaire précédent parlait de « familles existantes », ce qui laissait
 * croire à des profils en production : il n'y en a aucun, l'application n'a
 * jamais été publiée. Ces deux renommages (créatures colorées → animaux) sont
 * restés dans les téléphones de test, et nulle part ailleurs.
 *
 * On garde la table quand même, parce qu'elle coûte neuf lignes et qu'un
 * appareil de test qui ouvre Mino sur le mauvais animal fait perdre du temps
 * pour rien. `avatarFor` ne renvoie de toute façon jamais rien de vide : sans
 * cette table, une clé inconnue donnerait simplement un renard.
 *
 * **À supprimer à la première mise en production** : à partir de là, plus
 * personne ne peut détenir ces clés.
 */
const LEGACY: Record<string, AvatarKey> = {
  // The colour keys, from the monster set.
  blue: 'fox',
  green: 'frog',
  pink: 'rabbit',
  yellow: 'lion',
  purple: 'panda',
  teal: 'koala',
  // The first animal set, before the colours.
  cat: 'rabbit',
  bear: 'koala',
  owl: 'lion',
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
        // La hauteur de ligne n'est pas fixée ici à dessein : `Text` laisse la
        // plateforme la calculer dès qu'une taille est imposée sans elle. C'est
        // ce qui rend l'animal entier — il était coupé à sa moitié basse.
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
