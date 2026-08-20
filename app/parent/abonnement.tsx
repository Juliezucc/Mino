import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import {
  ANNUAL_PRICE_EUR,
  MONTHLY_PRICE_EUR,
  Plan,
  TRIAL_DAYS,
  accessOf,
  annualSavingPercent,
  describePlan,
  formatPrice,
} from '@/domain/billing';
import { getBillingService } from '@/services/billing';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

function frenchDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PLANS: { plan: Plan; title: string; detail: string }[] = [
  { plan: 'monthly', title: 'Mensuel', detail: 'Sans engagement, résiliable à tout moment.' },
  {
    plan: 'yearly',
    title: 'Annuel',
    detail: `Soit ${formatPrice(ANNUAL_PRICE_EUR / 12)} par mois.`,
  },
];

/**
 * The subscription screen.
 *
 * Cancelling is a first-class action here, not something buried: French law
 * requires it to be reachable in three clicks, and a family that can leave
 * easily is a family that signs up more readily.
 */
export default function SubscriptionScreen() {
  const router = useRouter();
  const subscription = useMinoStore((s) => s.subscription);
  const choosePlan = useMinoStore((s) => s.choosePlan);
  const cancelSubscription = useMinoStore((s) => s.cancelSubscription);
  const resumeSubscription = useMinoStore((s) => s.resumeSubscription);

  const [selected, setSelected] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billing = getBillingService();
  const access = accessOf(subscription);

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await choosePlan(selected);
      // Selling on the web: the payment happens in the browser, and the
      // subscription only becomes real when the provider says so.
      if (url) await Linking.openURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ouvrir le paiement.');
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert(
      'Résilier l’abonnement ?',
      subscription?.currentPeriodEnd
        ? `Vous gardez l’accès jusqu’au ${frenchDate(subscription.currentPeriodEnd)}. Rien ne sera prélevé ensuite.`
        : 'Vous gardez l’accès jusqu’à la fin de la période en cours. Rien ne sera prélevé ensuite.',
      [
        { text: 'Garder mon abonnement', style: 'cancel' },
        {
          text: 'Résilier',
          style: 'destructive',
          onPress: () => {
            cancelSubscription().catch(() => setError('La résiliation a échoué.'));
          },
        },
      ],
    );
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Abonnement" />

      <Card
        style={styles.status}
        background={access.kind === 'expired' ? colors.surface : colors.mintSoft}
        elevation="none"
      >
        {access.kind === 'trial' ? (
          <>
            <Text variant="section">{`Essai gratuit · ${access.daysLeft} jour${access.daysLeft > 1 ? 's' : ''} restant${access.daysLeft > 1 ? 's' : ''}`}</Text>
            <Text variant="body" color={colors.textMuted}>
              {`Vous avez accès à tout Mino. Rien n’est prélevé avant le ${frenchDate(subscription?.trialEndsAt ?? null)}, et vous pouvez arrêter en quelques secondes d’ici là.`}
            </Text>
          </>
        ) : access.kind === 'active' ? (
          <>
            <Text variant="section">
              {access.cancelAtPeriodEnd ? 'Abonnement résilié' : 'Abonnement actif'}
            </Text>
            <Text variant="body" color={colors.textMuted}>
              {access.cancelAtPeriodEnd
                ? `Vous gardez l’accès jusqu’au ${frenchDate(access.renewsOn)}. Aucun prélèvement ensuite.`
                : `Formule ${subscription?.plan === 'yearly' ? 'annuelle' : 'mensuelle'} · prochain paiement le ${frenchDate(access.renewsOn)}.`}
            </Text>
          </>
        ) : access.kind === 'grace' ? (
          <>
            <Text variant="section">Paiement en attente</Text>
            <Text variant="body" color={colors.textMuted}>
              Le dernier paiement n’a pas abouti. Mettez votre carte à jour pour ne pas perdre
              l’accès.
            </Text>
          </>
        ) : (
          <>
            <Text variant="section">Abonnement terminé</Text>
            <Text variant="body" color={colors.textMuted}>
              Vos données sont conservées. Reprenez quand vous voulez, tout sera là.
            </Text>
          </>
        )}
      </Card>

      {access.kind === 'active' && !access.cancelAtPeriodEnd ? (
        <View style={styles.actions}>
          <Button
            label="Gérer mon moyen de paiement"
            variant="secondary"
            onPress={async () => {
              const { url } = await billing.openPortal(subscription!.familyId);
              if (url) await Linking.openURL(url);
            }}
          />
          <Button label="Résilier mon abonnement" variant="danger" onPress={confirmCancel} />
        </View>
      ) : access.kind === 'active' && access.cancelAtPeriodEnd ? (
        <Button
          label="Reprendre mon abonnement"
          onPress={() => resumeSubscription().catch(() => undefined)}
        />
      ) : (
        <>
          <View style={styles.plans}>
            {PLANS.map((option) => {
              const on = selected === option.plan;
              return (
                <Pressable
                  key={option.plan}
                  onPress={() => setSelected(option.plan)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.title}, ${describePlan(option.plan)}`}
                  accessibilityState={{ selected: on }}
                  style={[styles.plan, on && styles.planOn]}
                >
                  <View style={styles.planHead}>
                    <Text variant="cardTitle">{option.title}</Text>
                    {option.plan === 'yearly' ? (
                      <View style={styles.save}>
                        <Text variant="caption" color={colors.onBrand}>
                          {`-${annualSavingPercent()} %`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="section" color={colors.blue}>
                    {describePlan(option.plan)}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {option.detail}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label={access.kind === 'trial' ? 'CHOISIR CETTE FORMULE' : 'REPRENDRE L’ABONNEMENT'}
            onPress={subscribe}
            loading={loading}
          />
        </>
      )}

      {error ? (
        <Text variant="caption" color={colors.danger} center>
          {error}
        </Text>
      ) : null}

      {billing.capability === 'none' ? (
        <Card background={colors.yellowSoft} elevation="none">
          <Text variant="caption" color={colors.textMuted}>
            Aucun prestataire de paiement n’est configuré sur cette version : rien ne sera prélevé,
            et le passage à l’abonnement est simulé.
          </Text>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Text variant="caption" color={colors.textSubtle}>
          {`Un abonnement couvre toute la famille · essai de ${TRIAL_DAYS} jours · ${formatPrice(MONTHLY_PRICE_EUR)} par mois`}
        </Text>
        <Button
          label="Conditions générales"
          variant="ghost"
          size="small"
          full={false}
          haptic={false}
          onPress={() => router.push('/legal/cgv')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  status: { gap: spacing.sm },
  actions: { gap: spacing.md },
  plans: { gap: spacing.md },
  plan: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  save: {
    backgroundColor: colors.mint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  footer: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md },
});
