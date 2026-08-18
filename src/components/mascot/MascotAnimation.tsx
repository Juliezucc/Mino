import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
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
}

export type MascotAnimationName = 'celebrate' | 'wave' | 'breathe' | 'worry' | 'sleep';

const REST: Required<Omit<MascotKeyframe, 'expression' | 'duration'>> = {
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
  { expression: 'surprised', duration: 160, scale: 0.9, translateY: 6, scaleY: 0.94, ease: 0.5 },
  { expression: 'delighted', duration: 260, scale: 1.1, translateY: -30, scaleY: 1.08, ease: 0.45 },
  { expression: 'delighted', duration: 180, scale: 1, translateY: 0, scaleY: 0.9, scaleX: 1.1, ease: 0.5 },
  { expression: 'proud', duration: 260, scale: 1.06, translateY: -16, rotate: -5, ease: 0.5 },
  { expression: 'proud', duration: 240, scale: 1.02, translateY: -4, rotate: 5, ease: 0.7 },
  { expression: 'delighted', duration: 600, scale: 1, translateY: 0, rotate: 0, ease: 0.6 },
];

/** Greeting on arrival: a small hop and a tilt, once. */
const WAVE: MascotKeyframe[] = [
  { expression: 'happy', duration: 140, scale: 0.94, scaleY: 0.94, ease: 0.5 },
  { expression: 'proud', duration: 240, scale: 1.05, translateY: -14, rotate: -6, ease: 0.5 },
  { expression: 'proud', duration: 240, scale: 1.03, translateY: -8, rotate: 6, ease: 0.7 },
  { expression: 'happy', duration: 400, scale: 1, translateY: 0, rotate: 0, ease: 0.6 },
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
  }, [index, timeline, loop, onFinish, rotate, scale, scaleX, scaleY, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const current = timeline[index] ?? timeline[timeline.length - 1];
  const expression =
    !loop && finished.current ? restExpression ?? current.expression : current.expression;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Mascot expression={expression} size={size} />
    </Animated.View>
  );
}

export default MascotAnimation;
