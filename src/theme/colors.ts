/**
 * Mino palette — soft 3D + modern SaaS + premium kids universe.
 * Every colour used in the product must come from here.
 */
export const colors = {
  // Brand
  blue: '#4EB6FF',
  // Ne sert jamais de fond, seulement d'écriture : sa valeur d'origine
  // (#2E9BEA) donnait 2,2:1 sur le bleu pâle qu'elle accompagne toujours.
  blueDark: '#0065AC',
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

  /**
   * Les mêmes teintes, assombries pour porter du texte.
   *
   * Mesuré, pas supposé (`npm run audit:a11y`) : le bleu de marque écrit sur du
   * blanc donne **2,22:1**, le mint sur son fond pâle **1,83:1**. Le seuil
   * lisible est 4,5:1. Une couleur vive est faite pour remplir une surface, pas
   * pour dessiner des lettres — c'est vrai de toutes les palettes, et ça se
   * voit d'autant plus dans une application où l'on affiche un compteur en
   * chiffres de 57 pixels.
   *
   * La palette de marque ne change pas : ces encres ne servent qu'au texte, et
   * les couleurs vives gardent tous les aplats, anneaux, pastilles et
   * illustrations. Chaque valeur est la teinte d'origine, à saturation égale,
   * descendue jusqu'au premier niveau qui passe sur blanc, sur `background`,
   * sur `surfaceMuted`, sur `surfaceSunken` et sur sa propre teinte douce.
   */
  blueInk: '#0065AC',
  purpleInk: '#4548FF',
  mintInk: '#1A7A54',
  yellowInk: '#956300',
  pinkInk: '#CC0037',
  /**
   * Le rouge des messages d'erreur, mesuré sur son propre fond.
   *
   * `#D30027` donnait 4,52:1 sur `dangerSoft` — au-dessus du minimum légal de
   * 4,5, sous la règle de 5:1 que ce projet s'impose. Or c'est précisément le
   * texte qu'on lit mal : court, rouge sur rose, et lu par quelqu'un à qui il
   * vient d'arriver quelque chose. Assombri jusqu'à 5,27:1 sur le rose, 6,43
   * sur blanc, 5,94 sur le bleu clair — les trois fonds où il apparaît.
   */
  dangerInk: '#C00022',

  // Text
  navy: '#1A1D2E',
  text: '#1A1D2E',
  // Assombris eux aussi : #6B7392 tombait à 4,32:1 sur le fond de
  // l'application, et #9AA1BC à 2,56:1 sur blanc — un gris « discret » qui
  // devenait illisible dès qu'on lui confiait autre chose qu'une décoration.
  textMuted: '#5A6180',
  textSubtle: '#636D95',
  /**
   * Ce qui s'écrit **sur** une couleur de marque.
   *
   * Marine, pas blanc. Mesuré : du blanc sur le bleu #4EB6FF donne 2,2:1 et sur
   * le mint 2,1:1, quand le seuil lisible est 4,5:1 — et 3:1 même en gros
   * caractères. Le marine sur ces mêmes aplats donne 7,5:1 et 7,8:1, et il
   * passe sur toute la palette, violet compris (4,9:1).
   *
   * Décision de Julie, entre trois options mesurées : la palette est conservée
   * telle quelle, c'est l'encre qui change.
   */
  onBrand: '#1A1D2E',
  /** Et sur un aplat foncé — la puce marine — c'est l'inverse. */
  onDark: '#FFFFFF',

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
