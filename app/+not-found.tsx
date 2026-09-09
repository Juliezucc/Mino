import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/**
 * Une adresse qui n'existe pas.
 *
 * Sur un téléphone, ce cas n'arrive presque jamais : il n'y a pas de barre
 * d'adresse. Sur le web, il arrive tout le temps — un lien vieilli, une URL
 * recopiée à la main, une redirection composée à partir d'une variable
 * d'environnement qui pointe à côté.
 *
 * Sans cet écran, expo-router affiche le sien : un message technique, en
 * anglais, qui parle de route non appariée. C'est acceptable pour un
 * développeur et déroutant pour un parent — surtout s'il vient de payer.
 *
 * On ne s'excuse pas longuement et on ne demande rien : un mot, la mascotte,
 * et le chemin du retour.
 */
export default function Introuvable() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.centre}>
      <Mascot expression="surprised" size={140} />
      <Text variant="hero" center>
        Cette page n’existe pas
      </Text>
      <Text variant="body" color={colors.textMuted} center>
        Le lien est peut-être ancien, ou mal recopié. Rien n’est perdu.
      </Text>
      <Button label="Revenir à l’accueil" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
});
