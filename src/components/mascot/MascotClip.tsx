import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { MascotAnimation, MascotAnimationName } from './MascotAnimation';
import { MascotExpression } from './types';

/**
 * Plays a rendered animation clip when one exists, and falls back to the
 * keyframe player otherwise.
 *
 * A clip is a transparent animated WebP produced by
 * `scripts/video-to-sequence.mjs`. It carries the character's own deformation —
 * the crouch, the arms going up, the face — which is exactly what still poses
 * cannot express. The movement through space stays in code: that is the part a
 * generated clip loses the character on, and the part `MascotAnimation` already
 * gets right.
 */

const CLIPS: Partial<Record<MascotAnimationName, number>> = {
  celebrate: require('../../../assets/mascot/sequence/celebration.webp'),
};

interface Props {
  name: MascotAnimationName;
  size?: number;
  restExpression?: MascotExpression;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MascotClip({ name, size = 200, restExpression, loop, style }: Props) {
  const clip = CLIPS[name];

  if (!clip) {
    return (
      <MascotAnimation name={name} size={size} restExpression={restExpression} loop={loop} style={style} />
    );
  }

  return (
    <View style={style}>
      <Image
        source={clip}
        style={{ width: size, height: size }}
        contentFit="contain"
        // The WebP is encoded to play once and hold its last frame.
        autoplay
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
}

export default MascotClip;
