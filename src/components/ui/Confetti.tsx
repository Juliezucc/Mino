import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { colors } from '@/theme';

const PALETTE = [colors.blue, colors.purple, colors.mint, colors.yellow, colors.pink];

interface Props {
  count?: number;
  /** Total fall duration in ms. Kept short: a reward, not a screensaver. */
  duration?: number;
}

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  rotation: number;
  drift: number;
  round: boolean;
}

/** Light confetti burst used only when a mission is validated. */
export function Confetti({ count = 26, duration = 2200 }: Props) {
  const { width, height } = Dimensions.get('window');

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        size: 7 + Math.random() * 9,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        delay: Math.random() * 600,
        rotation: Math.random() * 720 - 360,
        drift: Math.random() * 80 - 40,
        round: Math.random() > 0.5,
      })),
    [count, width],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} height={height} duration={duration} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
  height,
  duration,
}: {
  piece: Piece;
  height: number;
  duration: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
    );
  }, [duration, piece.delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -40 + progress.value * (height + 80) },
      { translateX: progress.value * piece.drift },
      { rotate: `${progress.value * piece.rotation}deg` },
    ],
    opacity: progress.value > 0.85 ? (1 - progress.value) / 0.15 : 1,
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.x,
          width: piece.size,
          height: piece.size * (piece.round ? 1 : 1.6),
          borderRadius: piece.round ? piece.size : 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});

export default Confetti;
