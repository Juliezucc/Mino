/**
 * Mino palette — soft 3D + modern SaaS + premium kids universe.
 * Every colour used in the product must come from here.
 */
export const colors = {
  // Brand
  blue: '#4EB6FF',
  blueDark: '#2E9BEA',
  blueSoft: '#AEE6FF',
  purple: '#7A7CFF',
  purpleSoft: '#E0E1FF',
  mint: '#2BC98A',
  mintSoft: '#D3F5E7',
  yellow: '#FFC85A',
  yellowSoft: '#FFEFD1',
  pink: '#FF7DA0',
  pinkSoft: '#FFD9E6',
  peach: '#FFB592',

  // Surfaces
  background: '#F2F6FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FF',
  surfaceSunken: '#EDF2FE',

  // Text
  navy: '#1A1D2E',
  text: '#1A1D2E',
  textMuted: '#6B7392',
  textSubtle: '#9AA1BC',
  onBrand: '#FFFFFF',

  // Lines
  border: '#E6ECFA',
  borderStrong: '#D4DEF5',

  // Status
  success: '#2BC98A',
  danger: '#FF5C7A',
  dangerSoft: '#FFE1E8',
  warning: '#FFC85A',
} as const;

export type ColorName = keyof typeof colors;

/** Accent colours cycled through mission cards so a list never looks flat. */
export const accentCycle = [
  { tint: colors.blueSoft, solid: colors.blue },
  { tint: colors.purpleSoft, solid: colors.purple },
  { tint: colors.mintSoft, solid: colors.mint },
  { tint: colors.yellowSoft, solid: colors.yellow },
  { tint: colors.pinkSoft, solid: colors.pink },
] as const;

export function accentFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return accentCycle[hash % accentCycle.length];
}
