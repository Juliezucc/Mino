import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { getNotificationService } from '@/services/notifications';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * ----------------------------------------- « je n'ai jamais reçu de notification »
 *
 * **Le défaut, relevé sur un vrai iPhone.** Aucune notification n'est jamais
 * arrivée. Pas une panne : iOS n'avait jamais posé la question. La permission
 * ne se demandait qu'à un seul endroit de toute l'application — un bouton dans
 * Réglages → Notifications, sous deux écrans et un code parent. Personne ne
 * descend là. Sans permission, pas de jeton ; sans jeton, l'appareil est
 * injoignable pour toujours, et rien ne le signale.
 *
 * **Pourquoi ce n'est pas un détail de confort.** Le fichier qui porte les
 * notifications le dit lui-même : un enfant termine une mission à 19 h, le
 * parent ne l'apprend qu'en rouvrant Mino ; le parent valide à 21 h, l'enfant
 * ne le découvre que le lendemain matin. La boucle du produit — effort,
 * confirmation, récompense — ne tient que si les deux bouts l'entendent. Sans
 * notifications, Mino fonctionne et ne relie plus rien.
 *
 * **Pourquoi ici, et pas au démarrage.** Une demande de permission qui surgit
 * au premier lancement est refusée par réflexe, et iOS ne la repose jamais : un
 * refus est définitif, il faut aller dans les réglages du système pour en
 * revenir. On ne la pose donc qu'une fois, à un parent qui est chez lui, sur
 * son tableau de bord, avec la phrase qui dit à quoi elle sert.
 *
 * **Et pourquoi seulement `undetermined`.** Un parent qui a déjà refusé a
 * répondu ; le harceler ne rouvrirait rien, puisque l'application n'a plus le
 * droit de redemander. Le bouton des réglages reste là pour qui change d'avis.
 */
export function NotificationsBanner() {
  const activerNotifications = useMinoStore((s) => s.activerNotifications);

  /** `undefined` tant qu'on n'a pas demandé : on ne fait pas clignoter un bandeau. */
  const [etat, setEtat] = useState<'granted' | 'denied' | 'undetermined' | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  /** Écarté pour cette session-ci. Voir le bouton « Plus tard ». */
  const [ecarte, setEcarte] = useState(false);

  const relire = useCallback(() => {
    const service = getNotificationService();
    if (!service.available) return setEtat('granted'); // rien à demander ici
    service
      .permission()
      .then(setEtat)
      .catch(() => setEtat(undefined));
  }, []);

  useEffect(relire, [relire]);

  if (etat !== 'undetermined' || ecarte) return null;

  return (
    <Card background={colors.blueSoft} elevation="none" style={styles.carte}>
      <Text variant="cardTitle">🔔 Être prévenu quand votre enfant a terminé</Text>
      <Text variant="body" color={colors.textMuted}>
        Sans cela, vous découvrirez ses missions en rouvrant Mino, et lui
        apprendra ses minutes le lendemain matin. C’est le lien entre l’effort
        et la récompense qui se perd en route.
      </Text>

      <Button
        label="Autoriser les notifications"
        icon="🔔"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await activerNotifications().catch(() => false);
          setBusy(false);
          // On relit plutôt que de croire la réponse : c'est le système qui
          // tranche, et c'est lui qu'on affichera la prochaine fois.
          relire();
        }}
      />

      {/* Une sortie, et sans culpabiliser : un bandeau dont on ne peut pas se
          débarrasser est un bandeau qu'on apprend à ne plus voir. Il reviendra
          au prochain lancement tant que la question n'a pas été posée au
          système — ce qui est le bon comportement, la boucle en dépend. */}
      <Button label="Plus tard" variant="ghost" haptic={false} onPress={() => setEcarte(true)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  carte: { gap: spacing.sm },
});

export default NotificationsBanner;
