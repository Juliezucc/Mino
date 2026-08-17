import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { mascotImageFor } from './mascotAssets';
import { MascotExpression } from './types';

/**
 * Vector placeholder for the 3D mascot: light blue round body, big shiny eyes
 * with a white ring, pink cheeks, small arms and peach shoes.
 *
 * It is intentionally drawn — not a static PNG — so every expression exists
 * from day one. Drop real renders into `mascotAssets.ts` to replace it.
 */

const VIEWBOX = 200;

const INK = '#1A1D2E';
const SHOE = '#FFB592';
const SHOE_DARK = '#F19E7C';
const CHEEK = '#FF9BB8';

interface Props {
  expression?: MascotExpression;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Mascot({ expression = 'happy', size = 160, style }: Props) {
  const image = mascotImageFor(expression);
  if (image) {
    return (
      <View style={style}>
        <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          <LinearGradient id="body" x1="0.3" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor="#7FD0FF" />
            <Stop offset="0.55" stopColor="#4EB6FF" />
            <Stop offset="1" stopColor="#2F9BEC" />
          </LinearGradient>
          <LinearGradient id="limb" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#57BAFF" />
            <Stop offset="1" stopColor="#2E97E8" />
          </LinearGradient>
          <RadialGradient id="gloss" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ground" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#1A1D2E" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#1A1D2E" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* soft contact shadow */}
        <Ellipse cx="100" cy="184" rx="54" ry="10" fill="url(#ground)" />

        {/* legs + shoes */}
        <G>
          <Path d="M78 148 L74 168 Q74 172 79 172 L88 172 Q92 172 92 168 L90 148 Z" fill="url(#limb)" />
          <Path d="M122 148 L126 168 Q126 172 121 172 L112 172 Q108 172 108 168 L110 148 Z" fill="url(#limb)" />
          <Ellipse cx="76" cy="174" rx="20" ry="9.5" fill={SHOE} />
          <Ellipse cx="124" cy="174" rx="20" ry="9.5" fill={SHOE} />
          <Ellipse cx="76" cy="178" rx="19" ry="5" fill={SHOE_DARK} opacity={0.5} />
          <Ellipse cx="124" cy="178" rx="19" ry="5" fill={SHOE_DARK} opacity={0.5} />
        </G>

        <Arms expression={expression} />

        {/* body */}
        <Ellipse cx="100" cy="96" rx="70" ry="66" fill="url(#body)" />
        <Ellipse cx="74" cy="60" rx="30" ry="20" fill="url(#gloss)" />

        {/* cheeks */}
        <Ellipse cx="56" cy="112" rx="13" ry="8.5" fill={CHEEK} opacity={0.55} />
        <Ellipse cx="144" cy="112" rx="13" ry="8.5" fill={CHEEK} opacity={0.55} />

        <Eyes expression={expression} />
        <Mouth expression={expression} />
        <Extras expression={expression} />
      </Svg>
    </View>
  );
}

/* ---------------------------------------------------------------------- eyes */

function Eyes({ expression }: { expression: MascotExpression }) {
  if (expression === 'proud') {
    // Happy closed eyes: two upward arcs.
    return (
      <G stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
        <Path d="M60 92 Q74 76 88 92" />
        <Path d="M112 92 Q126 76 140 92" />
      </G>
    );
  }

  if (expression === 'sleepy') {
    return (
      <G stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
        <Path d="M60 90 Q74 102 88 90" />
        <Path d="M112 90 Q126 102 140 90" />
      </G>
    );
  }

  if (expression === 'delighted') {
    return (
      <G>
        <EyeBall cx={74} cy={90} rx={19} ry={21} />
        <EyeBall cx={126} cy={90} rx={19} ry={21} />
        <Star cx={74} cy={88} r={9} fill="#FFC85A" />
        <Star cx={126} cy={88} r={9} fill="#FFC85A" />
      </G>
    );
  }

  const wide = expression === 'surprised';
  const droop = expression === 'sad' || expression === 'worried' ? 3 : 0;
  const rx = wide ? 20 : 19;
  const ry = wide ? 24 : 21;

  return (
    <G>
      <EyeBall cx={74} cy={90 + droop} rx={rx} ry={ry} />
      <EyeBall cx={126} cy={90 + droop} rx={rx} ry={ry} />
      {(expression === 'worried' || expression === 'sad') && (
        <G stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" opacity={0.9}>
          <Path d="M58 66 Q72 60 86 66" />
          <Path d="M114 66 Q128 60 142 66" />
        </G>
      )}
    </G>
  );
}

function EyeBall({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={rx + 3.5} ry={ry + 3.5} fill="#FFFFFF" />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} />
      <Circle cx={cx - rx * 0.32} cy={cy - ry * 0.36} r={rx * 0.34} fill="#FFFFFF" />
      <Circle cx={cx + rx * 0.3} cy={cy + ry * 0.34} r={rx * 0.15} fill="#FFFFFF" opacity={0.8} />
    </G>
  );
}

/* --------------------------------------------------------------------- mouth */

function Mouth({ expression }: { expression: MascotExpression }) {
  switch (expression) {
    case 'surprised':
      return <Ellipse cx="100" cy="126" rx="9" ry="11" fill={INK} />;
    case 'sad':
      return (
        <Path
          d="M88 132 Q100 122 112 132"
          stroke={INK}
          strokeWidth={5.5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'worried':
      return (
        <Path
          d="M88 128 Q94 122 100 128 Q106 134 112 128"
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'sleepy':
      return <Ellipse cx="100" cy="128" rx="7" ry="6" fill={INK} opacity={0.9} />;
    case 'proud':
    case 'delighted':
      return (
        <G>
          <Path d="M82 120 Q100 146 118 120 Z" fill={INK} />
          <Path d="M92 133 Q100 141 108 133 Z" fill="#FF7DA0" />
        </G>
      );
    default:
      return (
        <G>
          <Path d="M86 121 Q100 140 114 121 Z" fill={INK} />
          <Path d="M94 131 Q100 137 106 131 Z" fill="#FF7DA0" />
        </G>
      );
  }
}

/* ---------------------------------------------------------------------- arms */

function Arms({ expression }: { expression: MascotExpression }) {
  const raised = expression === 'proud' || expression === 'delighted' || expression === 'motivated';

  if (raised) {
    return (
      <G fill="url(#limb)">
        <Ellipse cx="28" cy="72" rx="13" ry="22" transform="rotate(28 28 72)" />
        <Ellipse cx="172" cy="72" rx="13" ry="22" transform="rotate(-28 172 72)" />
      </G>
    );
  }

  return (
    <G fill="url(#limb)">
      <Ellipse cx="32" cy="112" rx="13" ry="22" transform="rotate(12 32 112)" />
      <Ellipse cx="168" cy="112" rx="13" ry="22" transform="rotate(-12 168 112)" />
    </G>
  );
}

/* -------------------------------------------------------------------- extras */

function Extras({ expression }: { expression: MascotExpression }) {
  if (expression === 'motivated') {
    return <Star cx={100} cy={140} r={20} fill="#FFC85A" stroke="#F0AE33" />;
  }
  if (expression === 'sleepy') {
    return (
      <G fill="#7A7CFF">
        <ZLetter x={148} y={44} size={13} />
        <ZLetter x={166} y={26} size={10} />
        <ZLetter x={180} y={12} size={7} />
      </G>
    );
  }
  return null;
}

function Star({
  cx,
  cy,
  r,
  fill,
  stroke,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
}) {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return (
    <Path
      d={`M${points.join(' L')} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 3 : 0}
      strokeLinejoin="round"
    />
  );
}

function ZLetter({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <Path
      d={`M${x} ${y} h${size} l-${size} ${size} h${size}`}
      stroke="#7A7CFF"
      strokeWidth={size * 0.22}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export default Mascot;
