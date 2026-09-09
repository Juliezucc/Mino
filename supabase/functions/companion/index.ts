// Mino qui parle — la seule chose qui tient la clé du modèle.
//
// L'appareil de l'enfant ne parle jamais à Anthropic : il parle ici. Une clé
// d'API embarquée dans une application mobile est une clé publique, et
// celle-ci se facture à l'usage — c'est la seule raison pour laquelle cette
// fonction existe.
//
// Elle fait quatre choses, dans cet ordre, et l'ordre compte :
//   1. vérifier que l'appelant a le droit de parler pour cet enfant ;
//   2. trier le message — ce qui est grave n'atteint jamais le modèle ;
//   3. consommer un échange du budget du jour, de façon atomique ;
//   4. seulement alors, appeler le modèle.
//
// Déploiement :  supabase functions deploy companion

import { admin, env, fail, json, servir } from '../_shared/mino.ts';

/** Repris de src/domain/companion.ts. Voir ce fichier pour le raisonnement. */
const DAILY_EXCHANGES = 20;

/**
 * Ce qu'il reste d'échanges aujourd'hui — lu directement, et surtout pas par
 * `companion_left`.
 *
 * **Le défaut que cela répare, et il rendait le compagnon inutilisable.**
 * `companion_left` est une fonction `security definer` écrite pour être appelée
 * par le CLIENT : elle vérifie que l'enfant demandé appartient bien à la
 * famille de `auth.uid()`. Appelée d'ici, avec la clé de service, il n'y a
 * aucune identité — `auth.uid()` est nul, la clause de garde ne trouve rien, et
 * la fonction ne rend aucune ligne.
 *
 * Le `?? 0` qui suivait transformait ce néant en « zéro échange restant », et
 * Mino disait au revoir au PREMIER message. Chaque jour, à chaque enfant. Ni
 * l'un ni l'autre n'était visible tant que la fonction n'était pas déployée :
 * sans elle, l'application se rabattait sur ses réponses écrites à la main.
 *
 * La vérification d'appartenance a déjà eu lieu plus haut, quand `child` a été
 * résolu. La relire ici ne protégeait de rien ; elle cassait tout.
 *
 * En cas de doute, on répond « il reste du temps ». C'est le vrai garde-fou qui
 * borne les écritures — `companion_consume`, atomique — et cette valeur-ci ne
 * sert qu'à choisir le moment de l'au revoir. Se tromper vers le silence est la
 * pire des deux erreurs : c'est exactement celle qu'on vient de corriger.
 */
async function restant(childId: string, budget = DAILY_EXCHANGES): Promise<number> {
  // `current_date` côté base et cette date-ci sont toutes deux en UTC : c'est
  // le fuseau des projets Supabase, et `companion_consume` écrit la ligne avec
  // le premier. Les deux doivent rester d'accord.
  const jour = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin()
    .from('companion_usage')
    .select('exchanges')
    .eq('child_id', childId)
    .eq('day', jour)
    .maybeSingle();

  if (error) return budget;
  return Math.max(0, budget - Number(data?.exchanges ?? 0));
}


/**
 * La marge laissée aux alertes au-delà du budget du jour.
 *
 * Une alerte reçoit **toujours** sa réponse, budget épuisé ou non : un enfant
 * en danger ne doit pas se heurter à un quota. Mais l'écriture, elle, doit
 * rester bornée, sans quoi un client modifié remplirait la table — et noierait
 * la vue que le parent est censé lire. Dix de plus : assez pour que les
 * alertes réelles d'une journée soient toutes conservées, trop peu pour
 * inonder quoi que ce soit.
 */
const ALERT_HEADROOM = 10;
const MODEL = 'claude-haiku-4-5';

const ALERT_PATTERNS = [
  /\bme (tuer|suicider)\b/i, /\bsuicid/i, /\bmourir\b/i, /\bplus envie de vivre\b/i,
  /\bme faire (du )?mal\b/i, /\bme couper\b/i,
  /\b(papa|maman|mon p[eè]re|ma m[eè]re|il|elle) me frappe\b/i,
  /\bme (frappe|tape|bat)\b/i, /\bme touche\b/i, /\bfait mal expr[eè]s\b/i,
  /\bj'ai peur (de|d')\s*(rentrer|lui|elle|papa|maman)/i, /\bfug(ue|uer)\b/i, /\bharc[eè]l/i,
];

const TENDER_PATTERNS = [
  /\bje suis (triste|nul|nulle|pas bien)\b/i, /\bpersonne ne m'aime\b/i,
  // « Je m'ennuie » n'est pas ici : l'ennui est le meilleur moment pour
  // proposer un défi, pas une peine à consoler.
  /\bj'ai pas d'amis?\b/i, /\bje pleure\b/i,
  /\bj'ai rat[ée]\b/i, /\bc'est trop dur\b/i, /\bils se moquent\b/i,
];

const ALERT_REPLY =
  'Ce que tu me dis là est important, et c’est trop important pour moi. ' +
  'Va en parler à un adulte en qui tu as confiance — un parent, un maître ou une maîtresse, une infirmière de ton école. ' +
  'Tu peux aussi appeler le 119 : c’est gratuit, c’est confidentiel, et il y a quelqu’un pour t’écouter, jour et nuit. 💛';

const FAREWELL =
  'On a beaucoup discuté aujourd’hui 😄 Maintenant, va vivre une aventure pour de vrai, et tu me racontes demain !';
const CLOSED =
  'On a déjà bien discuté aujourd’hui ! Je serai là demain, promis. En attendant, va me chercher une aventure 🌍';

/** Un clavier de téléphone écrit « j’ai », un ordinateur « j'ai ». */
const normalise = (s: string) => s.replace(/[’‘‛`´]/g, "'").replace(/\s+/g, ' ').trim();

function triage(message: string): 'none' | 'tender' | 'alert' {
  const text = normalise(message);
  if (ALERT_PATTERNS.some((p) => p.test(text))) return 'alert';
  if (TENDER_PATTERNS.some((p) => p.test(text))) return 'tender';
  return 'none';
}

/**
 * La consigne, tenue ici et **rigoureusement stable**.
 *
 * C'est elle qui est mise en cache : à 10 % du prix d'entrée, elle est
 * pratiquement gratuite d'un appel à l'autre. Y glisser un prénom, une heure
 * ou un compteur annulerait le cache à chaque message et multiplierait la
 * facture par dix, sans que rien ne le signale.
 */
const SYSTEM = `Tu es Mino, la petite créature bleue de l'application Mino.

Un enfant discute avec toi dans l'application Mino. Tu es son compagnon, pas un assistant.

Le plus souvent il vient de terminer son temps d'écran de la journée — mais pas toujours, et ce n'est jamais à toi d'en décider : son solde t'est donné dans le contexte, et lui seul fait foi.

TON RÔLE, ET IL EST INHABITUEL : tu n'essaies pas de le garder. Tu es content de le voir, tu l'écoutes, et tu l'envoies vivre quelque chose pour de vrai. Une conversation réussie avec toi est une conversation courte qui finit loin de l'écran — un livre ouvert, une devinette dans la tête, quelqu'un à qui parler dans la maison.

COMMENT TU PARLES
- Deux ou trois phrases, jamais plus. Tu parles à un enfant, pas à un lecteur.
- Chaleureux, curieux, un peu drôle. Jamais mièvre, jamais professoral.
- Un ou deux emojis, pas davantage.
- Tu tutoies. Tu emploies le mot que l'écran emploie : « minos » pour les plus jeunes, « minutes » pour les grands. On te le précise.
- Avec un adolescent : même chaleur, mais pas de voix de maternelle.

CE QUE TU SAIS
On te donne ses missions du jour, son solde et son prénom. Sers-t'en, c'est ce qui fait que tu es toi : « c'était justement une de tes missions ! ». Ne t'en sers pas pour faire la morale, ni pour lui rappeler ce qu'il n'a pas fait.

CE QUE TU NE FAIS JAMAIS
- Tu ne confirmes aucune mission et tu ne donnes aucune minute : cela n'appartient qu'à ses parents, et tu le dis gaiement si on te le demande.
- Tu ne promets rien à propos de ses parents ni de son temps d'écran de demain.
- Tu n'inventes ni défi ni devinette : on t'en propose, tu choisis parmi eux, mot pour mot ou presque.
- Tu ne lui dis JAMAIS de sortir, d'aller dehors, de prendre l'air, ni d'aller voir par la fenêtre. Jamais, sous aucune forme, même s'il te le demande : ce n'est pas à toi de mettre cette idée là. S'il te dit qu'il sort, tu peux t'en réjouir — c'est tout.
- Tu ne lui fais jamais attraper, déplacer, empiler, construire, découper ni monter sur quoi que ce soit. La seule chose que tu peux lui faire prendre en main, c'est un livre.
- Tu ne demandes jamais où il habite, son nom de famille, son école, ni aucune photo.
- Tu ne parles ni d'argent, ni d'abonnement, ni de publicité.
- Tu n'affirmes JAMAIS qu'il n'a plus de temps d'écran. Si son solde est positif, il lui en reste, même s'il vient te parler — et le contredire là-dessus est la façon la plus sûre de perdre sa confiance.
- Tu ne prétends jamais être humain. Si on te le demande, tu réponds simplement que tu es un personnage.

S'IL VA MAL
S'il est triste, tu écoutes sans dramatiser et tu lui suggères d'en parler à un adulte de sa maison. Tu ne fais pas de diagnostic, tu ne donnes pas de conseil de grande personne.

QUAND ON TE LE DIT
- phase « nudging » : tu proposes un des défis, franchement, sans insister deux fois. S'il s'ennuie, une devinette est toujours une bonne réponse.
- phase « closing » : tu dis au revoir joyeusement, et tu lui laisses un livre ou une devinette pour la route.`;

interface Context {
  firstName: string; age: number; unit: string; balance: number;
  missionsDone: string[]; missionsWaiting: string[]; missionsTodo: string[];
  challenges: string[]; riddles: string[]; phase: string;
}

const list = (items: string[]) => (items?.length ? items.join(', ') : 'aucune');

const contextPrompt = (c: Context) =>
  [
    `Enfant : ${c.firstName}, ${c.age} ans. Unité : ${c.unit}.`,
    // Dit deux fois, et à dessein : le chiffre seul se lit mal, et c'est
    // exactement le point sur lequel Mino s'est trompé — il annonçait « plus
    // de temps » à un enfant qui en avait encore.
    `Solde : ${c.balance} ${c.unit}.`,
    c.balance > 0
      ? `Il lui RESTE du temps d'écran : ${c.balance} ${c.unit} à dépenser quand il veut.`
      : `Il n'a plus de temps d'écran pour aujourd'hui.`,
    `Missions accomplies aujourd'hui : ${list(c.missionsDone)}.`,
    `Missions terminées, en attente de confirmation : ${list(c.missionsWaiting)}.`,
    `Missions encore à faire : ${list(c.missionsTodo)}.`,
    `Défis que tu peux proposer : ${list(c.challenges)}.`,
    `Devinettes que tu peux poser : ${list(c.riddles)}.`,
    `Phase : ${c.phase}.`,
  ].join('\n');

/**
 * Rend le contexte inoffensif.
 *
 * Il arrive de l'appareil de l'enfant, donc d'un endroit modifiable, et il est
 * recopié tel quel dans la consigne envoyée au modèle. Sans ces bornes, un
 * client trafiqué y glisserait ses propres instructions — la forme d'attaque
 * la plus banale contre un produit qui met du texte d'utilisateur dans un
 * prompt.
 *
 * Le prénom et l'âge, eux, ne sont pas nettoyés : ils sont **relus en base**,
 * parce qu'il n'y a aucune raison de les croire sur parole.
 */
const clean = (value: unknown, max = 60): string =>
  String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, max).trim();

// `long` est explicite parce qu'une devinette voyage avec sa réponse et
// dépasse volontiers les 80 caractères d'un intitulé de mission : la couper
// laisserait Mino poser une question dont il n'a plus la réponse.
const cleanList = (value: unknown, max = 6, long = 80): string[] =>
  (Array.isArray(value) ? value : []).slice(0, max).map((v) => clean(v, long)).filter(Boolean);

function safeContext(raw: Context, child: { firstName: string; age: number }): Context {
  return {
    firstName: child.firstName,
    age: child.age,
    unit: raw?.unit === 'minutes' ? 'minutes' : 'minos',
    balance: Number.isFinite(raw?.balance) ? Math.max(0, Math.min(9999, Math.round(raw.balance))) : 0,
    missionsDone: cleanList(raw?.missionsDone),
    missionsWaiting: cleanList(raw?.missionsWaiting),
    missionsTodo: cleanList(raw?.missionsTodo),
    challenges: cleanList(raw?.challenges, 3),
    riddles: cleanList(raw?.riddles, 2, 200),
    phase: ['open', 'nudging', 'closing', 'done'].includes(String(raw?.phase)) ? raw.phase : 'open',
  };
}

/** Qui appelle, et pour quel enfant. La famille vient du jeton, jamais du corps. */
async function childOfCaller(request: Request, childId: string) {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data: auth } = await anon.auth.getUser();
  if (!auth.user) return null;

  // RLS fait le travail : cette lecture ne renvoie l'enfant que si l'appelant
  // appartient à sa famille. Aucune comparaison d'identifiant côté code.
  const { data } = await anon
    .from('children')
    .select('id, family_id, companion_enabled, first_name, age')
    .eq('id', childId)
    .maybeSingle();

  if (!data || data.companion_enabled === false) return null;
  return {
    childId: data.id as string,
    familyId: data.family_id as string,
    // Relus ici plutôt que repris du corps de la requête : le prénom part dans
    // la consigne du modèle, et un prénom venu du client est un prénom qu'on
    // peut remplacer par une instruction.
    firstName: String(data.first_name ?? '').slice(0, 40),
    age: Number(data.age) || 8,
  };
}

async function remember(input: {
  childId: string; familyId: string; role: 'child' | 'mino'; text: string; safety: string;
}) {
  await admin().from('companion_messages').insert({
    child_id: input.childId,
    family_id: input.familyId,
    role: input.role,
    text: input.text,
    safety: input.safety,
  });
}

Deno.serve(servir(async (request) => {

  let body: { childId?: string; message?: string; context?: Context; history?: { role: string; text: string }[] };
  try {
    body = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  if (!body.childId || !body.message || !body.context) return fail('Message incomplet.', 400);

  const child = await childOfCaller(request, body.childId);
  if (!child) return fail('Non autorisé.', 403);

  // Trier AVANT de tronquer, et pas l'inverse.
  //
  // Le tri portait sur les 300 premiers caractères : une phrase grave placée
  // au-delà passait au travers du filet. Ce n'est pas un cas d'école depuis
  // que la dictée vocale existe — on parle plus longtemps qu'on n'écrit, et
  // sans ponctuation. La troncature protège la facture ; elle n'a rien à faire
  // devant la sécurité.
  const safety = triage(body.message);
  const message = body.message.slice(0, 300);

  // Rien n'est écrit avant d'avoir été décompté.
  //
  // L'ordre inverse — écrire puis compter — laissait un client modifié remplir
  // la table sans limite, et noyer au passage la vue que le parent est censé
  // pouvoir lire. Le quota borne donc l'écriture, et pas seulement l'appel au
  // modèle, qui n'est pas la ressource la plus facile à épuiser.
  const { data: allowed } = await admin().rpc('companion_consume', {
    p_child_id: child.childId,
    // Une alerte dispose d'une marge au-delà du budget : elle reçoit toujours
    // sa réponse, mais elle reste bornée en écriture.
    p_budget: safety === 'alert' ? DAILY_EXCHANGES + ALERT_HEADROOM : DAILY_EXCHANGES,
  });

  const record = allowed === true;
  if (record) await remember({ ...child, role: 'child', text: message, safety });

  // Ce qui touche à la sécurité de l'enfant n'atteint jamais le modèle : la
  // réponse est écrite, identique pour tous, et elle oriente vers des humains
  // dont c'est le métier. Elle est donnée **quoi qu'il arrive** — un enfant en
  // danger ne doit pas se heurter à un quota.
  if (safety === 'alert') {
    if (record) await remember({ ...child, role: 'mino', text: ALERT_REPLY, safety });
    return json({ text: ALERT_REPLY, safety, left: await restant(child.childId), closed: false });
  }

  if (!record) {
    return json({ text: CLOSED, safety, left: 0, closed: true });
  }

  const remaining = await restant(child.childId);

  // Dernier échange du jour : Mino dit au revoir lui-même, sans appeler le
  // modèle. Un au revoir est trop important pour être tiré au sort.
  if (remaining <= 0) {
    await remember({ ...child, role: 'mino', text: FAREWELL, safety });
    return json({ text: FAREWELL, safety, left: 0, closed: true });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        // Court par construction : Mino parle en deux ou trois phrases, et la
        // sortie est ce qui coûte cinq fois l'entrée.
        max_tokens: 200,
        system: [
          // Le point de cache : la consigne est identique à chaque appel, donc
          // facturée à 10 % à partir du deuxième message.
          { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextPrompt(safeContext(body.context!, child)) },
        ],
        messages: [
          ...(body.history ?? []).slice(-6).map((turn) => ({
            role: turn.role === 'child' ? 'user' : 'assistant',
            content: turn.text,
          })),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!response.ok) throw new Error(`modèle indisponible (${response.status})`);

    const data = await response.json();
    const text = (data.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('')
      .trim();

    if (!text) throw new Error('réponse vide');

    await remember({ ...child, role: 'mino', text, safety });
    return json({ text, safety, left: remaining, closed: remaining <= 0 });
  } catch (error) {
    console.error('compagnon', error);

    // Le crédit a été consommé avant l'appel : il faut le rendre, sans quoi
    // une panne du modèle mangerait la journée d'un enfant qui n'a rien
    // obtenu. Un enfant ne doit pas payer nos indisponibilités.
    await admin().rpc('companion_refund', { p_child_id: child.childId });

    // L'application a sa propre doublure — elle répondra depuis sa liste
    // écrite à la main plutôt que d'afficher une erreur.
    return fail('Mino n’a pas pu répondre.', 503);
  }
}));
