import { ImageSourcePropType } from 'react-native';

import { MascotExpression } from './types';

/**
 * Final 3D renders drop in here — nothing else changes.
 *
 * Save one PNG per expression (transparent background, ~1024px square) under
 * `assets/mascot/` and uncomment the matching line. `<Mascot />` prefers an
 * image when one exists and falls back to the vector placeholder otherwise,
 * so the app is never broken mid-migration.
 *
 *   happy: require('../../../assets/mascot/happy.png'),
 */
export const mascotImages: Partial<Record<MascotExpression, ImageSourcePropType>> = {
  // happy: require('../../../assets/mascot/happy.png'),
  // proud: require('../../../assets/mascot/proud.png'),
  // motivated: require('../../../assets/mascot/motivated.png'),
  // surprised: require('../../../assets/mascot/surprised.png'),
  // delighted: require('../../../assets/mascot/delighted.png'),
  // worried: require('../../../assets/mascot/worried.png'),
  // sad: require('../../../assets/mascot/sad.png'),
  // sleepy: require('../../../assets/mascot/sleepy.png'),
};

export function mascotImageFor(expression: MascotExpression): ImageSourcePropType | undefined {
  return mascotImages[expression];
}
