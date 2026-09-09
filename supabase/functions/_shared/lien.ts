// Les liens qu'on met dans un e-mail, et qui agissent sans mot de passe.
//
// **Le problème.** Un parent qui a laissé tomber en cours d'inscription ne se
// souvient plus de ses identifiants — c'est justement pour cela qu'il a laissé
// tomber. Lui écrire « reconnectez-vous pour vous abonner » revient à lui
// demander l'effort qui l'a fait renoncer. Le lien doit donc agir tout seul.
//
// **Ce qu'un tel lien ne doit jamais permettre**, et c'est ce qui décide de sa
// forme : ni lire les données d'une famille, ni ouvrir une session, ni deviner
// celui d'une autre famille. Ici il ne fait qu'une chose — ouvrir une page de
// paiement rattachée à une famille précise, ou cesser de lui écrire. Dans le
// pire des cas, quelqu'un paie pour une famille qui n'est pas la sienne.
//
// **La clé de signature.** Pas de secret supplémentaire à poser : on dérive la
// clé de `SUPABASE_SERVICE_ROLE_KEY`, qui ne quitte jamais le serveur. Un HMAC
// ne révèle rien de sa clé, et un secret de plus est un secret de plus à
// perdre, à faire fuiter, ou à oublier de renouveler.

import { env } from './mino.ts';

const encodeur = new TextEncoder();

/** Base64 pour URL : ni `+`, ni `/`, ni `=` — sans quoi le lien se casse au collage. */
function base64url(octets: Uint8Array): string {
  return btoa(String.fromCharCode(...octets))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function cle(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    encodeur.encode(`mino:lien:${env('SUPABASE_SERVICE_ROLE_KEY')}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signature(charge: string): Promise<string> {
  const brut = await crypto.subtle.sign('HMAC', await cle(), encodeur.encode(charge));
  return base64url(new Uint8Array(brut));
}

/**
 * Fabrique un jeton pour une famille, valable un temps donné.
 *
 * L'expiration est dans la charge signée : elle ne peut donc pas être
 * repoussée par celui qui tient le lien. Trente jours par défaut — assez pour
 * qu'un e-mail lu en retard fonctionne encore, assez peu pour qu'un lien
 * retrouvé dans une vieille boîte ne serve plus.
 */
export async function jetonLien(familyId: string, jours = 30): Promise<string> {
  const expire = Math.floor(Date.now() / 1000) + jours * 86_400;
  const charge = `${familyId}.${expire}`;
  return `${charge}.${await signature(charge)}`;
}

/**
 * Rend l'identifiant de famille, ou `null`.
 *
 * `null` pour une signature fausse comme pour un jeton périmé : l'appelant
 * n'a pas à distinguer les deux, et lui laisser la nuance donnerait à qui
 * essaie des jetons au hasard un moyen de savoir lesquels ont existé.
 */
export async function familleDuJeton(jeton: string | null): Promise<string | null> {
  if (!jeton) return null;
  const bouts = jeton.split('.');
  if (bouts.length !== 3) return null;

  const [familyId, expire, signe] = bouts;
  const charge = `${familyId}.${expire}`;

  const attendue = await signature(charge);
  // Comparaison de longueur constante : une comparaison qui s'arrête au
  // premier caractère différent laisse deviner la signature, octet par octet.
  if (attendue.length !== signe.length) return null;
  let ecart = 0;
  for (let i = 0; i < attendue.length; i += 1) ecart |= attendue.charCodeAt(i) ^ signe.charCodeAt(i);
  if (ecart !== 0) return null;

  if (Number(expire) * 1000 < Date.now()) return null;
  return familyId;
}
