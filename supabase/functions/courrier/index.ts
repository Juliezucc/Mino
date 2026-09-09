// Les e-mails que Mino envoie lui-même.
//
// Supabase n'en envoie que trois — confirmation, réinitialisation, changement
// d'adresse — et ce sont les seuls qu'il sache faire. Tout le reste du cycle de
// vie décrit dans `docs/marketing/cycle-de-vie.md` n'avait aucun tuyau : ni la
// bienvenue, ni le rappel avant le premier prélèvement, ni l'information avant
// la reconduction annuelle.
//
// Ce dernier n'est pas une politesse. L'article L215-1 du code de la
// consommation impose d'informer le consommateur de sa faculté de
// non-reconduction, entre trois mois et un mois avant l'échéance ; la formule
// annuelle de Mino y est soumise. Et le rappel avant le premier prélèvement
// comble un écart entre les rails : Apple en envoie un pour ses offres
// d'introduction, Stripe n'en envoie aucun — sans lui, un abonné web serait
// moins bien traité qu'un abonné iPhone sur le même produit.
//
// CE QUE CETTE FONCTION NE CROIT JAMAIS : l'adresse annoncée par l'appelant.
// Elle est lue dans la base, à partir de la famille du jeton. Un client qui
// pourrait nommer le destinataire serait un client capable d'écrire aux parents
// des autres familles.
//
// Deploy:  supabase functions deploy courrier

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

import { admin, env, fail, familyOfCaller, json, servir, stripe } from '../_shared/mino.ts';
import { familleDuJeton, jetonLien } from '../_shared/lien.ts';
import { trialEndForCheckout } from '../../../src/domain/billing.ts';

/**
 * Les messages qu'on sait écrire, et rien d'autre.
 *
 * Un `kind` libre serait une porte ouverte : l'appelant choisirait le sujet et
 * le corps, donc se servirait de notre domaine pour envoyer ce qu'il veut. Le
 * gabarit est ici, l'appelant ne choisit que lequel.
 */
type Genre = 'bienvenue' | 'fin_essai' | 'reconduction' | 'reprise';

/**
 * Le genre qui n'en est pas un : la marque d'un parent qui ne veut plus rien
 * recevoir.
 *
 * **Pourquoi ici plutôt que dans une table à part.** `courriers` a pour clé
 * primaire (famille, genre) et sert déjà à ne jamais écrire deux fois la même
 * chose. Une ligne portant ce genre-là se pose exactement de la même façon, et
 * `dejaEnvoye` la trouve sans qu'aucune requête n'ait à changer. Pas de
 * migration, pas de table, pas de chemin oublié — et c'est ce dernier point
 * qui compte : un désabonnement qu'une route oublie de consulter est pire
 * qu'un désabonnement absent, parce qu'il a été promis.
 *
 * Les messages du cycle de vie qu'on doit légalement envoyer — l'information
 * avant reconduction annuelle — n'en dépendent pas : voir `ecrireA`.
 */
const REFUS = 'aucun_courrier';

interface Famille {
  parentName: string | null;
  email: string | null;
  familyCode: string;
  childName: string | null;
  trialEndsAt: string | null;
  plan: string | null;
  /** L'adresse qui ouvre le paiement sans demander à se reconnecter. */
  lienReprise: string;
  /** Celle qui fait taire Mino, obligatoire sur un message de reconquête. */
  lienStop: string;
}

const jour = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

/**
 * Un message, décrit une fois, rendu deux fois.
 *
 * **Pourquoi des blocs plutôt que deux chaînes.** Il faut les deux versions —
 * une messagerie qui refuse le HTML doit lire autre chose qu'une page blanche,
 * et un message HTML sans équivalent texte est un signal négatif pour les
 * filtres anti-spam. Mais deux versions écrites à la main divergent : on
 * corrige un tarif dans l'une, on oublie l'autre, et c'est celle qu'on oublie
 * que lit le client mécontent.
 *
 * Ici le message est une liste de blocs, et les deux rendus en découlent.
 */
type Bloc =
  | { p: string }
  | { titre: string }
  | { code: string }
  | { bouton: { label: string; url: string } };

/* ------------------------------------------------------- la charte, en dur */

/**
 * Les couleurs de Mino, écrites en clair et non importées.
 *
 * Un client de messagerie ne charge ni feuille de style ni police : tout est en
 * attribut `style`, et Nunito n'y sera pas — d'où une pile de repli qui reste
 * ronde et lisible. Les valeurs sont recopiées de `src/theme/colors.ts` parce
 * qu'une fonction Edge ne peut pas importer un module React Native.
 */
const CHARTE = {
  fond: '#F2F6FF',
  carte: '#FFFFFF',
  encre: '#1A1D2E',
  doux: '#5B6480',
  bleu: '#4EB6FF',
  bleuEncre: '#0B6BA8',
  police:
    "Nunito, 'Avenir Next', Avenir, 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
};

const echapper = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function enTexte(blocs: Bloc[]): string {
  return blocs
    .map((b) => {
      if ('titre' in b) return b.titre.toUpperCase();
      if ('code' in b) return b.code;
      if ('bouton' in b) return `${b.bouton.label} : ${b.bouton.url}`;
      return b.p;
    })
    .join('\n\n');
}

function enHtml(blocs: Bloc[]): string {
  const corps = blocs
    .map((b) => {
      if ('titre' in b) {
        return `<p style="margin:28px 0 8px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${CHARTE.doux}">${echapper(b.titre)}</p>`;
      }
      if ('code' in b) {
        // Le code famille se recopie à la main sur un autre appareil : il doit
        // être gros, espacé, et détaché du reste.
        return `<p style="margin:20px 0;padding:18px;background:${CHARTE.fond};border-radius:16px;text-align:center;font-size:26px;font-weight:800;letter-spacing:3px;color:${CHARTE.bleuEncre}">${echapper(b.code)}</p>`;
      }
      if ('bouton' in b) {
        return `<p style="margin:28px 0;text-align:center"><a href="${b.bouton.url}" style="display:inline-block;padding:16px 32px;background:${CHARTE.bleu};color:#FFFFFF;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px">${echapper(b.bouton.label)}</a></p>`;
      }
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${CHARTE.encre}">${echapper(b.p)}</p>`;
    })
    .join('\n');

  // Tableaux et styles en ligne : c'est laid, et c'est la seule mise en page
  // qu'Outlook rende correctement.
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${CHARTE.fond};font-family:${CHARTE.police}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CHARTE.fond};padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CHARTE.carte};border-radius:24px;padding:40px 32px">
<tr><td>
<p style="margin:0 0 28px;font-size:30px;font-weight:800;color:${CHARTE.encre};letter-spacing:-.5px">mino<span style="color:${CHARTE.bleu}">.</span></p>
${corps}
<p style="margin:32px 0 0;padding-top:24px;border-top:1px solid ${CHARTE.fond};font-size:13px;line-height:1.6;color:${CHARTE.doux}">
Une question ? Répondez simplement à ce message, nous lisons tout.<br>
Mino — Grandir, une mission à la fois.
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function ecrire(genre: Genre, f: Famille): { sujet: string; texte: string; html: string } {
  const prenom = f.parentName ? ` ${f.parentName}` : '';
  const enfant = f.childName ?? 'votre enfant';

  const blocs: Bloc[] =
    genre === 'bienvenue'
      ? [
          { p: `Bonjour${prenom},` },
          {
            p: `Votre famille est créée, et ${enfant} a déjà sa première mission. Il ne lui reste qu'à la faire.`,
          },
          { titre: 'Comment ça se passe, à partir de maintenant' },
          /**
           * Le blocage se dit ici, et il se disait nulle part.
           *
           * Ce paragraphe décrivait une minuterie : mission faite, minutes
           * accordées, « c'est tout ». Or ce n'est pas ce qu'on vend. Un parent
           * qui lit cela le jour de son inscription comprend qu'il vient
           * d'installer un compteur de bons points, et rien ne lui dit que les
           * applications qu'il a en tête vont réellement se fermer — c'est-à-
           * dire la seule chose pour laquelle il est venu.
           */
          {
            p: 'Vous choisissez les applications à verrouiller — une seule, ou toutes celles qui posent problème. Elles restent fermées sur son appareil tant que le temps n\'a pas été gagné.',
          },
          {
            p: `${enfant} touche « J'AI TERMINÉ ». Vous confirmez. Ses minutes arrivent tout de suite, et les applications s'ouvrent pour la durée gagnée. Le temps écoulé, elles se referment d'elles-mêmes.`,
          },
          {
            p: "Rien d'autre à surveiller : c'est l'appareil lui-même qui tient la limite, pas vous.",
          },
          { titre: 'Pour installer Mino sur son appareil' },
          {
            p: 'Téléchargez Mino, choisissez « J\'ai un code famille », et saisissez ce code :',
          },
          { code: f.familyCode },
          {
            p: "C'est l'étape qui compte : tant que son appareil n'est pas relié, Mino ne peut rien verrouiller. L'application vous demandera ensuite une autorisation sur cet appareil — c'est elle qui donne à Mino le droit de refermer les applications.",
          },
          { bouton: { label: 'Installer Mino', url: 'https://minoapp.fr/telecharger' } },
          { titre: 'Vos 30 jours' },
          {
            p: `Vous avez jusqu'au ${jour(f.trialEndsAt)} pour voir si ça marche chez vous. Rien n'est prélevé avant, et vous pouvez arrêter en deux touches d'ici là.`,
          },
          { p: 'À très vite,\nL\'équipe Mino' },
        ]
      : genre === 'fin_essai'
        ? /**
           * Deux essais très différents, et un seul message pour les deux.
           *
           * **Le défaut que cela répare.** Ce message annonçait un prélèvement
           * à tout le monde. Or `plan` est nul tant qu'aucune formule n'a été
           * choisie : ces familles-là n'ont donné aucun moyen de paiement, et
           * rien ne leur sera prélevé — leur essai s'arrête, simplement.
           * Écrire « 9,99 € sera prélevé » à quelqu'un qui n'a jamais donné de
           * carte, c'est l'alarmer et se décrédibiliser d'un seul coup, à
           * l'instant précis où l'on essaie de le convaincre de rester.
           */
          f.plan
          ? [
              { p: `Bonjour${prenom},` },
              {
                p: `Votre essai gratuit se termine le ${jour(f.trialEndsAt)}. À cette date, ${
                  f.plan === 'yearly' ? '79,99 € pour un an' : '9,99 € pour un mois'
                } sera prélevé, puis l'abonnement se renouvellera automatiquement.`,
              },
              { titre: 'Si vous voulez continuer' },
              { p: `Vous n'avez rien à faire. Tout reste en place pour ${enfant}.` },
              { titre: 'Si vous préférez arrêter' },
              {
                p: `Ouvrez Mino, Réglages, Abonnement, puis « Résilier ». Deux touches, et rien ne sera prélevé. Vous gardez l'accès jusqu'au ${jour(f.trialEndsAt)}.`,
              },
              {
                p: 'Nous préférons vous le dire franchement plutôt que de compter sur un oubli.',
              },
              { p: "L'équipe Mino" },
            ]
          : [
              { p: `Bonjour${prenom},` },
              {
                p: `Votre essai gratuit se termine le ${jour(f.trialEndsAt)}. Vous n'avez enregistré aucun moyen de paiement : rien ne sera prélevé, et il n'y a rien à résilier.`,
              },
              { titre: 'Si vous voulez continuer' },
              {
                p: `Ouvrez Mino, Réglages, Abonnement, et choisissez votre formule. Les missions de ${enfant}, ses minutes et vos réglages restent exactement où ils sont.`,
              },
              { titre: "Si vous préférez en rester là" },
              {
                p: "Vous n'avez rien à faire. À la fin de l'essai, Mino cesse d'encadrer les écrans, et vos données restent conservées si vous changez d'avis.",
              },
              { p: "L'équipe Mino" },
            ]
        : genre === 'reprise'
          ? /**
             * La reconquête, et la seule chose qui la rende acceptable.
             *
             * Ce message part à des familles dont l'accès s'est arrêté. Ce
             * n'est pas de la prospection — l'article L. 34-5 du code des
             * postes l'autorise auprès de ses propres clients pour un produit
             * analogue — mais cela ne vaut que si le moyen de s'y opposer est
             * là, lisible, et qu'il fonctionne. D'où `lienStop`, et d'où le
             * fait que ce message ne parte qu'**une fois par famille**.
             *
             * Le bouton n'emmène pas vers une page de connexion, et c'est tout
             * son objet : un parent qui a laissé tomber ne se souvient plus de
             * ses identifiants. C'est souvent pour cela qu'il a laissé tomber.
             */
            [
              { p: `Bonjour${prenom},` },
              {
                p: `Votre accès à Mino s'est arrêté. ${enfant} ne gagne plus de temps d'écran, et les applications ne se referment plus.`,
              },
              { titre: 'Tout est resté en place' },
              {
                p: "Les missions, les minutes déjà gagnées et vos réglages sont exactement où vous les avez laissés. Reprendre l'abonnement les rallume — il n'y a rien à refaire.",
              },
              { bouton: { label: 'Reprendre mon abonnement', url: f.lienReprise } },
              {
                p: 'Ce lien ouvre directement le paiement pour votre compte : aucun mot de passe à retrouver.',
              },
              { p: "L'équipe Mino" },
            ]
        : [
            { p: `Bonjour${prenom},` },
            {
              p: "Votre abonnement annuel Mino se renouvellera automatiquement. Nous vous en informons à l'avance, comme la loi nous y oblige et comme nous le ferions de toute façon.",
            },
            {
              p: 'Si vous ne souhaitez pas le reconduire, vous pouvez y mettre fin dès maintenant : Réglages, Abonnement, « Résilier ». Vous garderez l\'accès jusqu\'à la fin de la période déjà payée.',
            },
            { p: "Si vous continuez avec nous, il n'y a rien à faire — et merci." },
            { p: "L'équipe Mino" },
          ];

  const sujet =
    genre === 'bienvenue'
      ? 'Bienvenue chez Mino 👋'
      : genre === 'fin_essai'
        ? 'Votre essai Mino se termine bientôt'
        : genre === 'reprise'
          ? `${enfant} peut regagner son temps d’écran`
          : 'Votre abonnement Mino se renouvelle bientôt';

  /**
   * Le lien de désabonnement, sur le seul message qui en a besoin.
   *
   * Il ne se met pas sur la bienvenue ni sur les rappels de facturation :
   * ceux-là sont liés à l'exécution du contrat, et les retirer priverait le
   * parent d'une information qu'on lui doit. Il se met ici, où le message est
   * une sollicitation.
   */
  const pied: Bloc[] =
    genre === 'reprise'
      ? [{ p: `Ne plus recevoir ce genre de message : ${f.lienStop}` }]
      : [];

  return {
    sujet,
    texte: enTexte([...blocs, ...pied]),
    html: enHtml([...blocs, ...pied]),
  };
}

/**
 * Un envoi par message et par famille, jamais deux.
 *
 * Un rappel envoyé deux fois est pire qu'un rappel manqué : il dit au parent
 * que personne ne tient les comptes chez nous, à l'instant précis où on lui
 * parle d'argent. La clé porte le genre et la famille, et la contrainte
 * d'unicité fait le reste — c'est la base qui refuse, pas une condition qu'on
 * pourrait oublier d'écrire.
 */
async function dejaEnvoye(familyId: string, genre: Genre): Promise<boolean> {
  const { data } = await admin()
    .from('courriers')
    .select('family_id')
    .eq('family_id', familyId)
    .eq('genre', genre)
    .maybeSingle();
  return !!data;
}

/**
 * A-t-on promis de se taire ?
 *
 * Vérifié pour la reconquête seulement. Les autres messages tiennent à
 * l'exécution du contrat : prévenir d'un prélèvement ou d'une reconduction
 * n'est pas une sollicitation, c'est une obligation, et un parent ne peut pas
 * y renoncer par un clic dans un e-mail.
 */
async function refuse(familyId: string): Promise<boolean> {
  const { data } = await admin()
    .from('courriers')
    .select('family_id')
    .eq('family_id', familyId)
    .eq('genre', REFUS)
    .maybeSingle();
  return !!data;
}

async function envoyer(
  destinataire: string,
  sujet: string,
  texte: string,
  html: string,
): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
      // 587 + STARTTLS par défaut, ce que tout hébergeur accepte. `SMTP_TLS=true`
      // bascule sur le TLS implicite du port 465, que certains imposent.
      tls: Deno.env.get('SMTP_TLS') === 'true',
      auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') },
    },
  });

  try {
    await client.send({
      from: env('MAIL_FROM'),
      // Répondre doit arriver quelque part où quelqu'un lit : le message le
      // promet, et une promesse d'écoute qui tombe dans le vide coûte plus
      // cher que pas de promesse du tout.
      replyTo: Deno.env.get('MAIL_REPLY_TO') ?? env('MAIL_FROM'),
      to: destinataire,
      subject: sujet,
      // Les deux versions, toujours : `content` pour les messageries qui
      // refusent le HTML, `html` pour les autres.
      content: texte,
      html,
    });
  } finally {
    await client.close();
  }
}

/**
 * Écrire à une famille, une fois.
 *
 * Extrait de la route authentifiée le jour où il a fallu écrire à des familles
 * dont personne n'est connecté — c'est-à-dire toutes, la nuit. Le contenu ne
 * vient que de la base : ni l'appelant ni la tâche planifiée ne nomment le
 * destinataire.
 */
async function ecrireA(
  familyId: string,
  genre: Genre,
): Promise<{ envoye: boolean; raison?: string }> {
  const db = admin();

  const [{ data: famille }, { data: parent }, { data: enfants }, { data: abonnement }] =
    await Promise.all([
      db.from('families').select('code').eq('id', familyId).maybeSingle(),
      db
        .from('parents')
        .select('display_name, email')
        .eq('family_id', familyId)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
      db.from('children').select('first_name').eq('family_id', familyId).order('created_at'),
      db
        .from('subscriptions')
        .select('trial_ends_at, plan')
        .eq('family_id', familyId)
        .maybeSingle(),
    ]);

  const destinataire = parent?.email as string | undefined;
  // Pas d'adresse : le parent n'a pas encore donné la sienne. Ce n'est pas une
  // panne, c'est un état normal du parcours d'inscription — et il ne faut
  // surtout pas marquer le message comme envoyé.
  if (!destinataire) return { envoye: false, raison: 'sans adresse' };

  if (await dejaEnvoye(familyId, genre)) return { envoye: false, raison: 'déjà' };
  if (genre === 'reprise' && (await refuse(familyId))) {
    return { envoye: false, raison: 'ne souhaite plus être contacté' };
  }

  // Un seul jeton pour les deux liens : ils désignent la même famille, et en
  // fabriquer deux ne ferait que doubler ce qu'il y a à faire fuiter.
  const jeton = await jetonLien(familyId);
  const base = `${env('SUPABASE_URL')}/functions/v1/courrier`;

  const { sujet, texte, html } = ecrire(genre, {
    parentName: (parent?.display_name as string | null) ?? null,
    email: destinataire,
    familyCode: (famille?.code as string) ?? '',
    childName: (enfants?.[0]?.first_name as string | undefined) ?? null,
    trialEndsAt: (abonnement?.trial_ends_at as string | null) ?? null,
    plan: (abonnement?.plan as string | null) ?? null,
    lienReprise: `${base}/reprendre?t=${encodeURIComponent(jeton)}`,
    lienStop: `${base}/stop?t=${encodeURIComponent(jeton)}`,
  });

  await envoyer(destinataire, sujet, texte, html);

  // La trace n'est écrite qu'après un envoi réussi : la marquer avant, c'est
  // condamner le parent à ne jamais recevoir ce message si le serveur SMTP
  // hoquette une seconde.
  await db.from('courriers').insert({ family_id: familyId, genre });
  return { envoye: true };
}

/**
 * La tournée de nuit, et pourquoi elle ne pouvait pas exister avant.
 *
 * `familyOfCaller` exige un parent connecté — c'est une propriété de sécurité
 * sur la route ordinaire : on n'écrit qu'à sa propre famille. Mais une tâche
 * planifiée n'est le parent de personne. Sans cette porte-ci, les CGV
 * promettaient un rappel avant le premier prélèvement que rien n'envoyait, et
 * l'obligation d'information avant reconduction annuelle (article L. 215-1)
 * n'avait aucun mécanisme.
 *
 * **Le garde est un secret partagé, pas un jeton d'utilisateur.** Il n'y a pas
 * d'utilisateur derrière cet appel. `COURRIER_CRON_SECRET` est connu de la
 * fonction et de la tâche `pg_cron`, et de personne d'autre — la route est
 * publique par nécessité, comme les webhooks des boutiques.
 */
async function lot(request: Request): Promise<Response> {
  const attendu = Deno.env.get('COURRIER_CRON_SECRET');
  if (!attendu || request.headers.get('x-mino-cron') !== attendu) {
    return fail('Non autorisé.', 401);
  }

  const db = admin();
  const maintenant = Date.now();
  const dans = (jours: number) => new Date(maintenant + jours * 86_400_000).toISOString();

  /**
   * **Une fenêtre, pas une date.** La tâche peut ne pas tourner une nuit —
   * base en maintenance, planificateur en retard. Viser « exactement J-3 »
   * ferait manquer ce rappel-là définitivement, alors que la table `courriers`
   * empêche déjà tout doublon.
   *
   * **Et seulement les abonnés Stripe.** Apple et Google préviennent
   * eux-mêmes leurs abonnés avant la fin d'une offre d'introduction ; écrire à
   * notre tour ferait deux messages pour un seul prélèvement. `source` est nul
   * tant qu'aucun paiement n'a eu lieu, donc l'essai web y figure aussi.
   */
  const { data: essais } = await db
    .from('subscriptions')
    .select('family_id, source')
    .eq('status', 'trialing')
    // Celui qui a déjà arrêté son essai n'a pas à recevoir l'annonce d'un
    // prélèvement auquel il vient de renoncer.
    .eq('cancel_at_period_end', false)
    .gte('trial_ends_at', dans(2))
    .lte('trial_ends_at', dans(4))
    .limit(500);

  /**
   * L'information avant reconduction : entre trois mois et un mois avant
   * l'échéance, dit la loi. On vise un mois, qui laisse le temps d'agir sans
   * que l'échéance paraisse lointaine au point qu'on l'oublie.
   */
  const { data: annuels } = await db
    .from('subscriptions')
    .select('family_id, source')
    .eq('status', 'active')
    .eq('plan', 'yearly')
    .gte('current_period_end', dans(30))
    .lte('current_period_end', dans(32))
    .limit(500);

  /**
   * La reconquête : les familles qui n'ont plus accès à rien.
   *
   * **Qui reçoit.** Celles dont l'essai s'est éteint sans abonnement, et
   * celles qui ont résilié et dont la période payée est terminée. Autrement
   * dit, exactement celles pour qui Mino ne fait plus rien.
   *
   * **Qui ne reçoit pas, et c'est le point qui compte.** Personne d'abonné,
   * sur aucun rail : ni `active`, ni `trialing` en cours, ni `past_due` — un
   * prélèvement en cours de nouvelle tentative n'est pas une famille perdue,
   * et lui proposer de « reprendre » à ce moment-là est le meilleur moyen de
   * lui faire ouvrir deux abonnements. La sélection ne retient donc que deux
   * états, et jamais par exclusion : on nomme ce qu'on veut, plutôt que de
   * lister ce qu'on écarte et d'en oublier un.
   *
   * **Une fenêtre au démarrage, pas depuis toujours.** On ne remonte pas
   * au-delà d'un an : écrire à quelqu'un parti depuis trois ans n'est plus une
   * reconquête, c'est du démarchage.
   */
  const depuis = (jours: number) => new Date(maintenant - jours * 86_400_000).toISOString();

  const { data: partis } = await db
    .from('subscriptions')
    .select('family_id, status, trial_ends_at, current_period_end')
    .in('status', ['trialing', 'canceled'])
    .limit(500);

  const perdue = (r: Record<string, unknown>) => {
    const fin = (r.status === 'trialing' ? r.trial_ends_at : r.current_period_end) as string | null;
    if (!fin) return false;
    return fin < new Date(maintenant).toISOString() && fin > depuis(365);
  };

  const surStripe = (r: { source?: string | null }) => !r.source || r.source === 'stripe';
  const tournee: Array<{ familyId: string; genre: Genre }> = [
    ...(essais ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'fin_essai' as const })),
    ...(annuels ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'reconduction' as const })),
    ...(partis ?? []).filter(perdue).map((r) => ({ familyId: r.family_id as string, genre: 'reprise' as const })),
  ];

  let envoyes = 0;
  const echecs: string[] = [];
  for (const cible of tournee) {
    // Un échec n'arrête pas la tournée : une adresse morte ne doit pas priver
    // les autres familles de leur rappel. Le message reste non tracé, donc il
    // sera retenté demain.
    try {
      if ((await ecrireA(cible.familyId, cible.genre)).envoye) envoyes += 1;
    } catch (error) {
      console.error('courrier lot', cible.genre, cible.familyId, error);
      echecs.push(cible.familyId);
    }
  }

  return json({ examinees: tournee.length, envoyes, echecs: echecs.length });
}

/**
 * Une page, pas du JSON : ces deux routes s'ouvrent dans un navigateur.
 */
function page(titre: string, phrase: string, lien?: { label: string; url: string }): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mino</title></head>
<body style="margin:0;background:${CHARTE.fond};font-family:${CHARTE.police}">
<table role="presentation" width="100%" style="padding:48px 16px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:${CHARTE.carte};border-radius:24px;padding:40px 32px">
<tr><td>
<p style="margin:0 0 24px;font-size:30px;font-weight:800;color:${CHARTE.encre}">mino<span style="color:${CHARTE.bleu}">.</span></p>
<p style="margin:0 0 12px;font-size:22px;font-weight:800;color:${CHARTE.encre}">${echapper(titre)}</p>
<p style="margin:0;font-size:16px;line-height:1.6;color:${CHARTE.doux}">${echapper(phrase)}</p>
${lien ? `<p style="margin:28px 0 0"><a href="${lien.url}" style="display:inline-block;padding:16px 32px;background:${CHARTE.bleu};color:#FFF;text-decoration:none;border-radius:999px;font-weight:700">${echapper(lien.label)}</a></p>` : ''}
</td></tr></table></td></tr></table></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Ouvrir le paiement depuis un lien d'e-mail, sans demander à se reconnecter.
 *
 * **Pourquoi cette route vit ici et non dans `billing`.** Ce n'est pas un
 * choix d'architecture, c'est une contrainte de passerelle : `billing` est
 * déployée avec la vérification du jeton Supabase, et un navigateur qui suit
 * un lien d'e-mail ne présente aucun jeton — il recevrait 401 avant même
 * d'atteindre notre code. `courrier` est déployée avec `--no-verify-jwt`
 * précisément pour la tournée de nuit ; ces liens y trouvent leur place.
 *
 * **Ce que le jeton autorise, et rien de plus** : ouvrir une page de paiement
 * rattachée à une famille. Il ne lit aucune donnée, n'ouvre aucune session, et
 * expire. Le pire cas est que quelqu'un paie pour une famille qui n'est pas la
 * sienne.
 *
 * **Aucun essai n'est réaccordé** : `trialEndForCheckout` le refuse dès que la
 * date est passée, ce qui est exactement la situation de ces familles-là.
 */
async function reprendre(request: Request): Promise<Response> {
  const familyId = await familleDuJeton(new URL(request.url).searchParams.get('t'));
  if (!familyId) {
    return page(
      'Ce lien n’est plus valable',
      'Il a expiré, ou il a été tronqué au passage. Ouvrez Mino et rendez-vous dans Réglages, Abonnement — vous y trouverez la même chose.',
    );
  }

  const formule = new URL(request.url).searchParams.get('f') === 'monthly' ? 'monthly' : 'yearly';
  const price =
    formule === 'monthly'
      ? Deno.env.get('STRIPE_PRICE_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_YEARLY');
  if (!price) return page('Indisponible', 'Le paiement n’est pas configuré. Écrivez-nous, on s’en occupe.');

  const db = admin();
  const [{ data: abonnement }, { data: parent }] = await Promise.all([
    db.from('subscriptions').select('*').eq('family_id', familyId).maybeSingle(),
    db
      .from('parents')
      .select('email')
      .eq('family_id', familyId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ]);

  // Déjà couvert : on ne laisse surtout pas ouvrir un second abonnement.
  if (abonnement && ['active', 'past_due'].includes(String(abonnement.status))) {
    return page(
      'Votre abonnement est déjà actif',
      'Il n’y a rien à reprendre — tout fonctionne. Ouvrez Mino, vos enfants vous attendent.',
    );
  }

  const trialEnd = trialEndForCheckout({
    trialEndsAt: (abonnement?.trial_ends_at as string | null) ?? null,
    hasPaidBefore: !!abonnement?.customer_id,
  });

  const adresse = ((parent?.email as string | null) ?? '').trim();

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer: (abonnement?.customer_id as string | null) ?? undefined,
    customer_email: abonnement?.customer_id || !adresse ? undefined : adresse,
    client_reference_id: familyId,
    subscription_data: {
      trial_end: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : undefined,
      metadata: { family_id: familyId },
    },
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    customer_update: abonnement?.customer_id ? { address: 'auto', name: 'auto' } : undefined,
    allow_promotion_codes: true,
    success_url: `${env('APP_URL')}/abonnement/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env('APP_URL')}/abonnement`,
    metadata: { family_id: familyId },
  });

  console.log('courrier reprendre', familyId, formule);
  return Response.redirect(session.url!, 303);
}

/**
 * Ne plus rien recevoir de ce genre.
 *
 * La marque est posée dans `courriers`, sous un genre réservé, et `ecrireA` la
 * consulte avant toute reconquête. Elle ne fait pas taire les messages liés au
 * contrat — un prélèvement annoncé reste un prélèvement annoncé — et la page le
 * dit, parce qu'un désabonnement qui promet plus qu'il ne tient se paie au
 * premier relevé bancaire.
 */
async function stop(request: Request): Promise<Response> {
  const familyId = await familleDuJeton(new URL(request.url).searchParams.get('t'));
  if (!familyId) {
    return page(
      'Ce lien n’est plus valable',
      'Écrivez-nous à contact@minoapp.fr et nous nous en occupons à la main.',
    );
  }

  await admin()
    .from('courriers')
    .upsert({ family_id: familyId, genre: REFUS }, { onConflict: 'family_id,genre', ignoreDuplicates: true });

  console.log('courrier stop', familyId);
  return page(
    'C’est noté',
    'Nous ne vous écrirons plus pour vous proposer de revenir. Les messages liés à votre abonnement — un prélèvement à venir, une reconduction — continueront de partir tant que vous en avez un : la loi nous y oblige, et vous y avez droit.',
  );
}

Deno.serve(servir(async (request) => {
  const route = new URL(request.url).pathname.replace(/^\/courrier\/?/, '');
  if (route === 'lot') return await lot(request);
  if (route === 'reprendre') return await reprendre(request);
  if (route === 'stop') return await stop(request);

  const caller = await familyOfCaller(request);
  if (!caller) {
    // Journalisé, et pas seulement renvoyé : un 401 muet dans une fonction qui
    // n'écrit rien d'autre est indiscernable d'une fonction jamais appelée.
    console.error('courrier refusé : appelant non authentifié');
    return fail('Non authentifié.', 401);
  }

  const { genre } = (await request.json()) as { genre?: Genre };
  // `reprise` n'est pas dans cette liste, et c'est délibéré : elle se décide la
  // nuit, sur l'état de la base. Un client qui pourrait la demander pourrait
  // s'envoyer une relance de reconquête à volonté.
  if (genre !== 'bienvenue' && genre !== 'fin_essai' && genre !== 'reconduction') {
    return fail('Message inconnu.');
  }

  try {
    /**
     * Dire ce qu'on a fait, même — surtout — quand on n'a rien fait.
     *
     * Cette fonction avait deux sorties parfaitement silencieuses : « sans
     * adresse » et « déjà envoyé ». Toutes deux rendent 200. Vu du tableau de
     * bord, l'invocation ne laissait qu'un `booted` et un `shutdown`, ce qui
     * ressemble trait pour trait à une fonction que personne n'appelle. On a
     * cherché du côté du site, du CORS et des secrets SMTP un défaut qui était
     * ici, et qu'une ligne de journal aurait nommé tout de suite.
     */
    const issue = await ecrireA(caller.familyId, genre);
    console.log('courrier', genre, caller.familyId, issue.envoye ? 'envoyé' : issue.raison);
    return json(issue);
  } catch (error) {
    console.error('courrier', genre, caller.familyId, error);
    return fail('Envoi impossible.', 502);
  }
}));
