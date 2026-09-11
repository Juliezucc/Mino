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

import { admin, appelant, env, fail, familyOfCaller, json, servir, stripe } from '../_shared/mino.ts';
import { familleDuJeton, jetonLien } from '../_shared/lien.ts';
import { trialEndForCheckout } from '../../../src/domain/billing.ts';

/**
 * Les messages qu'on sait écrire, et rien d'autre.
 *
 * Un `kind` libre serait une porte ouverte : l'appelant choisirait le sujet et
 * le corps, donc se servirait de notre domaine pour envoyer ce qu'il veut. Le
 * gabarit est ici, l'appelant ne choisit que lequel.
 */
type Genre =
  | 'bienvenue'
  | 'fin_essai'
  | 'reconduction'
  | 'reprise'
  /** J+1 : la famille existe, aucun appareil d'enfant ne l'a rejointe. */
  | 'appareil_manquant'
  /** J+3 : l'appareil est relié, mais le bouclier n'a pas été autorisé. */
  | 'bouclier_inactif'
  /** Le prélèvement a échoué et l'accès court encore le temps des relances. */
  | 'paiement_echoue'
  /** La résiliation est enregistrée — et on demande pourquoi, une fois. */
  | 'au_revoir';

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

/**
 * Les quatre réponses possibles à « qu'est-ce qui n'a pas marché ? ».
 *
 * Quatre, et pas davantage : au-delà, on ne clique plus. Pas de champ libre
 * non plus — un e-mail n'est pas un formulaire, et celui qui a quelque chose à
 * ajouter peut répondre au message, ce que le pied propose déjà.
 *
 * `code` est ce qui sera écrit en base, et il ne changera plus : renommer une
 * valeur couperait une série de mesures en deux sans qu'aucune requête ne s'en
 * plaigne.
 */
const MOTIFS = [
  { code: 'prix', label: 'Trop cher' },
  { code: 'interet', label: 'Mon enfant s’en est lassé' },
  { code: 'technique', label: 'Ça ne marchait pas bien' },
  { code: 'inutile', label: 'On n’en a plus besoin' },
] as const;

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
  /** Le portail Stripe, pour changer une carte. Vide hors du rail Stripe. */
  lienCarte: string;
  /** Les quatre motifs de départ, chacun derrière son lien. */
  motifs: { label: string; url: string }[];
  /** Jusqu'à quand l'accès court encore. */
  finAcces: string | null;
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
                p: `Les missions de ${enfant}, ses minutes et vos réglages restent exactement où ils sont. Ce bouton ouvre directement le paiement pour votre compte — aucun mot de passe à retrouver :`,
              },
              /**
               * Le bouton qui manquait, à l'endroit qui compte le plus.
               *
               * Ce message dit à une famille qu'elle va perdre l'accès dans
               * trois jours, et l'envoyait chercher elle-même « Réglages,
               * Abonnement » dans une application où elle n'est peut-être plus
               * connectée. C'est le moment de tout le cycle de vie où l'on a le
               * plus à perdre à demander un effort.
               */
              { bouton: { label: 'Choisir ma formule', url: f.lienReprise } },
              { titre: "Si vous préférez en rester là" },
              {
                p: "Vous n'avez rien à faire. À la fin de l'essai, Mino cesse d'encadrer les écrans, et vos données restent conservées si vous changez d'avis.",
              },
              { p: "L'équipe Mino" },
            ]
        : genre === 'appareil_manquant'
          ? /**
             * Le message le plus rentable des neuf, dit `cycle-de-vie.md`, et
             * il frappe là où la moitié des familles abandonnent.
             *
             * Une famille qui n'a relié aucun appareil n'a pas vu le produit :
             * Mino ne ferme rien, ne compte rien, n'encadre rien. Elle
             * s'éteindra au trentième jour sans que personne ne sache
             * pourquoi — et surtout sans que le parent ait jamais eu l'occasion
             * de juger ce qu'il a essayé.
             *
             * Trois lignes, le code, un chemin. Rien d'autre : ce n'est pas le
             * moment de parler d'abonnement.
             */
            [
              { p: `Bonjour${prenom},` },
              {
                p: "Votre famille est prête, mais aucun appareil n'a encore rejoint Mino. Tant que c'est le cas, rien ne peut être encadré : Mino verrouille les applications depuis le téléphone ou la tablette de votre enfant, pas d'ailleurs.",
              },
              { titre: 'Cinq minutes, une seule fois' },
              {
                p: "Installez Mino sur son appareil, choisissez « J'ai un code famille », et saisissez ce code :",
              },
              { code: f.familyCode },
              { bouton: { label: 'Installer Mino', url: 'https://minoapp.fr/telecharger' } },
              {
                p: "Si quelque chose bloque, répondez à ce message en le disant : on regarde et on vous répond.",
              },
              { p: "L'équipe Mino" },
            ]
        : genre === 'bouclier_inactif'
          ? /**
             * Le deuxième mur, et il est invisible.
             *
             * L'appareil est relié, l'application tourne, le compteur avance —
             * et rien ne se verrouille, faute d'autorisation système. Un parent
             * peut traverser tout son essai sans jamais avoir vu le produit,
             * puis conclure que Mino ne sert à rien. Il aura raison sur ce
             * qu'il a vu.
             */
            [
              { p: `Bonjour${prenom},` },
              {
                p: `L'appareil de ${enfant} est bien relié — mais Mino n'a pas encore le droit de verrouiller les applications. Le compteur tourne, et rien ne se ferme.`,
              },
              { titre: 'Une autorisation à donner, sur son appareil' },
              {
                p: "Ouvrez Mino sur l'appareil de votre enfant, allez dans Réglages puis « Blocage des applications », et suivez les deux écrans. C'est le système qui demande, pas nous — et c'est ce qui empêche votre enfant de le retirer.",
              },
              {
                p: "Sur Android, il y a deux accès distincts, dans deux écrans différents : l'accès aux données d'utilisation et la superposition d'écran. Le système ne les propose jamais ensemble.",
              },
              {
                p: "Tant que ce n'est pas fait, Mino compte le temps sans le faire respecter — c'est-à-dire qu'il ne fait pas ce pour quoi vous l'avez installé.",
              },
              { p: "L'équipe Mino" },
            ]
        : genre === 'paiement_echoue'
          ? /**
             * Factuel, immédiat, et surtout rassurant sur le seul point qui
             * inquiète : personne ne perd son compte pour une carte expirée.
             *
             * Le lien mène au portail Stripe, seul endroit où une carte se
             * remplace. Quand il n'y en a pas — rail boutique — on renvoie vers
             * les réglages du téléphone, parce qu'un lien mort à ce moment-là
             * ferait perdre un client qui voulait rester.
             */
            [
              { p: `Bonjour${prenom},` },
              {
                p: "Votre dernier paiement n'est pas passé. C'est presque toujours une carte expirée ou un plafond atteint, et cela se règle en une minute.",
              },
              { titre: 'Votre accès reste ouvert' },
              {
                p: "Nous ne coupons rien pendant que la banque réessaie. Vos enfants ne voient aucune différence, et vous ne perdez ni vos missions ni vos réglages.",
              },
              ...(f.lienCarte
                ? [{ bouton: { label: 'Mettre à jour ma carte', url: f.lienCarte } } as Bloc]
                : [
                    {
                      p: "Votre abonnement a été souscrit dans une boutique : le moyen de paiement se met à jour dans les réglages de votre téléphone, à la rubrique Abonnements.",
                    } as Bloc,
                  ]),
              { p: "L'équipe Mino" },
            ]
        : genre === 'au_revoir'
          ? /**
             * Confirmer sans retenir, puis poser **une** question.
             *
             * C'est la seule source d'information sur les raisons du départ :
             * aucun chiffre ne dit pourquoi quelqu'un s'en va. Un clic, quatre
             * réponses, rien à écrire. Et surtout aucune tentative de
             * rattrapage — une relance à cet instant transforme un départ
             * neutre en mauvais souvenir, et c'est celui-là qui se raconte.
             */
            [
              { p: `Bonjour${prenom},` },
              {
                p: f.finAcces
                  ? `C'est fait, votre abonnement est résilié. Vous gardez l'accès à tout Mino jusqu'au ${jour(f.finAcces)}, et rien ne sera prélevé ensuite.`
                  : "C'est fait, votre abonnement est résilié. Rien ne sera prélevé.",
              },
              {
                p: 'Vos données restent conservées. Si vous revenez un jour, les missions, les minutes et les réglages seront exactement là où vous les laissez.',
              },
              { titre: 'Une question, une seule' },
              {
                p: "Qu'est-ce qui n'a pas marché ? Un clic suffit, et ça nous aide vraiment.",
              },
              ...f.motifs.map((m) => ({ bouton: m }) as Bloc),
              { p: 'Merci d’avoir essayé Mino.' },
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

  /**
   * Les objets, en table plutôt qu'en cascade de ternaires.
   *
   * À trois genres la cascade se lisait ; à huit elle ne se lit plus, et c'est
   * précisément le genre d'endroit où l'on finit par accrocher un message au
   * mauvais objet sans que rien ne le signale.
   *
   * `enfant` commence par une majuscule quand il vient de la base, pas quand
   * c'est le repli « votre enfant » — et un objet qui démarre en minuscule a
   * l'air mal fabriqué avant même d'être ouvert.
   */
  const Enfant = `${enfant.charAt(0).toUpperCase()}${enfant.slice(1)}`;
  const SUJETS: Record<Genre, string> = {
    bienvenue: 'Bienvenue chez Mino 👋',
    fin_essai: 'Votre essai Mino se termine bientôt',
    reconduction: 'Votre abonnement Mino se renouvelle bientôt',
    reprise: `${Enfant} peut regagner son temps d’écran`,
    appareil_manquant: 'Il reste une étape : relier l’appareil de votre enfant',
    bouclier_inactif: 'Mino compte le temps, mais ne verrouille encore rien',
    paiement_echoue: 'Votre paiement n’est pas passé',
    au_revoir: 'Votre résiliation est enregistrée',
  };
  const sujet = SUJETS[genre];

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
  /**
   * À qui répond le bouton « Répondre ».
   *
   * Pour un signalement, c'est l'adresse du parent : sans elle, répondre à
   * notre propre boîte n'atteindrait personne, et il faudrait recopier une
   * adresse à la main en espérant ne pas se tromper.
   */
  repondreA?: string,
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
      replyTo: repondreA ?? Deno.env.get('MAIL_REPLY_TO') ?? env('MAIL_FROM'),
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
        .select('trial_ends_at, plan, current_period_end, customer_id, source')
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
  const q = encodeURIComponent(jeton);

  /**
   * Le portail Stripe, fabriqué seulement quand il servira.
   *
   * Il n'existe pas tant qu'aucun paiement n'a créé de client, et il n'a aucun
   * sens sur le rail boutique — où la carte se change dans les réglages du
   * téléphone. Un bouton « mettre à jour ma carte » qui n'ouvre rien, sur le
   * message qui annonce un échec de paiement, ferait perdre un client qui
   * voulait rester.
   */
  let lienCarte = '';
  if (genre === 'paiement_echoue' && abonnement?.customer_id && abonnement?.source === 'stripe') {
    lienCarte = await stripe()
      .billingPortal.sessions.create({
        customer: abonnement.customer_id as string,
        return_url: `${env('APP_URL')}/abonnement`,
      })
      .then((s) => s.url)
      .catch(() => '');
  }

  const { sujet, texte, html } = ecrire(genre, {
    parentName: (parent?.display_name as string | null) ?? null,
    email: destinataire,
    familyCode: (famille?.code as string) ?? '',
    childName: (enfants?.[0]?.first_name as string | undefined) ?? null,
    trialEndsAt: (abonnement?.trial_ends_at as string | null) ?? null,
    plan: (abonnement?.plan as string | null) ?? null,
    lienReprise: `${base}/reprendre?t=${q}`,
    lienStop: `${base}/stop?t=${q}`,
    lienCarte,
    finAcces:
      (abonnement?.current_period_end as string | null) ??
      (abonnement?.trial_ends_at as string | null) ??
      null,
    motifs: MOTIFS.map((m) => ({ label: m.label, url: `${base}/motif?t=${q}&r=${m.code}` })),
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
  const depuisJours = (jours: number) => new Date(maintenant - jours * 86_400_000).toISOString();
  const depuis = depuisJours;

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

  /**
   * J+1 — la famille existe, aucun appareil ne l'a rejointe.
   *
   * La fenêtre commence à 24 h : avant, le parent est peut-être encore en
   * train de le faire, et le presser serait grossier. Elle s'arrête à 4 jours
   * parce que `courriers` empêche déjà le doublon — une fenêtre large ne sert
   * qu'à rattraper une nuit où la tâche n'a pas tourné.
   */
  const { data: recentes } = await db
    .from('families')
    .select('id, created_at')
    .gte('created_at', depuisJours(4))
    .lte('created_at', depuisJours(1))
    .limit(500);

  const { data: appareils } = await db
    .from('family_devices')
    .select('family_id, shield_status')
    .limit(5000);

  const avecAppareil = new Set((appareils ?? []).map((d) => d.family_id as string));
  const sansAppareil = (recentes ?? []).filter((f) => !avecAppareil.has(f.id as string));

  /**
   * J+3 — l'appareil est relié, le bouclier ne l'est pas.
   *
   * `approved` est le seul état qui verrouille quoi que ce soit. Tout le reste
   * — refusé, jamais demandé, non pris en charge, ou pas encore rapporté —
   * décrit une famille qui croit être protégée et ne l'est pas.
   */
  const { data: relieesTot } = await db
    .from('families')
    .select('id, created_at')
    .gte('created_at', depuisJours(6))
    .lte('created_at', depuisJours(3))
    .limit(500);

  const bouclierVivant = new Set(
    (appareils ?? [])
      .filter((d) => d.shield_status === 'approved')
      .map((d) => d.family_id as string),
  );
  const sansBouclier = (relieesTot ?? []).filter(
    (f) => avecAppareil.has(f.id as string) && !bouclierVivant.has(f.id as string),
  );

  /** Le prélèvement qui a échoué, tant que la banque réessaie. */
  const { data: enEchec } = await db
    .from('subscriptions')
    .select('family_id')
    .eq('status', 'past_due')
    .limit(500);

  /**
   * La résiliation, lue dans le journal plutôt que sur le miroir.
   *
   * `subscriptions` ne garde pas la date de la décision — il porte l'état
   * courant, et `cancel_at_period_end` reste vrai pendant tout le mois qui
   * suit. C'est `billing_events` qui date le geste, et c'est lui qu'il faut
   * lire pour écrire au bon moment plutôt que trente fois de suite.
   */
  const { data: resiliations } = await db
    .from('billing_events')
    .select('family_id')
    .eq('kind', 'resiliation_demandee')
    .gte('occurred_at', depuisJours(2))
    .limit(500);

  const surStripe = (r: { source?: string | null }) => !r.source || r.source === 'stripe';
  const tournee: Array<{ familyId: string; genre: Genre }> = [
    ...(essais ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'fin_essai' as const })),
    ...(annuels ?? []).filter(surStripe).map((r) => ({ familyId: r.family_id as string, genre: 'reconduction' as const })),
    ...(partis ?? []).filter(perdue).map((r) => ({ familyId: r.family_id as string, genre: 'reprise' as const })),
    ...sansAppareil.map((f) => ({ familyId: f.id as string, genre: 'appareil_manquant' as const })),
    ...sansBouclier.map((f) => ({ familyId: f.id as string, genre: 'bouclier_inactif' as const })),
    ...(enEchec ?? []).map((r) => ({ familyId: r.family_id as string, genre: 'paiement_echoue' as const })),
    ...(resiliations ?? []).map((r) => ({ familyId: r.family_id as string, genre: 'au_revoir' as const })),
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

  const jeton = new URL(request.url).searchParams.get('t')!;
  const base = `${env('SUPABASE_URL')}/functions/v1/courrier`;
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
  if (abonnement && ['active', 'past_due', 'offert'].includes(String(abonnement.status))) {
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
    /**
     * **Et surtout pas l'écran de remerciement de l'application.**
     *
     * Celui-ci lit l'abonnement pour le confirmer, ce qui suppose une session
     * ouverte. Or ce parent-là arrive d'un lien d'e-mail précisément parce
     * qu'il n'est plus connecté : on lui aurait demandé de retrouver son mot
     * de passe juste après lui avoir pris son argent, c'est-à-dire au pire
     * moment possible.
     *
     * La page rendue ici ne demande rien et dit ce qu'il reste à faire.
     */
    success_url: `${base}/paye?t=${jeton}`,
    cancel_url: `${base}/reprendre?t=${jeton}`,
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

/**
 * Recueillir le motif d'un départ, en un clic.
 *
 * **Où il est écrit, et pourquoi pas dans une table à lui.** `billing_events`
 * est déjà le journal des faits de facturation, sa clé `stripe_event_id` est
 * unique, et c'est elle qui garantit qu'un parent qui reclique — ou dont la
 * messagerie précharge les liens — ne compte pas deux fois. Une table de plus
 * demanderait une migration pour ranger quatre valeurs.
 *
 * `motif:<famille>` comme clé : une réponse par famille, la première donnée.
 * Changer d'avis en cliquant un second bouton ne réécrit rien, et c'est
 * volontaire — la première réaction est la plus honnête.
 */
/**
 * Ce qu'on montre juste après un paiement venu d'un lien d'e-mail.
 *
 * Ni « connectez-vous », ni « retour à mon espace » : ce parent n'a pas de
 * session, c'est tout l'objet du parcours. On confirme, on donne le code
 * famille — la seule chose dont il ait besoin pour la suite — et on l'envoie
 * installer l'application là où elle sert.
 */
async function paye(request: Request): Promise<Response> {
  const familyId = await familleDuJeton(new URL(request.url).searchParams.get('t'));
  if (!familyId) {
    return page(
      'Merci !',
      'Votre paiement est enregistré. Ouvrez Mino, tout y est — et si quelque chose cloche, répondez à notre message.',
    );
  }

  const { data: famille } = await admin()
    .from('families')
    .select('code')
    .eq('id', familyId)
    .maybeSingle();

  const code = (famille?.code as string | undefined) ?? '';

  return page(
    'Merci, c’est en place',
    code
      ? `Votre abonnement est enregistré. Il reste à installer Mino sur l'appareil de votre enfant : choisissez « J'ai un code famille » et saisissez ${code}.`
      : "Votre abonnement est enregistré. Il reste à installer Mino sur l'appareil de votre enfant.",
    { label: 'Installer Mino', url: 'https://minoapp.fr/telecharger' },
  );
}

async function motif(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const familyId = await familleDuJeton(url.searchParams.get('t'));
  const choisi = MOTIFS.find((m) => m.code === url.searchParams.get('r'));

  if (!familyId || !choisi) {
    return page('Ce lien n’est plus valable', 'Répondez simplement à notre message, on lira.');
  }

  await admin()
    .from('billing_events')
    .upsert(
      {
        family_id: familyId,
        kind: 'motif_depart',
        status: choisi.code,
        stripe_event_id: `motif:${familyId}`,
        occurred_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true },
    );

  console.log('courrier motif', familyId, choisi.code);
  return page(
    'Merci, c’est noté',
    'C’est la seule façon qu’on ait de savoir ce qui ne va pas — aucun chiffre ne le dit. Si vous voulez en dire plus, répondez à notre message : quelqu’un le lit.',
  );
}


/**
 * Nous faire suivre un signalement, par e-mail.
 *
 * **Le défaut que cette route répare.** Les signalements arrivaient dans
 * `support_reports`, avec une vue nommée « ce qu'il faut regarder le matin ».
 * Rien ne prévenait personne : un parent bloqué à 21 h écrivait, recevait une
 * référence, et son message attendait dans une table que quelqu'un devait
 * penser à ouvrir. Un tableau de bord qu'il faut penser à consulter n'existe
 * pas les jours où on ne le consulte pas.
 *
 * **Le corps de l'e-mail vient de la BASE, jamais de la requête.** L'appelant
 * n'envoie qu'un identifiant ; la ligne est relue avec la clé de service. Sans
 * cette précaution, cette route serait un relais d'envoi ouvert à toute session
 * authentifiée — n'importe quel texte, vers notre boîte, à volonté.
 *
 * **Et on ne relaie que SES propres signalements** : `user_id = appelant`.
 * L'identifiant est un entier de séquence, donc trivial à deviner ; sans cette
 * clause, un appareil pourrait se faire relayer le signalement d'une autre
 * famille et en lire le contenu dans le rebond.
 *
 * Ouverte aux sessions d'appareil : c'est souvent la tablette de l'enfant qui
 * plante, et lui refuser la parole reviendrait à ne jamais entendre parler des
 * bugs du côté enfant — la même raison qui ouvre déjà `support_reports_insert`.
 */
async function signalement(request: Request): Promise<Response> {
  const qui = await appelant(request);
  if (!qui) return fail('Non authentifié.', 401);

  let corps: { id?: unknown };
  try {
    corps = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  const id = Number(corps.id);
  if (!Number.isInteger(id) || id <= 0) return fail('Signalement inconnu.', 400);

  const { data: ligne } = await admin()
    .from('support_reports')
    .select('id, kind, message, stack, reply_to, app_version, platform, os_version, route, repository, counts, fingerprint, created_at')
    .eq('id', id)
    .eq('user_id', qui.userId)
    .maybeSingle();

  if (!ligne) return fail('Signalement inconnu.', 404);

  const champs: [string, unknown][] = [
    ['Référence', ligne.fingerprint],
    ['Type', ligne.kind === 'crash' ? 'plantage' : 'écrit par un parent'],
    ['Répondre à', ligne.reply_to ?? '— aucune adresse laissée —'],
    ['Rôle', qui.role === 'device' ? 'appareil appairé' : 'compte parent'],
    ['Famille', qui.familyId],
    ['Version', ligne.app_version],
    ['Plateforme', `${ligne.platform}${ligne.os_version ? ' ' + ligne.os_version : ''}`],
    ['Écran', ligne.route ?? '—'],
    ['Stockage', ligne.repository ?? '—'],
    ['Compteurs', ligne.counts ? JSON.stringify(ligne.counts) : '—'],
    ['Reçu le', ligne.created_at],
  ];

  const echapper = (v: unknown) =>
    String(v ?? '—').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

  const texte = [
    ...champs.map(([k, v]) => `${k} : ${v ?? '—'}`),
    '',
    '--- message ---',
    ligne.message || '(vide)',
    ...(ligne.stack ? ['', '--- pile ---', ligne.stack] : []),
  ].join('\n');

  const html = [
    '<table style="border-collapse:collapse;font:14px system-ui">',
    ...champs.map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#667"><b>${echapper(k)}</b></td><td style="padding:2px 0">${echapper(v)}</td></tr>`,
    ),
    '</table>',
    `<p style="font:14px system-ui;white-space:pre-wrap;border-left:3px solid #4EB6FF;padding-left:12px">${echapper(ligne.message || '(vide)')}</p>`,
    ...(ligne.stack
      ? [`<pre style="font:12px ui-monospace;background:#f4f6fb;padding:12px;overflow:auto">${echapper(ligne.stack)}</pre>`]
      : []),
  ].join('');

  const boite = Deno.env.get('SUPPORT_MAIL') ?? 'contact@minoapp.fr';
  const objet = `[Mino] ${ligne.kind === 'crash' ? 'Plantage' : 'Signalement'} — ${String(ligne.message || '').slice(0, 60) || ligne.fingerprint}`;

  try {
    await envoyer(boite, objet, texte, html, typeof ligne.reply_to === 'string' ? ligne.reply_to : undefined);
  } catch (error) {
    // Jamais une erreur pour le parent : sa ligne est écrite, elle ne se perd
    // pas. C'est notre acheminement qui a manqué, et c'est à nous de le voir.
    console.error('signalement non relayé', id, error);
    return json({ relaye: false });
  }

  console.log('signalement relayé', id, ligne.fingerprint);
  return json({ relaye: true });
}

Deno.serve(servir(async (request) => {
  const route = new URL(request.url).pathname.replace(/^\/courrier\/?/, '');
  if (route === 'signalement') return await signalement(request);
  if (route === 'lot') return await lot(request);
  if (route === 'reprendre') return await reprendre(request);
  if (route === 'stop') return await stop(request);
  if (route === 'motif') return await motif(request);
  if (route === 'paye') return await paye(request);

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
