import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { choixEnregistre } from '@/data/deviceProfile';
import { getScreenTimeService } from '@/services/screenTime';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Côté enfant : dire que le verrou n'est pas posé, et offrir la porte.
 *
 * **Pourquoi cet écran-ci, alors que le bandeau du parent existe déjà.** Parce
 * qu'ils ne sont pas sur le même appareil. Le verrou se pose sur la tablette de
 * l'enfant, et c'est le seul endroit où l'autorisation du système peut être
 * accordée — mais c'est aussi l'appareil que le parent ne regarde jamais. Le
 * bandeau de son tableau de bord lui parle donc d'un réglage qu'il ne peut pas
 * faire d'où il est.
 *
 * **Ce que l'enfant en comprend, et ce qu'il n'a pas à comprendre.** Il constate
 * déjà quelque chose : son temps ne se lance pas. On le lui dit dans ses mots,
 * sans lui expliquer ce qu'est un bouclier, ni ce qu'il protège. La suite n'est
 * pas pour lui — le bouton mène au code parent, et sans les quatre chiffres il
 * n'ouvre rien.
 *
 * **Et il se tait quand il aurait tort.** Sur le téléphone d'un parent il n'y a
 * rien à verrouiller ; quand le parent a choisi le compteur seul, le réglage
 * est fait et c'est son choix. Un avertissement qui se trompe apprend à ignorer
 * les vrais.
 */
export function BlocageAReglerBanner() {
  const router = useRouter();
  const compteurSeul = useMinoStore((s) => s.device.compteurSeul);
  const choix = choixEnregistre(useMinoStore((s) => s.device));
  const autoriserLaPoseDuCode = useMinoStore((s) => s.autoriserLaPoseDuCode);

  const [etat, setEtat] = useState<string | undefined>(undefined);

  const relire = useCallback(() => {
    getScreenTimeService()
      .authorization()
      .then(setEtat)
      .catch(() => setEtat(undefined));
  }, []);

  useEffect(relire, [relire]);

  // `unsupported` : ni le web ni une version sans module natif n'ont de verrou à
  // poser. Reprocher l'absence d'une chose qu'aucun bouton ne peut faire est
  // une impasse, pas un avertissement.
  if (etat === undefined || etat === 'approved' || etat === 'unsupported') return null;
  if (compteurSeul || choix.kind === 'parent') return null;

  return (
    <Card background={colors.yellowSoft} elevation="none" style={styles.carte}>
      <Text variant="cardTitle">⏳ Ton temps ne peut pas encore démarrer</Text>
      <Text variant="body" color={colors.textMuted}>
        Il manque un réglage sur cet appareil. Tes missions marchent déjà : tu peux les faire et
        gagner du temps, il t’attendra.
      </Text>
      <Button
        label="Un parent est là ?"
        icon="🔒"
        variant="secondary"
        onPress={() => {
          // Le parent est devant l'écran, et c'est lui qui touche : c'est le
          // geste qui autorise à poser le code s'il n'y en a pas encore. Sans
          // les quatre chiffres, ce bouton n'ouvre rien.
          autoriserLaPoseDuCode();
          router.push({ pathname: '/parent-pin', params: { ensuite: '/parent/blocage' } });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  carte: { gap: spacing.sm },
});
