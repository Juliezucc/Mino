import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text, confirmer } from '@/components/ui';
import {
  ANNUAL_PRICE_EUR,
  MONTHLY_PRICE_EUR,
  Plan,
  TRIAL_DAYS,
  accessOf,
  annualSavingPercent,
  canCancelInApp,
  describePlan,
  formatPrice,
  isStore,
  sellerOf,
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
  const changePlan = useMinoStore((s) => s.changePlan);
  const resumeSubscription = useMinoStore((s) => s.resumeSubscription);
  const restorePurchases = useMinoStore((s) => s.restorePurchases);
  const loadBilling = useMinoStore((s) => s.loadBilling);

  const [selected, setSelected] = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billing = getBillingService();
  const access = accessOf(subscription);

  /**
   * L'essai engagé : payé, mais pas encore prélevé.
   *
   * C'est l'état normal de toute famille qui vient de s'abonner — la session
   * Stripe est créée avec `trial_period_days`, donc l'abonnement naît
   * `trialing` et rien n'est débité avant la fin des trente jours. Il ne
   * ressemble à rien de ce que cet écran savait afficher : ni « essai
   * gratuit », qui laisse croire que le paiement n'a pas pris, ni
   * « abonnement actif », qui annoncerait un prélèvement qui n'a pas eu lieu.
   *
   * Il se gère en revanche exactement comme un abonnement actif : on résilie,
   * on change de carte. Et il ne se rachète surtout pas.
   */
  const engage = access.kind === 'trial' && access.plan !== null;
  const gerable = access.kind === 'active' || engage;
  /**
   * Offert : tout est ouvert, et il n'y a rien à gérer.
   *
   * Ni formule à choisir — en proposer une ouvrirait un vrai abonnement payant
   * par-dessus un accès gratuit —, ni moyen de paiement, ni résiliation. La
   * carte d'état dit ce qu'il en est, et l'écran s'arrête là.
   */
  const offert = access.kind === 'offert';
  /**
   * Arrêté, et ça se voit — y compris pendant l'essai.
   *
   * `resilie` ne regardait que les abonnements actifs. Un essai engagé qu'on
   * venait d'annuler retombait donc dans la branche « gérable » : l'écran
   * réaffichait « le premier prélèvement aura lieu le … » et proposait de
   * nouveau « Annuler avant le prélèvement », comme si le clic précédent
   * n'avait jamais eu lieu. L'annulation était pourtant bien enregistrée.
   */
  const resilie =
    (access.kind === 'active' || access.kind === 'trial') && access.cancelAtPeriodEnd;

  /**
   * Rafraîchir avant d'afficher un prix.
   *
   * Le cas arrive vraiment : on s'abonne sur le site, puis on ouvre cet écran
   * sur son iPhone avant que l'état ne soit revenu — et on paie une seconde
   * fois, à Apple cette fois. La famille se retrouve avec deux abonnements,
   * dont un qu'elle ne sait pas résilier. Une lecture au montage ferme presque
   * toute la fenêtre, et `has_active_subscription()` ferme le reste côté base.
   */
  useEffect(() => {
    loadBilling().catch(() => undefined);
  }, [loadBilling]);

  /**
   * Un seul bouton, deux rails.
   *
   * Dans l'application, la feuille de paiement du système s'ouvre et se
   * referme sur place — Face ID, et c'est fini. Sur le web, on ouvre le
   * navigateur et rien n'est payé tant qu'on n'est pas allé au bout. L'écran
   * n'a pas à savoir lequel est branché : le service le dit dans sa réponse.
   */
  /**
   * S'abonner pendant l'essai ne coûte pas la même chose selon le rail, et il
   * faut le dire.
   *
   * Sur le web, Stripe reçoit la fin d'essai déjà enregistrée : payer le
   * cinquième jour ou le vingt-neuvième ne change rien, le prélèvement tombe à
   * la même date. Sur une boutique, non — Apple et Google encaissent sur-le-
   * champ, et les jours d'essai restants sont perdus. Leurs offres
   * d'introduction sont des durées fixes, jamais une date : aucune
   * configuration ne peut reproduire « gratuit jusqu'au 9 octobre ».
   *
   * On ne peut donc pas rendre les deux rails identiques. On peut prévenir,
   * et proposer d'attendre — un parent débité de 9,99 € en croyant lui rester
   * trois semaines gratuites demande un remboursement, et il a raison.
   */
  const previentDuneAvance = () => {
    if (billing.capability !== 'store') return Promise.resolve(true);
    if (access.kind !== 'trial' || access.daysLeft <= 0) return Promise.resolve(true);
    const j = access.daysLeft;
    return confirmer({
      titre: `Il vous reste ${j} jour${j > 1 ? 's' : ''} d’essai`,
      message: `L’abonnement démarre aujourd’hui : le premier prélèvement a lieu maintenant, et les jours d’essai restants ne sont pas reportés. Vous pouvez aussi attendre — nous vous préviendrons avant la fin.`,
      action: 'M’abonner maintenant',
      annuler: 'Attendre',
    });
  };

  const subscribe = async () => {
    if (!(await previentDuneAvance())) return;
    setLoading(true);
    setError(null);
    try {
      const outcome = await choosePlan(selected);
      if (outcome.kind === 'url') await Linking.openURL(outcome.url);
      // Refermer la feuille de paiement est un choix, pas une panne : afficher
      // une erreur rouge à quelqu'un qui a simplement hésité est le meilleur
      // moyen qu'il ne revienne pas.
      if (outcome.kind === 'failed') setError(outcome.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’ouvrir le paiement.');
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    setLoading(true);
    setError(null);
    const outcome = await restorePurchases();
    if (outcome.kind === 'failed') setError(outcome.reason);
    setLoading(false);
  };

  /**
   * Ouvrir la gestion de l'abonnement — et dire quand elle n'ouvre rien.
   *
   * **Le défaut que cela répare : un bouton qui ne faisait rien, sans un mot.**
   * Trois écritures différentes appelaient `openPortal` et faisaient toutes
   * `if (url) …` : quand l'adresse revenait vide, ou quand l'appel échouait,
   * il ne se passait rien du tout. Pas d'erreur, pas de message, rien. Un
   * bouton mort est la pire des pannes, parce qu'on appuie encore, puis on
   * conclut que l'application est cassée.
   *
   * Les deux cas où l'adresse est vide sont réels, et ils ne sont pas des
   * bogues : la doublure locale n'a pas de portail, et le portail Stripe
   * n'existe pas tant qu'aucun paiement n'a créé de client — donc pendant
   * tout l'essai. Il faut le dire, pas l'ignorer.
   */
  const ouvrirGestion = async () => {
    setError(null);
    try {
      const { url } = await billing.openPortal(subscription!.familyId);
      if (!url) {
        setError(
          'La gestion de l’abonnement n’est pas disponible : aucun paiement n’a encore été enregistré pour cette famille.',
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError(
        isStore(subscription?.source)
          ? 'Impossible d’ouvrir les réglages. Ouvrez Réglages › votre nom › Abonnements.'
          : 'La gestion de l’abonnement n’a pas pu s’ouvrir. Réessayez dans un instant.',
      );
    }
  };

  /**
   * Résilier, là où la résiliation existe.
   *
   * Un abonnement acheté dans l'application ne s'annule que dans les réglages
   * du téléphone : ni Apple ni Google n'exposent d'API pour le faire. Un
   * bouton « Résilier » qui appellerait notre serveur échouerait en silence,
   * et le parent croirait avoir résilié.
   */
  const confirmCancel = () => {
    if (!canCancelInApp(subscription)) {
      const seller = sellerOf(subscription?.source);
      void confirmer({
        titre: 'Résilier l’abonnement',
        message: `Votre abonnement a été souscrit via ${seller}. La résiliation se fait dans les réglages de votre téléphone, en deux touches — nous vous y emmenons.`,
        action: 'M’y emmener',
        annuler: 'Plus tard',
      }).then((oui) => {
        if (oui) ouvrirGestion();
      });
      return;
    }

    void confirmer({
      titre: engage ? 'Annuler avant le prélèvement ?' : 'Résilier l’abonnement ?',
      // Pendant un essai engagé, « rien ne sera prélevé ensuite » est vrai mais
      // sonne comme un adieu à de l'argent déjà donné. Rien n'a été débité :
      // c'est la première chose à dire, et elle enlève la peur qui fait
      // renoncer à annuler puis se plaindre après le prélèvement.
      message: engage
        ? `Vous n’avez encore rien payé, et vous ne paierez rien. Vous gardez l’accès jusqu’au ${frenchDate(access.kind === 'trial' ? access.firstChargeOn : null)}.`
        : subscription?.currentPeriodEnd
          ? `Vous gardez l’accès jusqu’au ${frenchDate(subscription.currentPeriodEnd)}. Rien ne sera prélevé ensuite.`
          : 'Vous gardez l’accès jusqu’à la fin de la période en cours. Rien ne sera prélevé ensuite.',
      action: engage ? 'Annuler' : 'Résilier',
      annuler: 'Garder mon abonnement',
      destructif: true,
    }).then(async (oui) => {
      if (!oui) return;
      /**
       * Dire ce qui se passe, pendant et après — c'était tout ce qui manquait.
       *
       * L'appel partait sans indicateur, et son échec s'écrivait en petit tout
       * en bas d'une page qu'il faut faire défiler pour atteindre. Vu du
       * fauteuil du parent : on confirme, et il ne se passe rien. Le message
       * est désormais posé sous les boutons, et il porte la raison rendue par
       * le serveur plutôt qu'une phrase passe-partout.
       */
      setLoading(true);
      setError(null);
      try {
        await cancelSubscription();
      } catch (e) {
        setError(
          e instanceof Error
            ? `La résiliation n’a pas abouti : ${e.message}`
            : 'La résiliation n’a pas abouti. Réessayez dans un instant.',
        );
      } finally {
        setLoading(false);
      }
    });
  };

  /**
   * Basculer vers l'autre formule, depuis Mino.
   *
   * On ne passe surtout pas par `subscribe` : celui-là ouvre un paiement, donc
   * un SECOND abonnement par-dessus celui qui court. `changePlan` remplace la
   * formule sur l'abonnement existant.
   *
   * Le prix ne bouge qu'au cycle suivant, et on le dit avant d'agir — un
   * parent qui craint un prélèvement immédiat ne clique pas.
   */
  const formuleActuelle: Plan | null =
    access.kind === 'trial' ? access.plan : access.kind === 'active' ? (subscription?.plan ?? null) : null;
  const autreFormule: Plan = formuleActuelle === 'yearly' ? 'monthly' : 'yearly';

  const basculer = () => {
    const versAnnuel = autreFormule === 'yearly';
    void confirmer({
      titre: versAnnuel ? 'Passer à la formule annuelle ?' : 'Passer à la formule mensuelle ?',
      message: engage
        ? `Rien n’est prélevé aujourd’hui. Le ${frenchDate(access.kind === 'trial' ? access.firstChargeOn : null)}, ce sera ${describePlan(autreFormule)} au lieu de ${describePlan(formuleActuelle ?? 'monthly')}.`
        : `Rien n’est prélevé aujourd’hui. Le nouveau tarif, ${describePlan(autreFormule)}, s’appliquera à votre prochaine échéance${subscription?.currentPeriodEnd ? ` du ${frenchDate(subscription.currentPeriodEnd)}` : ''}.`,
      action: versAnnuel ? 'Passer à l’annuel' : 'Passer au mensuel',
    }).then((oui) => {
      if (!oui) return;
      setLoading(true);
      changePlan(autreFormule)
        .catch(() => setError('Le changement de formule n’a pas abouti.'))
        .finally(() => setLoading(false));
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} title="Abonnement" />

      <Card
        style={styles.status}
        background={access.kind === 'expired' ? colors.surface : colors.mintSoft}
        elevation="none"
      >
        {access.kind === 'offert' ? (
          <>
            <Text variant="section">Accès offert</Text>
            <Text variant="body" color={colors.textMuted}>
              Vous avez accès à tout Mino, sans limite de durée et sans rien à payer. Merci de
              l’essayer avant tout le monde et de nous dire ce qui cloche — c’est ce qui le rend
              meilleur.
            </Text>
          </>
        ) : access.kind === 'trial' && access.cancelAtPeriodEnd ? (
          /* La première chose à dire à quelqu'un qui vient d'annuler : il ne
             sera pas prélevé. Le reste — jusqu'à quand il garde l'accès —
             vient après, et pas l'inverse. */
          <>
            <Text variant="section">Rien ne sera prélevé</Text>
            <Text variant="body" color={colors.textMuted}>
              {`C’est enregistré : votre essai s’arrête le ${frenchDate(access.firstChargeOn)} et aucun paiement ne sera prélevé. Vous gardez tout Mino jusque-là.`}
            </Text>
          </>
        ) : access.kind === 'trial' && access.plan !== null ? (
          <>
            <Text variant="section">Abonnement enregistré</Text>
            <Text variant="body" color={colors.textMuted}>
              {`Formule ${access.plan === 'yearly' ? 'annuelle' : 'mensuelle'}. Votre essai court encore ${access.daysLeft} jour${access.daysLeft > 1 ? 's' : ''} : le premier prélèvement aura lieu le ${frenchDate(access.firstChargeOn)}, et pas avant.`}
            </Text>
          </>
        ) : access.kind === 'trial' ? (
          <>
            <Text variant="section">{`Essai gratuit · ${access.daysLeft} jour${access.daysLeft > 1 ? 's' : ''} restant${access.daysLeft > 1 ? 's' : ''}`}</Text>
            <Text variant="body" color={colors.textMuted}>
              {`Vous avez accès à tout Mino. Rien n’est prélevé avant le ${frenchDate(access.firstChargeOn)}, et vous pouvez arrêter en quelques secondes d’ici là.`}
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

      {/* Sous l'état, au-dessus des boutons : là où regarde celui qui vient
          d'appuyer. Une erreur affichée en bas d'une page qui défile n'est pas
          affichée. */}
      {error ? (
        <Card background={colors.dangerSoft} elevation="none">
          <Text variant="body" color={colors.dangerInk}>
            {error}
          </Text>
        </Card>
      ) : null}

      {/* Offert : aucune action de facturation n'a de sens, et proposer une
          formule ouvrirait un abonnement payant par-dessus un accès gratuit. */}
      {offert ? null : gerable && !resilie ? (
        <View style={styles.actions}>
          {/**
           * Changer de formule sans quitter Mino.
           *
           * Le seul chemin qui existait passait par le portail Stripe : trois
           * écrans, une page en anglais dans certains navigateurs, et un
           * sélecteur « Mensuel | Annuel » qui ne se voit pas — on l'a
           * cherché à deux, on ne l'a pas trouvé. Ce qui se cherche ne se fait
           * pas.
           *
           * Sur une boutique, en revanche, c'est bien là-bas que ça se passe :
           * ni Apple ni Google n'exposent d'API pour ça.
           */}
          {/* `billing.changePlan` et non l'action du magasin : c'est le service
              qui sait si le rail branché sait remplacer une formule. Sur une
              boutique il ne le sait pas, et le bouton ne doit pas exister. */}
          {formuleActuelle && !isStore(subscription?.source) && billing.changePlan ? (
            <Button
              label={autreFormule === 'yearly' ? 'Passer à l’annuel' : 'Passer au mensuel'}
              variant="secondary"
              onPress={basculer}
              disabled={loading}
            />
          ) : null}
          <Button
            label={
              isStore(subscription?.source)
                ? 'Changer de formule'
                : 'Gérer mon moyen de paiement'
            }
            variant="secondary"
            onPress={ouvrirGestion}
          />
          <Button
            label={engage ? 'Annuler avant le prélèvement' : 'Résilier mon abonnement'}
            variant="danger"
            loading={loading}
            onPress={confirmCancel}
          />
        </View>
      ) : resilie ? (
        /**
         * Résilié, mais pas encore fini — et il faut deux portes, pas une.
         *
         * Il n'y avait que « Reprendre mon abonnement », qui reprend la formule
         * qu'on avait. Un parent qui résilie le mensuel **parce qu'il veut
         * l'annuel** se retrouvait donc sans aucun chemin : ni choix de
         * formule, ni accès à la gestion. Le seul bouton lui proposait
         * exactement ce qu'il venait de refuser.
         *
         * Ce n'est pas le sélecteur de formules qu'on ajoute ici, et c'est
         * délibéré : il appelle `startCheckout`, qui ouvrirait un SECOND
         * abonnement par-dessus celui qui court encore — le double
         * prélèvement décrit dans `docs/ops/paiements.md`. Le changement de
         * formule passe donc par là où il est prévu, chez Apple ou dans le
         * portail Stripe, qui sait remplacer au lieu d'ajouter.
         */
        <View style={styles.actions}>
          <Button
            label="Reprendre mon abonnement"
            onPress={() => resumeSubscription().catch(() => undefined)}
          />
          <Button
            label={
              isStore(subscription?.source)
                ? 'Changer de formule'
                : 'Changer de formule ou de moyen de paiement'
            }
            variant="secondary"
            onPress={ouvrirGestion}
          />
        </View>
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
                  <Text variant="section" color={colors.blueInk}>
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

          {/* Obligatoire dès qu'on vend par une boutique : quelqu'un qui change
              de téléphone doit retrouver son abonnement sans repayer, et Apple
              refuse à la revue les applications qui n'offrent pas ce bouton. */}
          {billing.capability === 'store' ? (
            <Button label="Restaurer mes achats" variant="ghost" onPress={restore} />
          ) : null}
        </>
      )}

      {billing.capability === 'none' ? (
        <Card background={colors.yellowSoft} elevation="none">
          <Text variant="caption" color={colors.textMuted}>
            Aucun prestataire de paiement n’est configuré sur cette version : rien ne sera prélevé,
            et le passage à l’abonnement est simulé.
          </Text>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Text variant="caption" color={colors.textSubtle} center>
          {`Un abonnement couvre toute la famille · essai de ${TRIAL_DAYS} jours · ${formatPrice(MONTHLY_PRICE_EUR)} par mois`}
        </Text>
        {/* Apple exige que la durée, le prix et le renouvellement soient dits
            sur l'écran d'achat lui-même — pas seulement dans les conditions.
            C'est aussi ce qui évite le prélèvement surprise, première cause
            d'avis à une étoile. */}
        {billing.capability === 'store' ? (
          <Text variant="caption" color={colors.textSubtle} center>
            {`Abonnement reconduit automatiquement, sauf résiliation au moins 24 h avant la fin de la période. Vendu par ${sellerOf(subscription?.source ?? (Platform.OS === 'ios' ? 'apple' : 'google'))}, et résiliable dans les réglages de votre téléphone.`}
          </Text>
        ) : null}
        {/* Les DEUX liens, sur l'écran d'achat lui-même.
            Apple demande, au même endroit que le prix : la durée, le montant,
            la reconduction, les conditions d'utilisation ET la politique de
            confidentialité. Il n'y avait que les conditions, et c'est ce qui a
            valu à la 1.0 un refus au motif 3.1.2. Les avoir « quelque part
            dans les réglages » ne compte pas : la règle vise l'écran où le
            parent engage son argent. */}
        <View style={styles.legal}>
          <Button
            label="Conditions générales"
            variant="ghost"
            size="small"
            full={false}
            haptic={false}
            onPress={() => router.push('/legal/cgv')}
          />
          <Button
            label="Confidentialité"
            variant="ghost"
            size="small"
            full={false}
            haptic={false}
            onPress={() => router.push('/legal/confidentialite')}
          />
        </View>
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
  legal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
