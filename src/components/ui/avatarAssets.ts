import { AvatarKey } from '@/domain/types';

/**
 * The rendered avatar artwork, when there is any.
 *
 * Empty on purpose today: the app ships emoji animals, because the one set of
 * illustrated avatars we tried read as six little Minos and made the mascot
 * ambiguous. Any future set has to stay clearly *not* the mascot — animals,
 * flat, no round body, no big shiny eyes.
 *
 * The seam is kept so that swapping art in is dropping six PNGs in
 * `assets/avatars/` and uncommenting below — `scripts/slice-avatars.mjs` cuts
 * them out of a single sheet.
 */
export const AVATAR_IMAGES: Partial<Record<AvatarKey, number>> = {
  // fox: require('../../../assets/avatars/fox.png'),
  // panda: require('../../../assets/avatars/panda.png'),
  // rabbit: require('../../../assets/avatars/rabbit.png'),
  // koala: require('../../../assets/avatars/koala.png'),
  // lion: require('../../../assets/avatars/lion.png'),
  // frog: require('../../../assets/avatars/frog.png'),
};

export function avatarImage(key: AvatarKey): number | undefined {
  return AVATAR_IMAGES[key];
}
