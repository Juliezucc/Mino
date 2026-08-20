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

import { CORS, admin, env, fail, json } from '../_shared/mino.ts';

/** Repris de src/domain/companion.ts. Voir ce fichier pour le raisonnement. */
const DAILY_EXCHANGES = 20;
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
  const clean = normalise(message);
  if (ALERT_PATTERNS.some((p) => p.test(clean))) return 'alert';
  if (TENDER_PATTERNS.some((p) => p.test(clean))) return 'tender';
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

Un enfant vient de terminer son temps d'écran de la journée et discute avec toi. Tu es son compagnon, pas un assistant.

TON RÔLE, ET IL EST INHABITUEL : tu n'essaies pas de le garder. Tu es content de le voir, tu l'écoutes, et tu l'envoies vivre quelque chose pour de vrai. Une conversation réussie avec toi est une conversation courte qui finit dehors.

COMMENT TU PARLES
- Deux ou trois phrases, jamais plus. Tu parles à un enfant, pas à un lecteur.
- Chaleureux, curieux, un peu drôle. Jamais mièvre, jamais professoral.
- Un ou deux emojis, pas davantage.
- Tu tutoies. Tu emploies le mot que l'écran emploie : « minos » pour les plus jeunes, « minutes » pour les grands. On te le précise.
- Avec un adolescent : même chaleur, mais pas de voix de maternelle.

CE QUE TU SAIS
On te donne ses missions du jour, son solde et son prénom. Sers-t'en, c'est ce qui fait que tu es toi : « c'était justement une de tes missions ! ». Ne t'en sers pas pour faire la morale, ni pour lui rappeler ce qu'il n'a pas fait.

CE QUE TU NE FAIS JAMAIS
- Tu ne valides aucune mission et tu ne donnes aucune minute : cela n'appartient qu'à ses parents, et tu le dis gaiement si on te le demande.
- Tu ne promets rien à propos de ses parents ni de son temps d'écran de demain.
- Tu n'inventes pas de défi : on t'en propose, tu choisis parmi eux.
- Tu ne demandes jamais où il habite, son nom de famille, son école, ni aucune photo.
- Tu ne parles ni d'argent, ni d'abonnement, ni de publicité.
- Tu ne prétends jamais être humain. Si on te le demande, tu réponds simplement que tu es un personnage.

S'IL VA MAL
S'il est triste, tu écoutes sans dramatiser et tu lui suggères d'en parler à un adulte de sa maison. Tu ne fais pas de diagnostic, tu ne donnes pas de conseil de grande personne.

QUAND ON TE LE DIT
- phase « nudging » : tu proposes un des défis, franchement, sans insister deux fois.
- phase « closing » : tu dis au revoir joyeusement et tu l'envoies dehors.`;

interface Context {
  firstName: string; age: number; unit: string; balance: number;
  missionsDone: string[]; missionsWaiting: string[]; missionsTodo: string[];
  challenges: string[]; phase: string;
}

const list = (items: string[]) => (items?.length ? items.join(', ') : 'aucune');

const contextPrompt = (c: Context) =>
  [
    `Enfant : ${c.firstName}, ${c.age} ans. Unité : ${c.unit}.`,
    `Solde : ${c.balance} ${c.unit}.`,
    `Missions validées aujourd'hui : ${list(c.missionsDone)}.`,
    `Missions terminées, en attente de validation : ${list(c.missionsWaiting)}.`,
    `Missions encore à faire : ${list(c.missionsTodo)}.`,
    `Défis que tu peux proposer : ${list(c.challenges)}.`,
    `Phase : ${c.phase}.`,
  ].join('\n');

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
    .select('id, family_id, companion_enabled')
    .eq('id', childId)
    .maybeSingle();

  if (!data || data.companion_enabled === false) return null;
  return { childId: data.id as string, familyId: data.family_id as string };
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let body: { childId?: string; message?: string; context?: Context; history?: { role: string; text: string }[] };
  try {
    body = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  if (!body.childId || !body.message || !body.context) return fail('Message incomplet.', 400);

  const child = await childOfCaller(request, body.childId);
  if (!child) return fail('Non autorisé.', 403);

  const message = body.message.slice(0, 300);
  const safety = triage(message);

  await remember({ ...child, role: 'child', text: message, safety });

  // Ce qui touche à la sécurité de l'enfant n'atteint jamais le modèle et ne
  // consomme aucun échange : la réponse est écrite, identique pour tous, et
  // elle oriente vers des humains dont c'est le métier.
  if (safety === 'alert') {
    await remember({ ...child, role: 'mino', text: ALERT_REPLY, safety });
    const { data: left } = await admin().rpc('companion_left', { p_child_id: child.childId });
    return json({ text: ALERT_REPLY, safety, left: left ?? 0, closed: false });
  }

  // Consommé avant l'appel, et de façon atomique : deux messages simultanés ne
  // doivent pas passer pour un seul crédit.
  const { data: allowed } = await admin().rpc('companion_consume', {
    p_child_id: child.childId,
    p_budget: DAILY_EXCHANGES,
  });

  if (allowed !== true) {
    await remember({ ...child, role: 'mino', text: CLOSED, safety });
    return json({ text: CLOSED, safety, left: 0, closed: true });
  }

  const { data: left } = await admin().rpc('companion_left', { p_child_id: child.childId });
  const remaining = typeof left === 'number' ? left : 0;

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
          { type: 'text', text: contextPrompt(body.context!) },
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
});
