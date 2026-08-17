import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from './Mascot';
import { MascotExpression } from './types';

interface Props {
  expression?: MascotExpression;
  size?: number;
  /** 'enter' pops in once, 'celebrate' adds a short jump, 'none' stays still. */
  animation?: 'enter' | 'celebrate' | 'none';
  style?: StyleProp<ViewStyle>;
}

/**
 * Short, rewarding motion only. Nothing loops forever: a permanently moving
 * mascot competes with the interface instead of supporting it.
 */
export function AnimatedMascot({ expression = 'happy', size = 160, animation = 'enter', style }: Props) {
  const scale = useSharedValue(animation === 'none' ? 1 : 0.85);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (animation === 'none') return;

    scale.value = withSpring(1, { damping: 9, stiffness: 140 });

    if (animation === 'celebrate') {
      translateY.value = withSequence(
        withDelay(120, withSpring(-18, { damping: 6, stiffness: 180 })),
        withSpring(0, { damping: 8, stiffness: 160 }),
      );
      rotate.value = withDelay(
        120,
        withRepeat(withSequence(withTiming(-5, { duration: 130 }), withTiming(5, { duration: 130 })), 4, true),
      );
      // Settle back straight so the mascot never ends up crooked.
      rotate.value = withDelay(1200, withTiming(0, { duration: 160 }));
    }
  }, [animation, expression, rotate, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Mascot expression={expression} size={size} />
    </Animated.View>
  );
}

export default AnimatedMascot;
