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

import { CORS, admin, env, fail, familyOfCaller, json } from '../_shared/mino.ts';

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
 * Le texte, en clair et en HTML.
 *
 * Les deux, toujours : une messagerie qui refuse le HTML — il en reste — doit
 * lire autre chose qu'une page blanche, et un filtre anti-spam considère un
 * message HTML sans équivalent texte comme un signal négatif.
 */
function ecrire(genre: Genre, f: Famille): { sujet: string; texte: string } {
  const prenom = f.parentName ? ` ${f.parentName}` : '';
  const enfant = f.childName ?? 'votre enfant';

  if (genre === 'bienvenue') {
    return {
      sujet: 'Bienvenue chez Mino 👋',
      texte: `Bonjour${prenom},

Votre famille est créée, et ${enfant} a déjà sa première mission. Il ne lui reste qu'à la faire.

COMMENT ÇA SE PASSE, À PARTIR DE MAINTENANT
${enfant} touche « J'AI TERMINÉ ». Vous confirmez. Ses minutes arrivent tout de suite. C'est tout — il n'y a rien d'autre à apprendre.

POUR INSTALLER MINO SUR SON APPAREIL
Téléchargez Mino, choisissez « J'ai un code famille », et saisissez : ${f.familyCode}

C'est l'étape qui compte : tant que son appareil n'est pas relié, Mino ne peut rien encadrer.

VOS 30 JOURS
Vous avez jusqu'au ${jour(f.trialEndsAt)} pour voir si ça marche chez vous. Rien n'est prélevé avant, et vous pouvez arrêter en deux touches d'ici là.

Une question, un doute, quelque chose qui coince ? Répondez simplement à ce message : nous lisons tout.

À très vite,
L'équipe Mino
Grandir, une mission à la fois.`,
    };
  }

  if (genre === 'fin_essai') {
    const montant = f.plan === 'yearly' ? '79,99 € pour un an' : '9,99 € pour un mois';
    return {
      sujet: 'Votre essai Mino se termine bientôt',
      texte: `Bonjour${prenom},

Votre essai gratuit se termine le ${jour(f.trialEndsAt)}. À cette date, ${montant} sera prélevé, puis l'abonnement se renouvellera automatiquement.

SI VOUS VOULEZ CONTINUER
Vous n'avez rien à faire. Tout reste en place pour ${enfant}.

SI VOUS PRÉFÉREZ ARRÊTER
Ouvrez Mino, Réglages, Abonnement, puis « Annuler ». Deux touches, et rien ne sera prélevé. Vous gardez l'accès jusqu'au ${jour(f.trialEndsAt)}.

Nous préférons vous le dire franchement plutôt que de compter sur un oubli.

L'équipe Mino
Grandir, une mission à la fois.`,
    };
  }

  return {
    sujet: 'Votre abonnement Mino se renouvelle bientôt',
    texte: `Bonjour${prenom},

Votre abonnement annuel Mino se renouvellera automatiquement. Nous vous en informons à l'avance, comme la loi nous y oblige et comme nous le ferions de toute façon.

Si vous ne souhaitez pas le reconduire, vous pouvez y mettre fin dès maintenant depuis Mino : Réglages, Abonnement, « Résilier ». Vous garderez l'accès jusqu'à la fin de la période déjà payée.

Si vous continuez avec nous, il n'y a rien à faire — et merci.

L'équipe Mino
Grandir, une mission à la fois.`,
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

async function envoyer(destinataire: string, sujet: string, texte: string): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
      tls: false,
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
      content: texte,
    });
  } finally {
    await client.close();
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const caller = await familyOfCaller(request);
  if (!caller) return fail('Non authentifié.', 401);

  const { genre } = (await request.json()) as { genre?: Genre };
  if (genre !== 'bienvenue' && genre !== 'fin_essai' && genre !== 'reconduction') {
    return fail('Message inconnu.');
  }

  const db = admin();

  // Tout vient de la base, à partir de la famille du jeton. L'appelant ne dit
  // que le genre du message.
  const [{ data: famille }, { data: parent }, { data: enfants }, { data: abonnement }] =
    await Promise.all([
      db.from('families').select('code').eq('id', caller.familyId).maybeSingle(),
      db
        .from('parents')
        .select('display_name, email')
        .eq('family_id', caller.familyId)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
      db.from('children').select('first_name').eq('family_id', caller.familyId).order('created_at'),
      db
        .from('subscriptions')
        .select('trial_ends_at, plan')
        .eq('family_id', caller.familyId)
        .maybeSingle(),
    ]);

  const destinataire = parent?.email as string | undefined;
  // Pas d'adresse : le parent n'a pas encore donné la sienne. Ce n'est pas une
  // panne, c'est un état normal du parcours d'inscription — et il ne faut
  // surtout pas marquer le message comme envoyé.
  if (!destinataire) return json({ envoye: false, raison: 'sans adresse' });

  if (await dejaEnvoye(caller.familyId, genre)) return json({ envoye: false, raison: 'déjà' });

  const { sujet, texte } = ecrire(genre, {
    parentName: (parent?.display_name as string | null) ?? null,
    email: destinataire,
    familyCode: (famille?.code as string) ?? '',
    childName: (enfants?.[0]?.first_name as string | undefined) ?? null,
    trialEndsAt: (abonnement?.trial_ends_at as string | null) ?? null,
    plan: (abonnement?.plan as string | null) ?? null,
  });

  try {
    await envoyer(destinataire, sujet, texte);
  } catch (error) {
    // On n'écrit la trace qu'après un envoi réussi : marquer avant, c'est
    // condamner le parent à ne jamais recevoir ce message si le serveur SMTP
    // hoquette une seconde.
    console.error('courrier', genre, caller.familyId, error);
    return fail('Envoi impossible.', 502);
  }

  await db.from('courriers').insert({ family_id: caller.familyId, genre });
  return json({ envoye: true });
});
