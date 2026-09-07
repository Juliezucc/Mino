import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from 'react-native';

import { colors, type as typeScale } from '@/theme';

type Variant = keyof typeof typeScale;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

/** Every piece of copy goes through here, so the type scale is never bypassed. */
export function Text({
  variant = 'body',
  color = colors.text,
  center,
  style,
  ...rest
}: TextProps) {
  /**
   * Une taille imposée sans hauteur de ligne : on laisse la plateforme la
   * calculer, au lieu de garder celle de l'échelle.
   *
   * **Le défaut que cela répare, et il était partout.** Chaque style de
   * `typeScale` fixe une `lineHeight` — 23 points pour `body`. Un appelant qui
   * ne veut qu'agrandir un émoji écrit `style={{ fontSize: 52 }}` et hérite
   * malgré lui d'une ligne de 23 : le glyphe déborde de sa ligne, et le
   * conteneur — presque toujours arrondi, donc `overflow: 'hidden'` — tranche
   * ce qui sort.
   *
   * On l'a vu sur les avatars, réduits à leur moitié basse : un lion sans tête,
   * un renard sans oreilles. Mais dix autres endroits faisaient la même chose —
   * l'icône d'une mission, celle d'un appareil, celle d'une routine. Corriger
   * les appelants un par un aurait laissé le piège en place pour le onzième.
   *
   * `undefined` et non une valeur calculée : React Native donne alors au texte
   * la hauteur naturelle de sa police, qui est la seule à connaître ses propres
   * ascendantes — et celles d'un émoji ne ressemblent à celles d'aucune lettre.
   */
  const impose = StyleSheet.flatten(style) as TextStyle | undefined;
  const echelle =
    impose?.fontSize && impose?.lineHeight === undefined
      ? { ...typeScale[variant], lineHeight: undefined }
      : typeScale[variant];

  return (
    <RNText
      style={[echelle, { color }, center && styles.center, style]}
      // Respect the reader, but keep child screens from exploding on huge settings.
      maxFontSizeMultiplier={1.6}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});

export default Text;
