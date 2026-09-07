import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

interface Props {
  value: number;
  min: number;
  max: number;
  /** Ce qui est écrit en grand au-dessus : « 12 minos », « 45 min ». */
  label: string;
  onChange: (value: number) => void;
}

/**
 * Choisir combien de temps prendre, à la minute près.
 *
 * L'écran proposait trois durées figées — 10, 20, 30 — filtrées par le solde.
 * Avec quinze minutes gagnées, seul « 10 » restait, et les cinq autres étaient
 * indépensables. Même corrigé, le principe restait faux : un solde est un
 * nombre quelconque, et un enfant qui a sept minutes doit pouvoir en prendre
 * sept.
 *
 * **Pourquoi les deux boutons à côté du rail, et pas le rail seul.** Viser une
 * valeur précise en glissant demande une motricité fine que n'a pas un enfant
 * de cinq ans — et son doigt masque justement le chiffre qu'il essaie de lire.
 * On glisse pour approcher, on tape pour tomber juste. Les deux gestes mènent
 * au même endroit, et le plus maladroit des deux suffit.
 *
 * Le rail répond aussi à la **frappe simple** : toucher un point y déplace la
 * pastille. Sans cela, il faudrait attraper précisément une pastille de
 * quarante points pour commencer à bouger.
 *
 * Pour un lecteur d'écran, c'est un `adjustable` : VoiceOver et TalkBack y
 * répondent avec leurs propres gestes d'incrément, sans jamais toucher au rail.
 */
export function TimeSlider({ value, min, max, label, onChange }: Props) {
  const [width, setWidth] = useState(0);
  // Les valeurs vues par le `PanResponder`, créé une seule fois : sans ces
  // références il capturerait la première valeur de `value` pour toujours.
  const etat = useRef({ value, min, max, width, onChange });
  etat.current = { value, min, max, width, onChange };

  const borne = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const depuisX = (x: number) => {
    const { min: bas, max: haut, width: large } = etat.current;
    if (large <= 0) return bas;
    return Math.max(bas, Math.min(haut, Math.round(bas + (x / large) * (haut - bas))));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => etat.current.onChange(depuisX(e.nativeEvent.locationX)),
      onPanResponderMove: (e, g) => {
        const { width: large, min: bas, max: haut, value: actuelle } = etat.current;
        if (large <= 0) return;
        // `dx` depuis le point de départ plutôt qu'une position absolue : la
        // position absolue exigerait de mesurer le rail dans la page, ce qui
        // se décale dès qu'on fait défiler l'écran.
        const pas = (g.dx / large) * (haut - bas);
        etat.current.onChange(Math.max(bas, Math.min(haut, Math.round(actuelle + pas))));
      },
    }),
  ).current;

  const part = max > min ? (value - min) / (max - min) : 1;

  return (
    <View style={styles.bloc}>
      <Text variant="hero" center>
        {label}
      </Text>

      <View style={styles.ligne}>
        <Pressable
          onPress={() => onChange(borne(value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel="Une minute de moins"
          style={({ pressed }) => [styles.pas, pressed && styles.presse, value <= min && styles.eteint]}
          hitSlop={8}
        >
          <Text variant="hero">−</Text>
        </Pressable>

        <View
          style={styles.rail}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Combien de temps"
          accessibilityValue={{ min, max, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            onChange(borne(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))
          }
          {...pan.panHandlers}
        >
          <View style={styles.piste} />
          <View style={[styles.remplie, { width: `${part * 100}%` }]} />
          <View style={[styles.pastille, { left: `${part * 100}%` }]} />
        </View>

        <Pressable
          onPress={() => onChange(borne(value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel="Une minute de plus"
          style={({ pressed }) => [styles.pas, pressed && styles.presse, value >= max && styles.eteint]}
          hitSlop={8}
        >
          <Text variant="hero">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: spacing.md, alignSelf: 'stretch' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 56 points : la taille des touches de l'écran enfant, pas celle d'un
  // bouton d'interface ordinaire.
  pas: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presse: { opacity: 0.7 },
  eteint: { opacity: 0.35 },
  rail: { flex: 1, height: 56, justifyContent: 'center' },
  piste: { height: 12, borderRadius: radii.pill, backgroundColor: colors.surfaceSunken },
  remplie: {
    position: 'absolute',
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
  },
  pastille: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    borderRadius: radii.pill,
    backgroundColor: colors.blue,
    borderWidth: 4,
    borderColor: colors.surface,
  },
});
