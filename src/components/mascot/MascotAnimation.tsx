import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from './Mascot';
import { MascotExpression } from './types';

/**
 * Keyframe player for the mascot.
 *
 * A character can be animated convincingly from a set of still poses: hold an
 * expression, move/scale/squash the whole sprite between poses, and the eye
 * reads it as one continuous performance. That is all this component does — no
 * video, no extra runtime, and it works identically on the vector mascot and on
 * the final 3D renders, because it only ever animates the container.
 */

export interface MascotKeyframe {
  expression: MascotExpression;
  /** How long this pose is held, in ms. */
  duration: number;
  scale?: number;
  /** Squash & stretch, applied on top of `scale`. */
  scaleX?: number;
  scaleY?: number;
  translateY?: number;
  rotate?: number;
  /** Portion of `duration` spent travelling to this pose (0 = hard cut). */
  ease?: number;
  /** Cross-fade into this pose, in ms. Defaults to half the duration, capped. */
  fade?: number;
}

export type MascotAnimationName = 'celebrate' | 'wave' | 'breathe' | 'worry' | 'sleep';

const REST: Required<Omit<MascotKeyframe, 'expression' | 'duration' | 'fade'>> = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  translateY: 0,
  rotate: 0,
  ease: 0.6,
};

/**
 * Mission validated: a startled beat, a jump, a landing that squashes, a proud
 * chest-out, then settle. Roughly the beats a 2D animator would key by hand.
 */
const CELEBRATE: MascotKeyframe[] = [
  // Anticipation: a small crouch down before the jump. Without it the take-off
  // reads as a teleport however smooth the interpolation is.
  { expression: 'happy', duration: 130, scale: 0.95, scaleY: 0.9, translateY: 10, ease: 0.6, fade: 90 },
  // Take-off and apex. The pose changes mid-flight, where the eye is tracking
  // the movement rather than the drawing, so the swap goes unnoticed.
  { expression: 'surprised', duration: 110, scale: 1.04, scaleY: 1.08, translateY: -12, ease: 0.45, fade: 70 },
  { expression: 'delighted', duration: 250, scale: 1.12, scaleY: 1.05, translateY: -36, ease: 0.4, fade: 80 },
  // Landing: squash carries the weight.
  { expression: 'delighted', duration: 150, scale: 1, scaleY: 0.87, scaleX: 1.13, translateY: 2, ease: 0.45 },
  { expression: 'delighted', duration: 110, scale: 1.02, scaleY: 1.03, translateY: -6, ease: 0.6 },
  // Proud beat, rocking left then right.
  { expression: 'proud', duration: 240, scale: 1.06, translateY: -12, rotate: -5, ease: 0.5, fade: 150 },
  { expression: 'proud', duration: 220, scale: 1.03, translateY: -4, rotate: 5, ease: 0.7 },
  { expression: 'delighted', duration: 700, scale: 1, translateY: 0, rotate: 0, ease: 0.6, fade: 200 },
];

/** Greeting on arrival: a small hop and a tilt, once. */
const WAVE: MascotKeyframe[] = [
  { expression: 'happy', duration: 130, scale: 0.95, scaleY: 0.93, translateY: 6, ease: 0.6 },
  { expression: 'proud', duration: 240, scale: 1.05, translateY: -16, rotate: -6, ease: 0.45, fade: 110 },
  { expression: 'proud', duration: 240, scale: 1.03, translateY: -8, rotate: 6, ease: 0.7 },
  { expression: 'happy', duration: 460, scale: 1, translateY: 0, rotate: 0, ease: 0.6, fade: 180 },
];

/** Idle breathing, loopable. Deliberately tiny — it must never pull focus. */
const BREATHE: MascotKeyframe[] = [
  { expression: 'happy', duration: 1400, scale: 1.02, scaleY: 1.02, translateY: -3, ease: 1 },
  { expression: 'happy', duration: 1400, scale: 1, scaleY: 1, translateY: 0, ease: 1 },
];

/** Almost out of time: a worried little shiver. */
const WORRY: MascotKeyframe[] = [
  { expression: 'worried', duration: 200, rotate: -4, ease: 0.4 },
  { expression: 'worried', duration: 200, rotate: 4, ease: 0.4 },
  { expression: 'sad', duration: 260, rotate: 0, scale: 0.97, translateY: 4, ease: 0.6 },
  { expression: 'sad', duration: 700, scale: 1, translateY: 0, ease: 0.8 },
];

/** Out of time / goodnight, loopable. */
const SLEEP: MascotKeyframe[] = [
  { expression: 'sleepy', duration: 1600, scale: 1.02, translateY: -2, ease: 1 },
  { expression: 'sleepy', duration: 1600, scale: 0.99, translateY: 2, ease: 1 },
];

const PRESETS: Record<MascotAnimationName, MascotKeyframe[]> = {
  celebrate: CELEBRATE,
  wave: WAVE,
  breathe: BREATHE,
  worry: WORRY,
  sleep: SLEEP,
};

interface Props {
  name?: MascotAnimationName;
  frames?: MascotKeyframe[];
  size?: number;
  loop?: boolean;
  /** Pose shown once a non-looping animation is over. Defaults to the last frame. */
  restExpression?: MascotExpression;
  style?: StyleProp<ViewStyle>;
  onFinish?: () => void;
}

export function MascotAnimation({
  name = 'celebrate',
  frames,
  size = 180,
  loop = false,
  restExpression,
  style,
  onFinish,
}: Props) {
  const timeline = frames ?? PRESETS[name];

  const [index, setIndex] = useState(0);
  // Two stacked layers dissolving into each other. Swapping a single image
  // reads as a cut however smooth the movement around it is; because the poses
  // are normalised on the body, the dissolve keeps the body rock solid and only
  // the arms and face morph — which is what sells it as one continuous move.
  const [layers, setLayers] = useState(() => ({
    from: timeline[0].expression,
    to: timeline[0].expression,
  }));
  const mix = useSharedValue(1);
  const scale = useSharedValue(1);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    setIndex(0);
    finished.current = false;
  }, [timeline]);

  useEffect(() => {
    const frame = timeline[index];
    if (!frame) return;

    const pose = { ...REST, ...frame };
    const travel = Math.max(60, frame.duration * pose.ease);
    const config = { duration: travel, easing: Easing.out(Easing.cubic) };

    scale.value = withTiming(pose.scale, config);
    scaleX.value = withTiming(pose.scaleX, config);
    scaleY.value = withTiming(pose.scaleY, config);
    translateY.value = withTiming(pose.translateY, config);
    rotate.value = withTiming(pose.rotate, config);

    setLayers((previous) => {
      if (previous.to === frame.expression) return previous;
      return { from: previous.to, to: frame.expression };
    });
    mix.value = 0;
    mix.value = withTiming(1, {
      duration: frame.fade ?? Math.min(140, frame.duration * 0.5),
      easing: Easing.inOut(Easing.quad),
    });

    timer.current = setTimeout(() => {
      const next = index + 1;
      if (next < timeline.length) {
        setIndex(next);
      } else if (loop) {
        setIndex(0);
      } else if (!finished.current) {
        finished.current = true;
        onFinish?.();
      }
    }, frame.duration);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, timeline, loop, onFinish, rotate, scale, scaleX, scaleY, translateY, mix]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const fromStyle = useAnimatedStyle(() => ({ opacity: 1 - mix.value }));
  const toStyle = useAnimatedStyle(() => ({ opacity: mix.value }));

  const current = timeline[index] ?? timeline[timeline.length - 1];
  const settled =
    !loop && finished.current ? restExpression ?? current.expression : null;

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle, style]}>
      {settled ? (
        <Mascot expression={settled} size={size} />
      ) : (
        <>
          {layers.from !== layers.to ? (
            <Animated.View style={[styles.layer, fromStyle]}>
              <Mascot expression={layers.from} size={size} />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.layer, toStyle]}>
            <Mascot expression={layers.to} size={size} />
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});

export default MascotAnimation;
