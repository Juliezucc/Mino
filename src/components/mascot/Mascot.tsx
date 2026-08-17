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
 * Vector Mino, drawn to the brand board: an almost perfectly round light-blue
 * body with a soft 3D sheen, very large shiny eyes ringed in white, pink
 * cheeks, a wide open smile, small blue arms and chunky peach shoes.
 *
 * It is drawn rather than shipped as PNGs so every expression exists from day
 * one. Drop the final 3D renders into `mascotAssets.ts` to replace it.
 */

const VIEWBOX = 200;

const INK = '#15182A';
const SHOE_DARK = '#EFA07D';
const CHEEK = '#FF8FB2';
const TONGUE = '#FF7DA0';
const STAR = '#FFC85A';
const STAR_EDGE = '#EFAE38';

/** Every coordinate below is expressed in this 200×200 box. */
const BODY = { cx: 100, cy: 92, rx: 66, ry: 64 };
const EYE = { left: 79, right: 121, cy: 90, prx: 18.5, pry: 21, ring: 4.5 };
const MOUTH_Y = 126;

interface Props {
  expression?: MascotExpression;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Mascot({ expression = 'happy', size = 160, style }: Props) {
  // Gradient ids must be unique per instance: several mascots can share a
  // screen, and on web a duplicated id makes every `url(#…)` fill collapse.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const ref = (name: string) => `url(#${name}-${uid})`;

  const image = mascotImageFor(expression);
  if (image) {
    return (
      <View style={style}>
        <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  const limb = ref('limb');

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          {/* Off-centre radial: the body reads as a sphere lit from the top left. */}
          <RadialGradient id={`body-${uid}`} cx="0.36" cy="0.28" r="0.85">
            <Stop offset="0" stopColor="#9FDDFF" />
            <Stop offset="0.35" stopColor="#67C4FF" />
            <Stop offset="0.72" stopColor="#4EB6FF" />
            <Stop offset="1" stopColor="#2B8FDE" />
          </RadialGradient>
          <LinearGradient id={`limb-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#63C1FF" />
            <Stop offset="1" stopColor="#2E93E0" />
          </LinearGradient>
          <LinearGradient id={`shoe-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFC4A6" />
            <Stop offset="1" stopColor="#F5A582" />
          </LinearGradient>
          <RadialGradient id={`gloss-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`cheek-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={CHEEK} stopOpacity="0.85" />
            <Stop offset="1" stopColor={CHEEK} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`ground-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#1A1D2E" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#1A1D2E" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Ellipse cx="100" cy="183" rx="52" ry="8" fill={ref('ground')} />

        {/* Legs stay short: the body almost rests on the shoes. */}
        <Path d="M82 140 L80 158 Q80 163 88 163 L96 163 Q101 163 100 158 L98 140 Z" fill={limb} />
        <Path d="M118 140 L120 158 Q120 163 112 163 L104 163 Q99 163 100 158 L102 140 Z" fill={limb} />

        <Path
          d="M64 166 Q64 152 79 152 L92 152 Q99 152 99 160 L99 172 Q99 181 88 181 L75 181 Q64 181 64 172 Z"
          fill={ref('shoe')}
        />
        <Path
          d="M136 166 Q136 152 121 152 L108 152 Q101 152 101 160 L101 172 Q101 181 112 181 L125 181 Q136 181 136 172 Z"
          fill={ref('shoe')}
        />
        <Path
          d="M64.5 174 L99 174 Q99 181 88 181 L75 181 Q64.5 181 64.5 174 Z"
          fill={SHOE_DARK}
          opacity={0.45}
        />
        <Path
          d="M135.5 174 L101 174 Q101 181 112 181 L125 181 Q135.5 181 135.5 174 Z"
          fill={SHOE_DARK}
          opacity={0.45}
        />

        <Arms expression={expression} limbFill={limb} />

        <Ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} fill={ref('body')} />
        <Ellipse
          cx="73"
          cy="50"
          rx="29"
          ry="20"
          fill={ref('gloss')}
          transform="rotate(-22 73 50)"
        />

        <Ellipse cx="52" cy="116" rx="15" ry="10" fill={ref('cheek')} />
        <Ellipse cx="148" cy="116" rx="15" ry="10" fill={ref('cheek')} />

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
      <G stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none">
        <Path d="M65 94 Q79 78 93 94" />
        <Path d="M107 94 Q121 78 135 94" />
      </G>
    );
  }

  if (expression === 'sleepy') {
    return (
      <G stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none">
        <Path d="M65 88 Q79 102 93 88" />
        <Path d="M107 88 Q121 102 135 88" />
      </G>
    );
  }

  if (expression === 'delighted') {
    return (
      <G>
        <EyeBall cx={EYE.left} cy={EYE.cy} prx={EYE.prx} pry={EYE.pry} />
        <EyeBall cx={EYE.right} cy={EYE.cy} prx={EYE.prx} pry={EYE.pry} />
        <Star cx={EYE.left} cy={EYE.cy - 1} r={9.5} fill={STAR} />
        <Star cx={EYE.right} cy={EYE.cy - 1} r={9.5} fill={STAR} />
      </G>
    );
  }

  const wide = expression === 'surprised';
  const prx = wide ? EYE.prx + 1.5 : EYE.prx;
  const pry = wide ? EYE.pry + 3 : EYE.pry;
  const troubled = expression === 'worried' || expression === 'sad';

  return (
    <G>
      <EyeBall cx={EYE.left} cy={EYE.cy} prx={prx} pry={pry} />
      <EyeBall cx={EYE.right} cy={EYE.cy} prx={prx} pry={pry} />
      {troubled && (
        <G stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none" opacity={0.8}>
          <Path d="M67 62 Q79 57 91 62" />
          <Path d="M109 62 Q121 57 133 62" />
        </G>
      )}
    </G>
  );
}

function EyeBall({ cx, cy, prx, pry }: { cx: number; cy: number; prx: number; pry: number }) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={prx + EYE.ring} ry={pry + EYE.ring} fill="#FFFFFF" />
      <Ellipse cx={cx} cy={cy} rx={prx} ry={pry} fill={INK} />
      {/* Two catchlights: the big one gives the glossy 3D read. */}
      <Ellipse
        cx={cx - prx * 0.3}
        cy={cy - pry * 0.34}
        rx={prx * 0.4}
        ry={pry * 0.36}
        fill="#FFFFFF"
      />
      <Circle
        cx={cx + prx * 0.34}
        cy={cy + pry * 0.32}
        r={prx * 0.16}
        fill="#FFFFFF"
        opacity={0.85}
      />
    </G>
  );
}

/* --------------------------------------------------------------------- mouth */

function Mouth({ expression }: { expression: MascotExpression }) {
  const y = MOUTH_Y;

  switch (expression) {
    case 'surprised':
      return <Ellipse cx="100" cy={y + 8} rx={9.5} ry={12} fill={INK} />;
    case 'sad':
      return (
        <Path
          d={`M88 ${y + 12} Q100 ${y + 2} 112 ${y + 12}`}
          stroke={INK}
          strokeWidth={5.5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'worried':
      return (
        <Path
          d={`M88 ${y + 8} Q94.5 ${y + 2} 100 ${y + 8} Q105.5 ${y + 14} 112 ${y + 8}`}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'sleepy':
      return <Ellipse cx="100" cy={y + 6} rx={7.5} ry={6.5} fill={INK} />;
    case 'proud':
    case 'delighted':
      return (
        <G>
          <Path
            d={`M83 ${y - 2} Q100 ${y - 6} 117 ${y - 2} Q117 ${y + 20} 100 ${y + 20} Q83 ${y + 20} 83 ${y - 2} Z`}
            fill={INK}
          />
          <Path d={`M91 ${y + 11} Q100 ${y + 21} 109 ${y + 11} Z`} fill={TONGUE} />
        </G>
      );
    default:
      return (
        <G>
          <Path
            d={`M85 ${y - 1} Q100 ${y - 5} 115 ${y - 1} Q115 ${y + 17} 100 ${y + 17} Q85 ${y + 17} 85 ${y - 1} Z`}
            fill={INK}
          />
          <Path d={`M92 ${y + 9} Q100 ${y + 18} 108 ${y + 9} Z`} fill={TONGUE} />
        </G>
      );
  }
}

/* ---------------------------------------------------------------------- arms */

function Arms({ expression, limbFill }: { expression: MascotExpression; limbFill: string }) {
  // Arms leave the SIDE of the body, never the top — raised any higher they
  // read as ears instead of arms.
  const raised = expression === 'proud' || expression === 'delighted';

  if (raised) {
    return (
      <G fill={limbFill}>
        <Path d="M48 100 Q28 92 20 76 Q15 65 27 62 Q38 61 43 74 Q48 88 58 96 Z" />
        <Path d="M152 100 Q172 92 180 76 Q185 65 173 62 Q162 61 157 74 Q152 88 142 96 Z" />
      </G>
    );
  }

  return (
    <G fill={limbFill}>
      <Path d="M46 104 Q27 106 19 120 Q13 132 25 136 Q37 139 43 125 Q48 114 57 110 Z" />
      <Path d="M154 104 Q173 106 181 120 Q187 132 175 136 Q163 139 157 125 Q152 114 143 110 Z" />
    </G>
  );
}

/* -------------------------------------------------------------------- extras */

function Extras({ expression }: { expression: MascotExpression }) {
  if (expression === 'motivated') {
    // Held low against the belly, clear of the mouth.
    return <Star cx={100} cy={162} r={19} fill={STAR} stroke={STAR_EDGE} />;
  }
  if (expression === 'sleepy') {
    return (
      <G>
        <ZLetter x={150} y={44} size={14} />
        <ZLetter x={169} y={26} size={10} />
        <ZLetter x={183} y={13} size={7} />
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
      strokeWidth={size * 0.24}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export default Mascot;
