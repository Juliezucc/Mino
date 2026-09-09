import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Button, Screen, Text } from '@/components/ui';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, spacing } from '@/theme';

/**
 * Le retour de Stripe, juste après le paiement.
 *
 * **On ne croit pas la redirection.** Stripe y joint un `session_id`, et il
 * serait tentant de s'en servir pour afficher « c'est bon ». Ce serait une
 * faute : cette adresse est dans la barre du navigateur, n'importe qui peut la
 * saisir, et un parent dont la carte a été refusée après coup y arriverait
 * aussi. Ce qui fait foi est le webhook, qui arrive par un autre chemin et que
 * personne ne peut fabriquer — voir `stripe-webhook`.
 *
 * D'où cet écran, qui interroge notre propre serveur plutôt que l'adresse.
 *
 * **Et qui insiste, parce que le webhook n'est pas toujours le plus rapide.**
 * Le navigateur revient parfois avant que Stripe n'ait fini d'appeler ; on
 * relit donc quelques fois avant de conclure. Sans cela, un parent qui vient
 * de payer lirait « en cours d'activation » alors que tout s'est bien passé,
 * et sa première pensée serait de repayer.
 */
const TENTATIVES = 6;
const ATTENTE_MS = 1500;

/**
 * L'abonnement est-il en place ?
 *
 * **Attendre `active` était l'erreur, et elle frappait tout le monde.** La
 * session Stripe est créée avec `trial_period_days` : un premier abonnement
 * naît donc `trialing`, carte enregistrée, rien de débité. Il ne deviendra
 * `active` que trente jours plus tard, au premier prélèvement. Cet écran
 * guettait un état qui n'arrive pas ce jour-là — et tout parent qui venait de
 * s'abonner restait devant « nous confirmons auprès de notre banque », à la
 * seconde même où il fallait le rassurer.
 *
 * Ce qui prouve que le paiement a été pris est ailleurs : `plan`, que seul le
 * webhook écrit, et jamais la redirection.
 */
function enPlace(sub: { status: string; plan: string | null } | null): boolean {
  if (!sub) return false;
  return sub.status === 'active' || (sub.status === 'trialing' && sub.plan !== null);
}

export default function Merci() {
  const router = useRouter();
  const loadBilling = useMinoStore((s) => s.loadBilling);
  const subscription = useMinoStore((s) => s.subscription);
  const [patiente, setPatiente] = useState(true);

  const actif = enPlace(subscription);

  useEffect(() => {
    let vivant = true;

    (async () => {
      for (let essai = 0; essai < TENTATIVES; essai += 1) {
        await loadBilling().catch(() => undefined);
        if (!vivant) return;
        if (enPlace(useMinoStore.getState().subscription)) break;
        await new Promise((suite) => setTimeout(suite, ATTENTE_MS));
      }
      if (vivant) setPatiente(false);
    })();

    return () => {
      vivant = false;
    };
  }, [loadBilling]);

  return (
    <Screen contentStyle={styles.centre}>
      <Mascot expression={actif ? 'delighted' : 'happy'} size={140} />

      <Text variant="hero" center>
        {actif ? 'Merci !' : 'Paiement reçu'}
      </Text>

      <Text variant="body" color={colors.textMuted} center>
        {actif
          ? subscription?.status === 'trialing'
            ? // Ne pas dire « actif » à quelqu'un qui n'a pas encore été
              // débité : il chercherait le prélèvement sur son relevé, ne le
              // trouverait pas, et écrirait au support.
              `Tout est en place. Votre essai continue${
                subscription.trialEndsAt
                  ? ` jusqu’au ${new Date(subscription.trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                  : ''
              }, et rien n’est prélevé avant.`
            : 'Votre abonnement est actif. Toute la famille en profite, sur tous vos appareils.'
          : patiente
            ? 'Nous confirmons votre abonnement auprès de notre banque, quelques secondes…'
            : // Ne jamais laisser croire à un échec : l'argent est parti, et
              // c'est notre affaire de le rattacher, pas la sienne.
              'Votre paiement est bien enregistré. L’activation arrive dans un instant — vous pouvez continuer, elle se fera toute seule.'}
      </Text>

      <Button label="Retour à mon espace" onPress={() => router.replace('/parent')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
});
