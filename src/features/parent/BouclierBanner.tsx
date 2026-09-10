import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { confirmer } from '@/components/ui/confirmer';
import { getScreenTimeService } from '@/services/screenTime';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * ------------------------------------------- « le blocage n'est pas activé »
 *
 * **Le défaut, et il vidait le produit de sa substance.** Mino se vend sur une
 * seule promesse : les applications restent fermées, et elles s'ouvrent le
 * temps que l'enfant a gagné. Rien dans l'application ne vérifiait que cette
 * promesse était tenue. Un parent pouvait installer Mino, sauter l'écran
 * d'autorisation — c'est un écran qu'on saute, il arrive à la fin d'une
 * inscription — créer ses missions, valider, et voir son enfant lancer son
 * temps d'écran. Tout avait l'air de fonctionner. Rien ne bloquait quoi que ce
 * soit. Le mot exact employé en test sur une vraie tablette : « JE PEUX ACTIVER
 * MON TEMPS ALORS QUE LE BLOCAGE N'EST PAS ACTIVÉ ».
 *
 * **Pourquoi un bandeau, et pas un blocage sec.** Refuser d'ouvrir l'espace
 * parent tant que l'autorisation manque serait un chantage, et il se retourne :
 * le parent qui n'y arrive pas — l'autorisation Android se donne dans deux
 * écrans différents, à trois niveaux de profondeur — n'aurait plus qu'à
 * désinstaller. Le bandeau, lui, dit ce qui manque à l'endroit où le parent
 * regarde déjà, et le suit jusqu'à ce qu'il ait répondu. Il ne s'en va pas tout
 * seul.
 *
 * **Et pourquoi il y a une porte de sortie.** Parce qu'il existe deux familles
 * derrière la même absence d'autorisation, et qu'aucun signal technique ne les
 * distingue : celle qui voulait le blocage et n'a pas fini l'installation, et
 * celle qui se sert de Mino comme d'un décompte convenu, sans rien verrouiller
 * — ce qui est un usage parfaitement légitime, surtout avec un adolescent. Le
 * second bouton est pour la seconde. Il n'est pas là pour se débarrasser du
 * bandeau : il inscrit une décision, qui se retrouve dans la liste des
 * appareils et qui autorise l'enfant à lancer ses séances.
 *
 * Tant que le parent n'a répondu ni l'un ni l'autre, l'enfant ne peut PAS
 * dépenser ses minutes sur cet appareil (voir `DeviceManagedScreenTimeService`).
 * Entre faire attendre un parent et prendre à un enfant le temps qu'il a
 * mérité en échange de rien, le choix est vite fait.
 */
export function BouclierBanner() {
  const router = useRouter();
  const compteurSeul = useMinoStore((s) => s.device.compteurSeul);
  const setCompteurSeul = useMinoStore((s) => s.setCompteurSeul);

  /**
   * Le téléphone du parent, tant qu'aucun enfant ne s'en est servi.
   *
   * L'inscription demande « à qui est cet appareil ? », et la troisième réponse
   * est « c'est mon téléphone à moi » — à quoi Mino répond, mot pour mot :
   * « Rien à bloquer ici. » Lui afficher ensuite « le blocage n'est pas actif,
   * votre enfant ne peut pas lancer son temps d'écran » sur ce même appareil,
   * c'est lui reprocher la réponse qu'on lui a demandée. Un avertissement faux
   * apprend à ignorer les vrais.
   *
   * `lastChildId` referme la porte : dès qu'un profil enfant est ouvert ici une
   * fois, l'appareil cesse d'être personnel et le bandeau revient. Un parent
   * qui prête son téléphone n'a rien à déclarer.
   */
  const personnel = useMinoStore((s) => s.device.usagePersonnel && !s.device.lastChildId);

  /**
   * `undefined` tant qu'on n'a pas demandé : sans cette distinction, le bandeau
   * apparaissait une fraction de seconde à chaque ouverture de l'espace parent,
   * y compris chez les familles dont le bouclier fonctionne — et un avertissement
   * qui clignote sans raison finit par ne plus rien vouloir dire.
   */
  const [etat, setEtat] = useState<string | undefined>(undefined);

  const relire = useCallback(() => {
    getScreenTimeService()
      .authorization()
      .then(setEtat)
      .catch(() => setEtat(undefined));
  }, []);

  useEffect(relire, [relire]);

  /**
   * `unsupported` ne se signale pas, et c'est important : sur le web, et dans
   * une version qui ne porte pas le module natif, il n'y a rien que le parent
   * puisse faire ici. Lui reprocher l'absence d'un verrou qu'aucun bouton ne
   * peut poser serait une impasse. L'écran de blocage, lui, dit quoi faire —
   * installer Mino sur l'appareil de l'enfant.
   */
  if (etat === undefined || etat === 'approved' || etat === 'unsupported') return null;
  if (personnel) return null;

  if (compteurSeul) {
    return (
      <Card background={colors.surfaceMuted} elevation="none" style={styles.carte}>
        <Text variant="bodyStrong">Compteur seul sur cet appareil</Text>
        <Text variant="caption" color={colors.textMuted}>
          Mino compte le temps gagné et le décompte, sans verrouiller
          d’applications — c’est ce que vous avez choisi.
        </Text>
        <Button
          label="Finalement, activer le blocage"
          variant="ghost"
          haptic={false}
          onPress={async () => {
            await setCompteurSeul(false).catch(() => undefined);
            router.push('/parent/blocage');
          }}
        />
      </Card>
    );
  }

  return (
    <Card background={colors.yellowSoft} elevation="none" style={styles.carte}>
      <Text variant="cardTitle">⚠️ Le blocage n’est pas actif</Text>
      <Text variant="body" color={colors.textMuted}>
        Sur cet appareil, Mino compte les minutes mais ne ferme aucune
        application. Votre enfant ne peut pas encore lancer son temps d’écran :
        ce serait dépenser ce qu’il a gagné en échange de rien.
      </Text>
      {/* Le chemin exact, parce qu'Android ne le donne pas : les deux accès
          dont Mino a besoin ne sont pas sur sa fiche, ils sont trois niveaux
          plus loin, et la fiche affiche même « aucune autorisation accordée ». */}
      <Text variant="caption" color={colors.textSubtle}>
        {Platform.OS === 'android'
          ? 'Deux accès à accorder dans les Paramètres d’Android. Nous vous y conduisons, écran par écran.'
          : 'Une autorisation à accorder, en deux touches.'}
      </Text>

      <Button label="Activer le blocage" icon="🔒" onPress={() => router.push('/parent/blocage')} />

      <Button
        label="Non merci, je veux seulement le compteur"
        variant="ghost"
        haptic={false}
        onPress={async () => {
          const ok = await confirmer({
            titre: 'Sans blocage des applications ?',
            message:
              'Mino comptera le temps gagné et le décomptera, mais ne fermera aucune application : c’est à vous que reviendra de faire respecter le temps convenu. Vous pourrez activer le blocage quand vous voudrez.',
            action: 'Oui, le compteur seul',
          });
          if (ok) await setCompteurSeul(true).catch(() => undefined);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  carte: { gap: spacing.sm },
});

export default BouclierBanner;
