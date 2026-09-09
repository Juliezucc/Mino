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

import { admin, env, fail, familyOfCaller, json, servir } from '../_shared/mino.ts';

/**
 * Les messages qu'on sait écrire, et rien d'autre.
 *
 * Un `kind` libre serait une porte ouverte : l'appelant choisirait le sujet et
 * le corps, donc se servirait de notre domaine pour envoyer ce qu'il veut. Le
 * gabarit est ici, l'appelant ne choisit que lequel.
 */
type Genre = 'bienvenue' | 'fin_essai' | 'reconduction';

interface Famille {
  parentName: string | null;
  email: string | null;
  familyCode: string;
  childName: string | null;
  trialEndsAt: string | null;
  plan: string | null;
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
          {
            p: `${enfant} touche « J'AI TERMINÉ ». Vous confirmez. Ses minutes arrivent tout de suite. C'est tout — il n'y a rien d'autre à apprendre.`,
          },
          { titre: 'Pour installer Mino sur son appareil' },
          {
            p: 'Téléchargez Mino, choisissez « J\'ai un code famille », et saisissez ce code :',
          },
          { code: f.familyCode },
          {
            p: "C'est l'étape qui compte : tant que son appareil n'est pas relié, Mino ne peut rien encadrer.",
          },
          { bouton: { label: 'Installer Mino', url: 'https://minoapp.fr/telecharger' } },
          { titre: 'Vos 30 jours' },
          {
            p: `Vous avez jusqu'au ${jour(f.trialEndsAt)} pour voir si ça marche chez vous. Rien n'est prélevé avant, et vous pouvez arrêter en deux touches d'ici là.`,
          },
          { p: 'À très vite,\nL\'équipe Mino' },
        ]
      : genre === 'fin_essai'
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
        : 'Votre abonnement Mino se renouvelle bientôt';

  return { sujet, texte: enTexte(blocs), html: enHtml(blocs) };
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

  const { sujet, texte, html } = ecrire(genre, {
    parentName: (parent?.display_name as string | null) ?? null,
    email: destinataire,
    familyCode: (famille?.code as string) ?? '',
    childName: (enfants?.[0]?.first_name as string | undefined) ?? null,
    trialEndsAt: (abonnement?.trial_ends_at as string | null) ?? null,
    plan: (abonnement?.plan as string | null) ?? null,
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

  const surStripe = (r: { source?: string | null }) => !r.source || r.source === 'stripe';
  const tournee: Array<{ familyId: string; genre: Genre }> = [
    ...(essais ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'fin_essai' as const })),
    ...(annuels ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'reconduction' as const })),
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

Deno.serve(servir(async (request) => {
  const route = new URL(request.url).pathname.replace(/^\/courrier\/?/, '');
  if (route === 'lot') return await lot(request);

  const caller = await familyOfCaller(request);
  if (!caller) {
    // Journalisé, et pas seulement renvoyé : un 401 muet dans une fonction qui
    // n'écrit rien d'autre est indiscernable d'une fonction jamais appelée.
    console.error('courrier refusé : appelant non authentifié');
    return fail('Non authentifié.', 401);
  }

  const { genre } = (await request.json()) as { genre?: Genre };
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
