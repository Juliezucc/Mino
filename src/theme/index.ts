import { Platform, TextStyle, ViewStyle } from 'react-native';

import { colors } from './colors';

export { colors, accentFor, accentCycle } from './colors';

/** 4pt base scale — everything in the UI snaps to it. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/**
 * Extremely light shadows: the UI should feel like paper resting on paper,
 * never like a boxed-in dashboard.
 */
export const shadows = {
  none: {} as ViewStyle,
  soft: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1D2E',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: {},
  })!,
  lifted: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1D2E',
      shadowOpacity: 0.1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 5 },
    default: {},
  })!,
  brand: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#4EB6FF',
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 6 },
    default: {},
  })!,
};

export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'color'>;

/**
 * Two ladders: `kid` is deliberately larger and rounder (a 5 year old reads it
 * from arm's length), `app` is the calmer parent-side ladder.
 */
export const type = {
  display: { fontFamily: fonts.black, fontSize: 56, lineHeight: 62, letterSpacing: -1 },
  hero: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  section: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  button: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 22 },
  buttonKid: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 26 },
} satisfies Record<string, TypeStyle>;

/** Bottom padding a scroll view needs to clear the floating tab bar. */
export const tabBarSpace = 118;

/** Minimum touch target for a child-facing control. */
export const hitSize = {
  kid: 64,
  parent: 52,
} as const;

export const theme = { colors, spacing, radii, shadows, type, fonts, hitSize };
export type Theme = typeof theme;
