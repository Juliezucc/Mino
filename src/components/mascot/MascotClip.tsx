import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MascotAnimation, MascotAnimationName, MascotKeyframe } from './MascotAnimation';
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
 *
 * A one-shot clip holds its last frame, which reads as the mascot freezing
 * mid-gesture. So when the clip is over this hands back to the still artwork
 * and keeps it quietly breathing — the character settles instead of stopping.
 */

interface Clip {
  source: number;
  durationMs: number;
  loop: boolean;
}

/**
 * To add a clip: generate it with the script, then register it here.
 *
 *   node scripts/video-to-sequence.mjs <video> <start> <duration> --name=idle --loop
 */
const CLIPS: Partial<Record<MascotAnimationName, Clip>> = {
  celebrate: {
    source: require('../../../assets/mascot/sequence/celebrate.webp'),
    ...require('../../../assets/mascot/sequence/celebrate.json'),
  },
};

/** Barely-there breathing, so the settled pose is never a frozen image. */
function breathingOn(expression: MascotExpression): MascotKeyframe[] {
  return [
    { expression, duration: 1600, scale: 1.025, scaleY: 1.025, translateY: -4, ease: 1 },
    { expression, duration: 1600, scale: 1, scaleY: 1, translateY: 0, ease: 1 },
  ];
}

interface Props {
  name: MascotAnimationName;
  size?: number;
  /** Pose the mascot settles into once a one-shot clip is over. */
  restExpression?: MascotExpression;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MascotClip({ name, size = 200, restExpression = 'happy', loop, style }: Props) {
  const clip = CLIPS[name];
  const [settled, setSettled] = useState(false);
  // Memoised: a fresh array on every render would restart the breathing loop
  // and make the settled mascot flicker.
  const breathing = useMemo(() => breathingOn(restExpression), [restExpression]);
  const mix = useSharedValue(0);

  useEffect(() => {
    if (!clip || clip.loop || loop) return;
    // Start handing over slightly before the last frame so the two overlap.
    const timer = setTimeout(() => {
      setSettled(true);
      mix.value = withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) });
    }, Math.max(0, clip.durationMs - 160));
    return () => clearTimeout(timer);
  }, [clip, loop, mix]);

  const clipStyle = useAnimatedStyle(() => ({ opacity: 1 - mix.value }));
  const restStyle = useAnimatedStyle(() => ({ opacity: mix.value }));

  if (!clip) {
    return (
      <MascotAnimation name={name} size={size} restExpression={restExpression} loop={loop} style={style} />
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[styles.layer, clipStyle]}>
        <Image
          source={clip.source}
          style={{ width: size, height: size }}
          contentFit="contain"
          autoplay
          cachePolicy="memory-disk"
          transition={0}
        />
      </Animated.View>

      {settled ? (
        <Animated.View style={[styles.layer, restStyle]}>
          <MascotAnimation frames={breathing} size={size} loop />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});

export default MascotClip;
