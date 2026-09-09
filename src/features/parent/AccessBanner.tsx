import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { Access, describePlan } from '@/domain/billing';
import { colors, spacing } from '@/theme';

/**
 * L'état de l'abonnement, dit avant qu'il ne gêne.
 *
 * Un verrou qu'on découvre en appuyant sur un bouton est un verrou qui met en
 * colère. Celui-ci s'annonce en haut de l'accueil, à l'endroit où le parent
 * regarde de toute façon, et il dit ce qui est encore vrai — les missions
 * déclarées sont là, rien n'est perdu — avant de dire ce qui manque.
 *
 * Trois derniers jours d'essai : on prévient, sans insister. Prélèvement
 * échoué : on demande, sans couper. Essai fini : on explique, et on donne le
 * bouton. Le reste du temps, rien du tout — un bandeau permanent devient un
 * meuble, et le jour où il compte, personne ne le lit.
 */
interface Props {
  access: Access;
}

export function AccessBanner({ access }: Props) {
  const router = useRouter();

  const content =
    access.kind === 'expired'
      ? {
          tone: colors.yellowSoft,
          title: 'Votre essai est terminé',
          body: 'Les missions que vos enfants déclarent vous attendent — rien n’est perdu. Reprenez l’abonnement pour les confirmer.',
          label: 'Voir les formules',
        }
      : access.kind === 'grace'
        ? {
            tone: colors.yellowSoft,
            title: 'Le dernier paiement n’est pas passé',
            body: 'Tout continue de fonctionner. Mettez à jour votre moyen de paiement quand vous pouvez.',
            label: 'Mettre à jour',
          }
        : // Une famille qui a DÉJÀ choisi sa formule n'a rien à décider : sa
          // carte est enregistrée, le prélèvement est daté, l'accès continue
          // sans rien faire. Lui montrer « encore 3 jours d'essai · voir les
          // formules » l'envoie racheter ce qu'elle a acheté — et sur le web,
          // ce bouton ouvre un second abonnement. On se tait.
          access.kind === 'trial' && access.plan === null && access.daysLeft <= 3
          ? {
              tone: colors.surfaceMuted,
              title:
                access.daysLeft === 1
                  ? 'Dernier jour d’essai'
                  : `Encore ${access.daysLeft} jours d’essai`,
              // Les tarifs viennent du domaine : écrits en dur ici, ils
              // finiraient par ne plus correspondre au prix réellement facturé.
              body: `Ensuite, ${describePlan('monthly')} ou ${describePlan('yearly')} pour toute la famille. Annulation en deux touches.`,
              label: 'Voir les formules',
            }
          : null;

  if (!content) return null;

  return (
    <Card background={content.tone} elevation="none" style={styles.card}>
      <View style={styles.texts}>
        <Text variant="cardTitle">{content.title}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {content.body}
        </Text>
      </View>
      <Button
        label={content.label}
        variant="secondary"
        onPress={() => router.push('/parent/abonnement')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  texts: { gap: spacing.xs },
});
