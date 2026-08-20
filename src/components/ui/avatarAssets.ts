import { AvatarKey } from '@/domain/types';

/**
 * The rendered avatar artwork.
 *
 * Same arrangement as the mascot: one file listing the images, so replacing the
 * art is a matter of dropping new PNGs in `assets/avatars/` and nothing else.
 * Until they exist, `Avatar` falls back to the emoji, so the app never breaks
 * waiting on a drawing.
 *
 * Produce them with:
 *   node scripts/slice-avatars.mjs assets/avatars/source/monsters.png
 */
export const AVATAR_IMAGES: Partial<Record<AvatarKey, number>> = {
  // blue: require('../../../assets/avatars/blue.png'),
  // green: require('../../../assets/avatars/green.png'),
  // pink: require('../../../assets/avatars/pink.png'),
  // yellow: require('../../../assets/avatars/yellow.png'),
  // purple: require('../../../assets/avatars/purple.png'),
  // teal: require('../../../assets/avatars/teal.png'),
};

export function avatarImage(key: AvatarKey): number | undefined {
  return AVATAR_IMAGES[key];
}
