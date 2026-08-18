import { ImageSourcePropType } from 'react-native';

import { MascotExpression } from './types';

/**
 * The final 3D renders, one per expression.
 *
 * These are the normalised files produced by `scripts/normalize-mascot.mjs`
 * from the untouched originals in `assets/mascot/source/`. Normalisation is
 * what lets any expression replace any other without the mascot jumping: every
 * file is a 1024px square with the body at the same size and the same centre.
 *
 * To update a pose: drop the new render in `assets/mascot/source/` under the
 * same name and run `node scripts/normalize-mascot.mjs`.
 *
 * `<Mascot />` falls back to the vector mascot for any expression missing here,
 * so a partial set never breaks a screen.
 */
export const mascotImages: Partial<Record<MascotExpression, ImageSourcePropType>> = {
  happy: require('../../../assets/mascot/happy.png'),
  proud: require('../../../assets/mascot/proud.png'),
  motivated: require('../../../assets/mascot/motivated.png'),
  surprised: require('../../../assets/mascot/surprised.png'),
  delighted: require('../../../assets/mascot/delighted.png'),
  worried: require('../../../assets/mascot/worried.png'),
  sad: require('../../../assets/mascot/sad.png'),
  sleepy: require('../../../assets/mascot/sleepy.png'),
};

export function mascotImageFor(expression: MascotExpression): ImageSourcePropType | undefined {
  return mascotImages[expression];
}
