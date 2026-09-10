import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { getAuthService } from '@/services/auth';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * ------------------------------------- « on ne m'a jamais demandé de code parent »
 *
 * **Le défaut, relevé sur un vrai iPhone.** L'inscription ne réclame de code à
 * quatre chiffres que dans un cas : un parent DÉJÀ connecté qui rejoint une
 * famille existante. Celui qui vient de fonder la sienne n'en pose aucun — et
 * rien, nulle part, ne le lui signale ensuite.
 *
 * Sans code, l'espace parent n'est protégé par rien du tout. Le verrou existe
 * bien, mais il ne se ferme sur aucune clé : n'importe qui tenant l'appareil
 * peut en choisir une et entrer. Sur la tablette du salon, ce n'importe qui est
 * l'enfant, et l'espace parent contient le compteur de minutes, la confirmation
 * des missions et le réglage du blocage.
 *
 * **Ce que ce bandeau rattrape exactement.** L'inscription pose maintenant le
 * code au moment où le parent déclare l'appareil partagé ou celui de son
 * enfant — voir `app/onboarding/appareil.tsx`. Restent trois populations que
 * cela ne couvre pas :
 *
 *   — les familles créées avant cette correction ;
 *   — celles venues du tunnel de `minoapp.fr`, qui ne traversent jamais notre
 *     inscription ;
 *   — celles inscrites depuis `app.minoapp.fr`, où la question de l'appareil
 *     n'est même pas posée : dans un navigateur, Mino ne bloque rien, et cet
 *     écran cède la place à « installez Mino sur l'appareil de votre enfant ».
 *
 * Toutes ont un point commun : le seul écran qui sait poser un code est celui
 * du code lui-même, et il n'est atteignable qu'en essayant d'entrer là où l'on
 * est déjà. Le tableau de bord est le seul endroit où l'on est certain que
 * c'est bien le parent qui regarde.
 *
 * **Pas de « Plus tard » ici**, et c'est la différence avec le bandeau des
 * notifications. Une permission refusée est une décision qu'on respecte ; un
 * espace parent sans serrure n'est pas une préférence, c'est un défaut. Le
 * bandeau reste tant que le code n'est pas posé — et disparaît pour toujours
 * dès qu'il l'est.
 */
export function CodeParentBanner() {
  const router = useRouter();

  /** `null` tant qu'on interroge : on ne fait pas clignoter un bandeau. */
  const [pose, setPose] = useState<boolean | null>(null);

  const relire = useCallback(() => {
    getAuthService()
      .hasParentPin()
      .then(setPose)
      // Dans le doute, on suppose qu'il existe : se tromper dans ce sens
      // n'affiche rien, se tromper dans l'autre reproche à un parent un défaut
      // qu'il n'a pas.
      .catch(() => setPose(true));
  }, []);

  useEffect(relire, [relire]);

  /**
   * Le téléphone du parent, où il n'y a personne à tenir dehors.
   *
   * Même condition que le bandeau du bouclier, et pour la même raison : « c'est
   * mon téléphone à moi » est une réponse, pas une omission. Reprocher à ce
   * parent-là une serrure absente serait un avertissement faux, et un
   * avertissement faux apprend à ignorer les vrais.
   *
   * `lastChildId` referme la porte : dès qu'un profil enfant s'ouvre ici une
   * fois, l'appareil cesse d'être personnel et le bandeau revient. Un parent
   * qui prête son téléphone n'a rien à déclarer.
   */
  const personnel = useMinoStore((s) => s.device.usagePersonnel && !s.device.lastChildId);
  const autoriserLaPoseDuCode = useMinoStore((s) => s.autoriserLaPoseDuCode);

  if (pose !== false || personnel) return null;

  return (
    <Card background={colors.blueSoft} elevation="none" style={styles.carte}>
      <Text variant="cardTitle">🔒 Protéger votre espace parent</Text>
      <Text variant="body" color={colors.textMuted}>
        Aucun code n’est encore défini. Tant qu’il n’y en a pas, votre enfant
        peut ouvrir cet espace — et donc s’accorder des minutes, confirmer ses
        propres missions ou retirer le blocage.
      </Text>

      <Button
        label="Choisir mon code"
        icon="🔒"
        onPress={() => {
          // Ce bandeau ne s'affiche que dans l'espace parent, donc devant le
          // parent. Sans ce signal, son bouton menait à « Réservé aux
          // parents » dès que l'appareil est déclaré partagé — c'est-à-dire
          // précisément dans le cas où le bandeau existe.
          autoriserLaPoseDuCode();
          router.push({ pathname: '/parent-pin', params: { ensuite: '/parent' } });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  carte: { gap: spacing.sm },
});

export default CodeParentBanner;
