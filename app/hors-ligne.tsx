import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Screen, Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Mino n'a pas pu joindre son serveur.
 *
 * Cet écran existe pour une raison précise : sans lui, un parent dont le
 * réseau a hoqueté au démarrage retombait sur l'accueil, donc sur « Créer mon
 * compte parent » — l'écran qui annonce, à quelqu'un qui a déjà une famille,
 * que sa famille a disparu. C'est un mensonge, et c'est un mensonge qui fait
 * peur.
 *
 * Le ton compte donc autant que le bouton. Ce n'est la faute de personne, rien
 * n'est perdu, et il n'y a qu'une chose à faire : réessayer.
 */
export default function HorsLigne() {
  const router = useRouter();
  const retry = useMinoStore((s) => s.retry);
  const [essai, setEssai] = useState(false);

  const reessayer = async () => {
    setEssai(true);
    await retry();
    setEssai(false);
    // Si la lecture a réussi, `offline` est retombé et l'aiguillage d'entrée
    // saura où aller. Sinon on reste ici, ce qui est la vérité.
    if (!useMinoStore.getState().offline) router.replace('/');
  };

  return (
    <Screen contentStyle={styles.content}>
      {/* Endormi, pas inquiet : c'est la connexion qui dort, et rien
          n'est cassé. Un Mino alarmé ferait craindre une perte de données. */}
      <Mascot expression="sleepy" size={150} />

      <View style={styles.texts}>
        <Text variant="hero" center>
          Mino n’arrive pas à se connecter
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Vos minutes et vos missions sont bien à l’abri sur le serveur — c’est
          seulement le chemin pour y aller qui manque.
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Vérifiez le Wi-Fi ou les données mobiles, puis réessayez.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Réessayer" icon="↻" onPress={reessayer} loading={essai} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  texts: { gap: spacing.md, alignItems: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.md },
});
