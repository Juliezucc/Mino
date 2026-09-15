// Confirmation d'un achat fait dans l'application.
//
// Appelée par le téléphone juste après la feuille de paiement. Elle n'a
// **aucune autorité** : la notification serveur à serveur d'Apple ou de Google
// arrivera de toute façon, et c'est elle qui fait foi. Cette fonction existe
// pour une seule raison — que le parent ne reste pas quelques secondes devant
// un écran qui dit encore « essai » alors qu'il vient de payer.
//
// Ce qui, en revanche, ne se raccourcit pas : la preuve est vérifiée auprès
// d'Apple ou de Google avant d'être écrite. Un jeton envoyé par un téléphone
// est un jeton qu'un téléphone peut inventer.
//
// Déploiement :  supabase functions deploy store-purchase

import { admin, fail, familyOfCaller, json, rowToSubscription, servir } from '../_shared/mino.ts';
import {
  applyStoreState,
  netCents,
  verifyAppleTransaction,
  verifyGooglePurchase,
} from '../_shared/store.ts';
import { DEJA_RATTACHE, STATUTS_AVEC_BENEFICE } from '../../../src/domain/billing.ts';

Deno.serve(servir(async (request) => {

  // La famille vient du jeton d'authentification, jamais du corps de la
  // requête : un client qui peut nommer la famille sur laquelle il agit est un
  // client qui peut agir sur celle d'un autre.
  const caller = await familyOfCaller(request);
  if (!caller) return fail('Non autorisé.', 401);

  let body: {
    platform?: string;
    token?: string;
    productId?: string;
    /** « achat » ou « restauration ». Voir `geste` plus bas. */
    geste?: string;
  };
  try {
    body = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  if (!body.token || (body.platform !== 'apple' && body.platform !== 'google')) {
    return fail('Achat incomplet.', 400);
  }

  /**
   * ---------------------------------------- ne pas promettre ce qu'on ne tient pas
   *
   * « Votre achat sera pris en compte » est vrai d'un ACHAT : la notification
   * serveur à serveur d'Apple ou de Google arrive de toute façon, et elle fait
   * foi. C'est faux d'une RESTAURATION, et le client l'écrit déjà noir sur
   * blanc (`StoreBillingService.restore`) : Apple ne réémet aucune
   * notification pour une transaction ancienne qu'on redemande. Le parent qui
   * touche « Restaurer mes achats » et lit qu'on s'en occupe attendrait donc
   * pour toujours quelque chose qui ne viendra pas.
   *
   * Par défaut « achat » : les versions déjà installées n'envoient pas ce
   * champ, et pour elles la phrase d'origine reste la bonne.
   */
  const restauration = body.geste === 'restauration';
  const PANNE = restauration
    ? 'Vérification impossible pour le moment. Réessayez dans un instant.'
    : 'Vérification impossible pour le moment. Votre achat sera pris en compte.';

  try {
    const state =
      body.platform === 'apple'
        ? await verifyAppleTransaction(body.token)
        : await verifyGooglePurchase(body.token);

    const db = admin();

    /**
     * Écrire l'abonnement et répondre — une fois la propriété tranchée.
     *
     * Sortie en fonction parce qu'il y a désormais deux chemins qui y mènent :
     * le chemin ordinaire, et celui d'un jeton qui désignait déjà l'appelant.
     */
    const enregistrer = async () => {
      await applyStoreState(state, { familyId: caller.familyId });

      /**
       * Un essai qui commence est un événement, pas un silence.
       *
       * Le journal ne s'écrivait que pour un abonnement `active`. Depuis que la
       * carte s'enregistre à l'inscription avec une offre d'introduction, la
       * quasi-totalité des abonnements iPhone naissent en essai — ils
       * disparaissaient donc entièrement des cohortes de conversion, et le
       * tableau de bord aurait affiché zéro abonné là où il y en avait.
       *
       * `essai_commence` est le genre que la vue de conversion attend
       * (`analytics.sql`), et c'est le même que celui écrit par le webhook Stripe
       * pour un abonnement à essai. Les deux rails racontent ainsi la même
       * histoire.
       */
      if (state.status === 'active' || state.status === 'trialing') {
        await db.from('billing_events').upsert(
          {
            family_id: caller.familyId,
            kind: state.status === 'trialing' ? 'essai_commence' : 'abonnement_commence',
            status: state.status,
            plan: state.plan,
            source: state.platform,
            amount_cents: state.amountCents,
            net_cents: netCents(state.amountCents),
            // Préfixé, pour ne pas entrer en collision avec l'identifiant que
            // portera la notification serveur à serveur du même achat.
            stripe_event_id: `store:${state.platform}:${state.transactionId}`,
            occurred_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_event_id', ignoreDuplicates: true },
        );
      }

      const { data: subscription } = await db
        .from('subscriptions')
        .select('*')
        .eq('family_id', caller.familyId)
        .maybeSingle();

      return json({ subscription: subscription ? rowToSubscription(subscription as never) : null });
    };

    /**
     * ------------------------------------ l'achat qui n'a PAS de jeton de compte
     *
     * **Le trou : `state.accountToken &&` gardait tout le contrôle de
     * propriété.** Sans jeton, on ne vérifiait plus rien du tout et l'abonnement
     * s'écrivait sur la famille appelante — deux familles avec le même
     * `store_transaction_id`, et pas un mot à l'écran.
     *
     * Ce n'est pas un cas théorique, et le dépôt le fabrique lui-même : quand
     * le RPC qui rend le jeton de la famille échoue, le client se rabat sur
     * l'identifiant de famille, qui n'est pas un UUID, et n'envoie alors rien
     * du tout à Apple (voir `storeAccountToken` et `ExpoIapStore`). Un achat
     * fait ce jour-là est gravé sans jeton, pour toujours.
     *
     * Reste l'identifiant de la transaction d'origine, qui, lui, est toujours
     * là. Il suffit à répondre à la seule question qui compte : quelqu'un
     * d'autre en bénéficie-t-il aujourd'hui ?
     */
    if (!state.accountToken) {
      const { data: ailleurs } = await db
        .from('subscriptions')
        .select('family_id')
        .eq('store_transaction_id', state.transactionId)
        .in('status', STATUTS_AVEC_BENEFICE)
        .neq('family_id', caller.familyId)
        .limit(1)
        .maybeSingle();

      if (ailleurs) {
        console.error('transaction déjà détenue', caller.familyId, state.transactionId);
        return fail(DEJA_RATTACHE, 403);
      }
    }

    // Le jeton de compte doit désigner cette famille-ci. S'il en désigne une
    // autre, ce n'est pas une erreur de frappe : c'est quelqu'un qui essaie de
    // faire valoir l'achat d'un tiers.
    const { data: family, error: lectureFamille } = await db
      .from('families')
      .select('store_account_token')
      .eq('id', caller.familyId)
      .maybeSingle();

    /**
     * **Une lecture ratée valait « ce n'est pas votre jeton ».**
     *
     * L'erreur partait en silence : `family` retombait à `null`, la condition
     * ci-dessous devenait vraie, et la famille QUI POSSÈDE ce jeton s'entendait
     * répondre d'aller se connecter « avec ce compte » — celui où elle est
     * déjà. Une panne de base de données se présentait au parent comme une
     * accusation, et il n'avait aucun moyen d'en sortir.
     *
     * Une panne est une panne : on le dit, et on ne décide rien.
     */
    if (lectureFamille) {
      console.error('lecture famille', caller.familyId, lectureFamille.message);
      return fail(PANNE, 502);
    }

    /**
     * ------------------------------ l'achat qui porte le jeton d'une autre famille
     *
     * **Ce que le jeton de compte est, et ce qu'il n'est pas.** À l'achat, on
     * transmet à la boutique un identifiant qui désigne la famille. La boutique
     * le grave sur la transaction d'origine et le rend tel quel pour toujours —
     * y compris aux renouvellements, des années plus tard. Il sert à retrouver
     * la famille quand la notification serveur à serveur arrive toute seule.
     *
     * **Le refus sec créait une impasse dont personne ne sortait.** Un parent
     * qui recommence sa famille — la première tentative a échoué, il a supprimé
     * son compte, il réinstalle — garde le même compte Apple, donc le même
     * abonnement, donc la même transaction d'origine. Mais celle-ci porte le
     * jeton de son ANCIENNE famille. Il paie chez Apple, la boutique le lui
     * confirme, et Mino lui répond « cet achat appartient à un autre compte ».
     * Définitivement, sans recours, sur un abonnement qui est le sien.
     *
     * C'est exactement ce qu'ont dit les journaux au premier vrai test :
     * `jeton de compte étranger fam_… 2000001233257291`.
     *
     * **Ce qu'on garde, et c'est l'essentiel.** Le contrôle existe pour une
     * raison qui n'a pas changé : personne ne doit pouvoir faire valoir
     * l'abonnement d'un tiers. On ne le lève donc que lorsqu'il n'y a
     * personne à déposséder — quand aucune famille ne détient réellement cet
     * achat aujourd'hui. Si une famille l'a bel et bien, le refus reste, à la
     * lettre.
     *
     * La preuve, elle, n'est jamais en cause : elle vient d'être vérifiée
     * auprès d'Apple ou de Google. Ce n'est pas elle qu'on assouplit, c'est le
     * registre qu'on cesse de traiter comme un titre de propriété.
     */
    if (state.accountToken && family?.store_account_token !== state.accountToken) {
      const { data: ancienne } = await db
        .from('families')
        .select('id')
        .eq('store_account_token', state.accountToken)
        .maybeSingle();

      /**
       * Personne ne se dépossède soi-même.
       *
       * Si le jeton désigne l'appelant — ce qui ne devrait pas arriver, mais
       * arrive dès que la lecture ci-dessus rend autre chose que la vérité —
       * il n'y a ni tiers à protéger ni adoption à faire. On recale simplement
       * la colonne et on continue.
       */
      if (ancienne?.id === caller.familyId) {
        await db
          .from('families')
          .update({ store_account_token: state.accountToken })
          .eq('id', caller.familyId);
        return await enregistrer();
      }

      /**
       * **Détenir, c'est en bénéficier aujourd'hui — pas l'avoir détenu un
       * jour.** Le filtre ne regardait que `source`, jamais `status`. Une
       * ligne résiliée, ou un essai éteint depuis des mois, verrouillait donc
       * le jeton sur son ancienne famille POUR TOUJOURS.
       *
       * Ce que ça coûtait : le parent qui fait exactement le bon geste —
       * résilier dans les réglages de son téléphone, laisser la période
       * s'achever, puis reprendre — retombait sur le même refus, sans aucune
       * issue, et sans que rien ne lui dise pourquoi. Le refus cessait d'être
       * une protection pour devenir une impasse.
       *
       * Les trois états retenus sont ceux qui donnent un accès réel, les mêmes
       * que `has_active_subscription()` : on ne dépossède jamais une famille
       * qui bénéficie de l'abonnement. Mais on cesse d'en protéger une qui n'en
       * bénéficie plus.
       */
      const { data: detenu } = ancienne
        ? await db
            .from('subscriptions')
            .select('family_id')
            .eq('family_id', ancienne.id)
            .in('source', ['apple', 'google'])
            .in('status', STATUTS_AVEC_BENEFICE)
            .maybeSingle()
        : { data: null };

      if (detenu) {
        console.error('jeton de compte étranger', caller.familyId, state.transactionId);
        /**
         * **« Un autre compte » était faux pour celui qui le lisait, et la
         * sortie qu'on lui indiquait ne menait nulle part.**
         *
         * Le parent comprend « un autre compte Apple » — et il n'en a qu'un.
         * Il cherche donc un second identifiant qui n'existe pas, conclut
         * qu'il s'est trompé, ou que Mino l'accuse de fraude.
         *
         * Pire : la phrase lui disait de résilier. Julie l'avait fait, et
         * s'est vu refuser quand même — parce que résilier, chez Apple, coupe
         * le renouvellement sans rien terminer. La phrase prescrivait le geste
         * qu'elle venait d'accomplir, en promettant un effet immédiat qui
         * n'existe pas.
         *
         * Le texte vit maintenant dans le domaine, avec ses raisons, sa mesure
         * (284 caractères sur 300, au-delà desquels il est JETÉ et non
         * tronqué) et la règle de confidentialité qui lui interdit de nommer
         * la famille détentrice : voir `DEJA_RATTACHE` dans
         * `src/domain/billing.ts`.
         */
        return fail(DEJA_RATTACHE, 403);
      }

      // Personne ne le détient : on l'adopte, et on le dit. Cette ligne est
      // celle qu'on relira le jour où quelqu'un se demandera comment un achat
      // a changé de famille.
      console.warn(
        'achat adopté',
        caller.familyId,
        state.transactionId,
        ancienne?.id ?? 'aucune famille pour ce jeton',
      );

      /**
       * **Reprendre le jeton, sinon l'adoption ne dure qu'un instant.**
       *
       * Adopter écrivait l'abonnement sur la famille appelante et s'arrêtait
       * là — le jeton, lui, restait pointé ailleurs, ou nulle part. Or c'est
       * par lui, et par lui seul, qu'Apple et Google nous retrouvent : le
       * renouvellement du mois suivant, la résiliation, l'échec de paiement
       * arrivaient donc avec un jeton qui ne désignait plus personne, et
       * `applyStoreState` les jetait sous « achat sans famille identifiable ».
       * La famille perdait son accès au premier renouvellement, sans que rien
       * ne l'annonce.
       *
       * Vu en vrai : une famille de test supprimée avait laissé son jeton
       * gravé sur un abonnement bien vivant. Dix-sept notifications d'Apple
       * enregistrées, `family_id` vide sur toutes.
       *
       * L'ancienne famille, si elle existe encore, en reçoit un neuf : la
       * colonne est unique et ne peut pas être vide.
       */
      if (ancienne) {
        await db
          .from('families')
          .update({ store_account_token: crypto.randomUUID() })
          .eq('id', ancienne.id);
      }
      await db
        .from('families')
        .update({ store_account_token: state.accountToken })
        .eq('id', caller.familyId);
    }

    return await enregistrer();

  } catch (error) {
    console.error('vérification achat', error);
    // Après un achat, la notification serveur à serveur rattrapera : ne jamais
    // suggérer de repayer. Après une restauration, elle ne viendra pas — voir
    // `PANNE`, qui ne promet alors rien.
    return fail(PANNE, 502);
  }
}));
