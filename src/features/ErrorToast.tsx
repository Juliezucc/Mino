import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

/**
 * Ce qui n'a pas pu être enregistré, dit une fois, en haut.
 *
 * `lastError` existait déjà dans le store et n'était affiché nulle part : une
 * écriture refusée par le serveur était annulée proprement — le compteur ne
 * bougeait pas — mais personne ne savait pourquoi son geste n'avait rien fait.
 * Un bouton qui ne répond pas et ne s'explique pas, c'est un bouton cassé, du
 * point de vue de celui qui appuie.
 *
 * Monté une seule fois, au-dessus de la navigation : la même vérité sur tous
 * les écrans, et rien à ajouter dans les trente autres fichiers.
 *
 * Ce qu'il dit importe autant que le fait qu'il apparaisse. Le message du
 * store ne dit pas « erreur réseau » — il dit **rien n'a été enregistré**,
 * parce que c'est la seule chose que la personne devant l'écran a besoin de
 * savoir, qu'elle ait huit ans ou quarante.
 *
 * Il disparaît seul : la première écriture réussie remet `lastError` à null
 * (`commit()`), et on peut aussi le chasser d'une pression — un message
 * d'erreur qui reste après coup devient un meuble.
 */
export function ErrorToast() {
  const lastError = useMinoStore((s) => s.lastError);
  const clear = useMinoStore((s) => s.clearError);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const glisse = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.timing(glisse, {
      toValue: lastError ? 0 : -1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [lastError, glisse]);

  // Rien à monter tant que rien n'a échoué : le bandeau ne coûte alors ni un
  // rendu ni une zone tactile au-dessus des écrans enfants.
  if (!lastError) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + spacing.xs,
          transform: [{ translateY: glisse.interpolate({ inputRange: [-1, 0], outputRange: [-140, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={clear}
        accessibilityRole="alert"
        accessibilityLabel={`${lastError}. Appuyez pour fermer.`}
        style={[styles.card, { maxWidth: Math.min(width - spacing.lg * 2, 560) }]}
      >
        <Text variant="bodyStrong" color={colors.onBrand}>
          {lastError}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  card: {
    width: '100%',
    backgroundColor: colors.yellow,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    // Une ombre franche : le bandeau flotte au-dessus du contenu, et sans elle
    // il se lit comme un bloc de l'écran plutôt que comme quelque chose
    // d'arrivé à l'instant.
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
