import React from 'react';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Minimal stroke icon set. Rounded caps and joins only — the geometry has to
 * match the soft, rounded personality of the brand.
 */
export type IconName =
  | 'missions'
  | 'clock'
  | 'profile'
  | 'home'
  | 'children'
  | 'settings'
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'check'
  | 'play'
  | 'lock';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = colors.textMuted, strokeWidth = 2.2 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, common, color)}
    </Svg>
  );
}

function renderPaths(name: IconName, common: object, color: string) {
  switch (name) {
    case 'missions':
      return (
        <>
          <Path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" {...common} />
          <Path d="M16 5h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" {...common} />
          <Polyline points="9 12 11 14 15 10" {...common} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Polyline points="12 7 12 12 15.5 14" {...common} />
        </>
      );
    case 'profile':
      return (
        <>
          <Circle cx="12" cy="8.5" r="3.8" {...common} />
          <Path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" {...common} />
        </>
      );
    case 'home':
      return (
        <>
          <Path d="M4 10.5 12 4l8 6.5" {...common} />
          <Path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" {...common} />
        </>
      );
    case 'children':
      return (
        <>
          <Circle cx="8.5" cy="9" r="3.2" {...common} />
          <Circle cx="16.5" cy="10" r="2.6" {...common} />
          <Path d="M3.5 19a5 5 0 0 1 10 0" {...common} />
          <Path d="M15 15.6a4.4 4.4 0 0 1 5.5 3.4" {...common} />
        </>
      );
    case 'settings':
      return (
        <>
          <Path d="M5 7h14M5 12h14M5 17h14" {...common} />
          <Circle cx="9" cy="7" r="2" {...common} />
          <Circle cx="15" cy="12" r="2" {...common} />
          <Circle cx="10" cy="17" r="2" {...common} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...common} />;
    case 'chevron-left':
      return <Polyline points="14.5 6 9 12 14.5 18" {...common} />;
    case 'chevron-right':
      return <Polyline points="9.5 6 15 12 9.5 18" {...common} />;
    case 'close':
      return <Path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" {...common} />;
    case 'check':
      return <Polyline points="5 12.5 10 17.5 19 7" {...common} />;
    case 'play':
      return <Path d="M8 5.5 18 12 8 18.5Z" {...common} fill={color} />;
    case 'lock':
      return (
        <>
          <Path d="M7 10.5V8a5 5 0 0 1 10 0v2.5" {...common} />
          <Path d="M5.5 10.5h13a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z" {...common} />
        </>
      );
    default:
      return null;
  }
}

export default Icon;
