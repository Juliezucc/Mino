/**
 * La forme des identifiants et des codes — sans savoir d'où vient le hasard.
 *
 * **Pourquoi ce fichier existe.** `domain/id.ts` porte ces règles depuis
 * toujours, mais il tire ses octets d'`expo-crypto` : un module React Native,
 * qu'une fonction Edge ne peut pas importer. Le jour où le serveur a eu besoin
 * de créer une famille — l'inscription depuis le site — il aurait fallu
 * recopier l'alphabet, la longueur, le préfixe et l'échantillonnage par rejet.
 * Deux copies d'une même règle finissent toujours par diverger, et celle-ci
 * décide de ce qui sépare un inconnu d'une famille avec des enfants dedans.
 *
 * La règle vit donc ici, pure ; la source d'entropie est fournie par l'appelant.
 * `id.ts` lui passe celle d'`expo-crypto`, la fonction Edge celle de Deno.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Ce qui rend des octets aléatoires. `expo-crypto` côté application, `crypto` côté serveur. */
export type SourceDOctets = (taille: number) => Uint8Array;

function morceau(longueur: number): string {
  let out = '';
  for (let i = 0; i < longueur; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Un identifiant n'est pas un secret : ce qui protège une ligne, c'est la
 * politique RLS, jamais l'obscurité de sa clé. Le préfixe sert à lire les
 * journaux, l'horodatage à les trier.
 */
export function fabriquerId(prefixe: string): string {
  return `${prefixe}_${Date.now().toString(36)}${morceau(6)}`;
}

/** Ni I, ni O, ni 0, ni 1 : ces codes se lisent à voix haute et se retapent. */
const CARACTERES_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Un tirage sans biais dans un alphabet, à partir d'octets du système.
 *
 * Le rejet des octets qui dépassent le dernier multiple entier de la taille de
 * l'alphabet n'est pas de la coquetterie : un simple modulo favoriserait les
 * premières lettres, et un code deviné plus vite qu'annoncé n'est pas le code
 * annoncé. Avec les 32 caractères actuels, 256 est un multiple exact et rien
 * n'est jamais rejeté — mais le jour où quelqu'un ajoute une lettre, la
 * garantie tient toujours.
 */
export function fabriquerCode(longueur: number, octetsDe: SourceDOctets): string {
  const plafond = Math.floor(256 / CARACTERES_CODE.length) * CARACTERES_CODE.length;
  let out = '';
  while (out.length < longueur) {
    const octets = octetsDe(longueur * 2);
    for (const octet of octets) {
      if (octet >= plafond) continue;
      out += CARACTERES_CODE[octet % CARACTERES_CODE.length];
      if (out.length === longueur) break;
    }
  }
  return out;
}

/**
 * Le code qu'un parent montre pour qu'un appareil d'enfant rejoigne : MINO-7K2QX9.
 *
 * Six caractères, pas quatre. Ce code est la seule chose entre un inconnu et
 * une famille avec des enfants dedans : il doit être hors de portée d'une
 * recherche exhaustive. 32⁶ font environ un milliard de combinaisons, contre un
 * million pour quatre. Deux caractères de plus à taper, une fois, en échange.
 */
export function fabriquerCodeFamille(octetsDe: SourceDOctets): string {
  return `MINO-${fabriquerCode(6, octetsDe)}`;
}

/**
 * Le code de parrainage, délibérément distinct du code famille : l'un se
 * partage avec des inconnus, l'autre laisse un appareil rejoindre la famille.
 * Ils ne doivent jamais être la même chaîne — d'où l'absence de préfixe ici.
 */
export function fabriquerCodeParrainage(octetsDe: SourceDOctets): string {
  return fabriquerCode(6, octetsDe);
}
