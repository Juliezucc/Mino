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
 * Ce qu'affiche la carte, formule par formule.
 *
 * Les deux entrées ont la même forme parce que la carte est la même : elle
 * montre la formule choisie, quelle qu'elle soit. Rien n'y est écrit à la
 * main — le jour où un tarif bouge, un nombre en dur cesse silencieusement de
 * correspondre à ce qui est facturé.
 */
const OFFRE: Record<Plan, { etiquette: string; grand: string; petit: string; badge: string | null }> =
  {
    yearly: {
      etiquette: 'ANNUEL',
      grand: `${formatPrice(ANNUAL_PRICE_EUR / 12)} / mois`,
      // Le montant réellement débité, juste sous le prix d'appel. C'est la
      // limite à ne pas franchir : Apple le vérifie, la loi française l'impose.
      // Le mettre en petit est permis ; le retirer, non.
      petit: `soit ${formatPrice(ANNUAL_PRICE_EUR)} par an`,
      badge: `-${annualSavingPercent()} %`,
    },
    monthly: {
      etiquette: 'MENSUEL',
      grand: `${formatPrice(MONTHLY_PRICE_EUR)} / mois`,
      petit: 'facturé chaque mois, sans engagement',
      badge: null,
    },
  };

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
       * La carte montre la formule CHOISIE, et le lien celle qu'on peut
       * prendre à la place.
       *
       * **Ce que la version précédente affichait.** La carte était l'annuel,
       * toujours, et choisir le mensuel ne faisait que déplacer un cadre bleu :
       * le plus gros chiffre de l'écran restait 6,67 € / mois — c'est-à-dire un
       * prix que la personne venait précisément de ne pas choisir. Elle
       * s'engageait à 9,99 € en regardant 6,67 €. C'est le genre d'écart qu'un
       * vérificateur d'Apple relève au motif 3.1.2, mais c'est d'abord un
       * parent qui découvre le vrai montant sur son relevé bancaire.
       *
       * Il n'y a donc qu'un seul prix à l'écran à la fois, et c'est le sien.
       */}
      <View
        style={[styles.offre, styles.offreOn]}
        accessibilityRole="summary"
        accessibilityLabel={`Formule choisie : ${OFFRE[selected].etiquette.toLowerCase()}, ${OFFRE[selected].grand}, ${OFFRE[selected].petit}`}
      >
        <View style={styles.ligne}>
          <Text variant="label" color={colors.textMuted}>
            {OFFRE[selected].etiquette}
          </Text>
          {OFFRE[selected].badge ? (
            <View style={styles.remise}>
              <Text variant="caption" color={colors.onBrand}>
                {OFFRE[selected].badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="hero" color={colors.blueInk}>
          {OFFRE[selected].grand}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {OFFRE[selected].petit}
        </Text>
      </View>

      {/**
       * L'autre formule, en un mot et une touche.
       *
       * `button` et non `radio` : il ne reste qu'une option à l'écran, et ce
       * qu'on annonce à un lecteur d'écran est l'action qu'il déclenche. Son
       * intitulé porte le prix en entier, faute de quoi la seconde formule
       * n'existerait que pour ceux qui voient l'écran.
       */}
      <Pressable
        onPress={() => setSelected(selected === 'yearly' ? 'monthly' : 'yearly')}
        accessibilityRole="button"
        accessibilityLabel={
          selected === 'yearly'
            ? `Prendre la formule mensuelle à ${formatPrice(MONTHLY_PRICE_EUR)} par mois`
            : `Prendre la formule annuelle à ${formatPrice(ANNUAL_PRICE_EUR / 12)} par mois, facturée ${formatPrice(ANNUAL_PRICE_EUR)} par an`
        }
        style={styles.autre}
        hitSlop={8}
      >
        <Text variant="body" color={colors.blueInk} center>
          {selected === 'yearly'
            ? `Ou ${formatPrice(MONTHLY_PRICE_EUR)} par mois`
            : `Ou ${formatPrice(ANNUAL_PRICE_EUR / 12)} par mois en payant à l’année (-${annualSavingPercent()} %)`}
        </Text>
      </Pressable>

      <Button
        label={`Commencer mes ${TRIAL_DAYS} jours`}
        onPress={souscrire}
        loading={loading}
        disabled={loading}
      />

      <Card background={colors.surfaceMuted} elevation="none" style={styles.rassure}>
        {/* Le prix de la formule choisie, et lui seul. Énumérer les deux
            tarifs dans le même paragraphe obligeait le parent à retrouver
            lequel le concerne — juste au moment où on lui demande sa carte. */}
        <Text variant="caption" color={colors.textMuted}>
          {`Rien n’est prélevé aujourd’hui.${finEssai ? ` Le ${frenchDate(finEssai)},` : ' À la fin de l’essai,'} votre abonnement démarrera à ${
            selected === 'yearly'
              ? `${formatPrice(ANNUAL_PRICE_EUR)} par an`
              : `${formatPrice(MONTHLY_PRICE_EUR)} par mois`
          } et se renouvellera automatiquement. Il s’annule en deux touches, à tout moment. Un abonnement couvre toute la famille, sur tous vos appareils.`}
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
  autre: { paddingVertical: spacing.sm },
  rassure: { padding: spacing.md },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: Platform.OS === 'web' ? spacing.xl : 0,
  },
});
