import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import {
  ANNUAL_PRICE_EUR,
  MONTHLY_PRICE_EUR,
  Plan,
  TRIAL_DAYS,
  accessOf,
  annualSavingPercent,
  formatPrice,
} from '@/domain/billing';
import { getBillingService } from '@/services/billing';
import { useMinoStore } from '@/store/useMinoStore';
import { colors, radii, spacing } from '@/theme';

function frenchDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Le moment où l'on demande la carte, et pourquoi c'est ici.
 *
 * **Le modèle d'avant.** L'essai était accordé sans carte et se terminait sur
 * un mur : au trentième jour, le parent devait revenir de son plein gré,
 * ressortir sa carte et payer. C'est le schéma qui convertit le moins bien qui
 * soit — il demande un acte volontaire à quelqu'un dont l'attention est
 * repartie ailleurs depuis longtemps.
 *
 * **Le modèle d'ici.** La carte est enregistrée maintenant, rien n'est débité,
 * et le prélèvement se fait tout seul au trentième jour si le parent n'a rien
 * fait. Ce n'est pas un piège tant que le prix, la durée et le renouvellement
 * sont écrits sur cet écran — ils le sont, c'est ce qu'Apple vérifie au motif
 * 3.1.2, et c'est ce que la loi française impose.
 *
 * **Sa place dans le parcours n'est pas négociable.** Il arrive après le
 * premier enfant, la première mission et le compte : le parent a vu sa famille
 * exister avant qu'on lui parle d'argent. Au premier écran, ce serait un
 * péage ; ici, c'est une décision informée. La valeur de Mino dépend en plus
 * de l'adhésion d'un enfant — on ne peut pas demander cette confiance-là avant
 * d'avoir rien montré.
 *
 * **Personne ne le contourne, sauf ceux qui ont déjà l'accès.** C'est ce qui
 * laisse passer le compte de démonstration d'Apple — un mur infranchissable
 * bloque aussi le vérificateur, et c'est un motif de rejet classique — et
 * c'est aussi juste en général : un parent qui s'est abonné sur le site ne
 * doit pas revoir un écran de paiement en installant l'application.
 */
export default function OnboardingAbonnement() {
  const router = useRouter();
  const subscription = useMinoStore((s) => s.subscription);
  const choosePlan = useMinoStore((s) => s.choosePlan);
  const restorePurchases = useMinoStore((s) => s.restorePurchases);
  const loadBilling = useMinoStore((s) => s.loadBilling);

  const [selected, setSelected] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const billing = getBillingService();
  const access = accessOf(subscription);

  /**
   * On ne s'efface que sur une certitude.
   *
   * `accessOf(null)` vaut « expiré », et cette valeur-là avait un effet
   * désastreux ici : un abonnement pas encore chargé faisait conclure que la
   * famille était déjà servie, et le paywall se sautait lui-même. Le parent
   * traversait l'inscription sans jamais voir l'écran de paiement, et
   * atterrissait sur un accueil qui lui annonçait la fin d'un essai qui venait
   * de commencer.
   *
   * `subscription !== null` d'abord : tant qu'on ne sait pas, on reste. C'est
   * la même règle que `src/domain/access.ts` applique au verrou — un fait
   * connu, jamais une ignorance — sauf qu'ici elle penche dans l'autre sens,
   * et c'est cohérent : dans le doute on montre le prix, on ne l'offre pas.
   */
  const dejaServi =
    subscription !== null && (access.kind !== 'trial' || access.plan !== null);

  useEffect(() => {
    loadBilling().catch(() => undefined);
  }, [loadBilling]);

  /**
   * Ceux qui ont déjà l'accès ne voient jamais cet écran.
   *
   * `replace` et non `push` : revenir en arrière sur un paywall qu'on n'avait
   * pas à voir ne mène nulle part.
   */
  useEffect(() => {
    if (dejaServi) router.replace('/onboarding/appareil');
  }, [dejaServi, router]);

  const souscrire = async () => {
    setLoading(true);
    setErreur(null);
    try {
      const outcome = await choosePlan(selected);
      // Sur le web, rien n'est payé tant que le navigateur n'est pas allé au
      // bout : Stripe ramènera le parent par `/abonnement/merci`.
      if (outcome.kind === 'url') return void Linking.openURL(outcome.url);
      // Refermer la feuille de paiement est un choix, pas une panne. Afficher
      // une erreur rouge à quelqu'un qui a simplement hésité est le meilleur
      // moyen qu'il ne revienne pas.
      if (outcome.kind === 'failed') return setErreur(outcome.reason);
      if (outcome.kind === 'done') router.replace('/onboarding/appareil');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible d’ouvrir le paiement.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obligatoire chez Apple dès qu'on vend un abonnement, et pas seulement pour
   * la revue : un parent qui change de téléphone doit retrouver le sien sans
   * repayer. Absent sur le web, où l'abonnement suit le compte et non
   * l'appareil.
   */
  const restaurer = async () => {
    setLoading(true);
    setErreur(null);
    const outcome = await restorePurchases();
    if (outcome.kind === 'failed') setErreur(outcome.reason);
    setLoading(false);
  };

  const finEssai = subscription?.trialEndsAt ?? null;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.entete}>
        <Text variant="hero" center>
          0 € aujourd’hui
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {`Vous avez ${TRIAL_DAYS} jours pour voir si Mino marche chez vous.${
            finEssai ? ` Le premier prélèvement aura lieu le ${frenchDate(finEssai)}.` : ''
          }`}
        </Text>
      </View>

      {/**
       * L'annuel présélectionné, annoncé par son prix mensuel.
       *
       * `formatPrice(ANNUAL_PRICE_EUR / 12)` et jamais un nombre écrit à la
       * main : le jour où le tarif bouge, un prix en dur cesse silencieusement
       * de correspondre à ce qui est facturé.
       *
       * Le montant réellement débité reste lisible juste en dessous. C'est la
       * limite à ne pas franchir — Apple le vérifie, et la loi française
       * l'impose. Le mettre en petit est permis ; le retirer, non.
       */}
      <Pressable
        onPress={() => setSelected('yearly')}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected === 'yearly' }}
        accessibilityLabel={`Formule annuelle, ${formatPrice(ANNUAL_PRICE_EUR / 12)} par mois, facturée ${formatPrice(ANNUAL_PRICE_EUR)} par an`}
        style={[styles.offre, selected === 'yearly' && styles.offreOn]}
      >
        <View style={styles.ligne}>
          <Text variant="label" color={colors.textMuted}>
            ANNUEL
          </Text>
          <View style={styles.remise}>
            <Text variant="caption" color={colors.onBrand}>
              {`-${annualSavingPercent()} %`}
            </Text>
          </View>
        </View>
        <Text variant="hero" color={colors.blueInk}>
          {`${formatPrice(ANNUAL_PRICE_EUR / 12)} / mois`}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {`soit ${formatPrice(ANNUAL_PRICE_EUR)} par an`}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setSelected('monthly')}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected === 'monthly' }}
        accessibilityLabel={`Formule mensuelle, ${formatPrice(MONTHLY_PRICE_EUR)} par mois`}
        style={styles.mensuel}
        hitSlop={8}
      >
        <Text
          variant={selected === 'monthly' ? 'bodyStrong' : 'body'}
          color={selected === 'monthly' ? colors.blueInk : colors.textMuted}
          center
        >
          {`Ou ${formatPrice(MONTHLY_PRICE_EUR)} par mois`}
        </Text>
      </Pressable>

      <Button
        label={`Commencer mes ${TRIAL_DAYS} jours`}
        onPress={souscrire}
        loading={loading}
        disabled={loading}
      />

      <Card background={colors.surfaceMuted} elevation="none" style={styles.rassure}>
        <Text variant="caption" color={colors.textMuted}>
          {`Rien n’est prélevé aujourd’hui. L’abonnement se renouvelle ensuite automatiquement — ${formatPrice(ANNUAL_PRICE_EUR)} par an ou ${formatPrice(MONTHLY_PRICE_EUR)} par mois — et s’annule en deux touches, à tout moment. Un abonnement couvre toute la famille, sur tous vos appareils.`}
        </Text>
      </Card>

      {erreur ? (
        <Text variant="caption" color={colors.dangerInk} center>
          {erreur}
        </Text>
      ) : null}

      {billing.restore ? (
        <Button
          label="Restaurer mes achats"
          variant="ghost"
          onPress={restaurer}
          disabled={loading}
        />
      ) : null}

      {/**
       * Créditer l'ami, sans rien promettre à celui qui saisit.
       *
       * Le filleul ne gagne rien — trente jours pour tout le monde. Le laisser
       * croire le contraire se paierait au premier avis. Ce qu'on lui propose
       * est exactement ce qu'il fait : rendre service à la personne qui l'a
       * invité.
       */}
      <Pressable onPress={() => router.push('/parent/parrainage')} hitSlop={8}>
        <Text variant="caption" color={colors.textMuted} center>
          Un ami vous a invité ? Signalez-le, il gagnera un mois.
        </Text>
      </Pressable>

      <View style={styles.legal}>
        <Text variant="caption" color={colors.blueInk} onPress={() => router.push('/legal/cgv')}>
          Conditions générales
        </Text>
        <Text
          variant="caption"
          color={colors.blueInk}
          onPress={() => router.push('/legal/confidentialite')}
        >
          Confidentialité
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl },
  entete: { gap: spacing.sm },
  offre: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  offreOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remise: {
    backgroundColor: colors.mint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mensuel: { paddingVertical: spacing.sm },
  rassure: { padding: spacing.md },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: Platform.OS === 'web' ? spacing.xl : 0,
  },
});
