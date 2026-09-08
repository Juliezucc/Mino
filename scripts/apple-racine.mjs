#!/usr/bin/env node
/**
 * Récupère le certificat racine d'Apple et l'imprime en base64.
 *
 * `APPLE_ROOT_CA_G3_BASE64` est la racine avec laquelle le serveur vérifie la
 * chaîne de signature d'une transaction App Store. Sans elle, la
 * bibliothèque d'Apple refuse de valider quoi que ce soit — et la fournir
 * *fausse* serait pire que de ne pas la fournir : une chaîne mal validée
 * accepte n'importe quelle signature, donc n'importe quel achat inventé.
 *
 * D'où ce script plutôt qu'un copier-coller : télécharger un fichier binaire,
 * l'encoder en base64 à la main et le coller dans une commande, c'est trois
 * occasions de le tronquer sans que rien ne le signale.
 *
 * Usage :
 *   npm run apple:racine
 *
 * La sortie se recopie telle quelle :
 *   npx supabase secrets set APPLE_ROOT_CA_G3_BASE64=<la ligne imprimée>
 */

const URL_RACINE = 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer';

const reponse = await fetch(URL_RACINE).catch((e) => {
  console.error(`Téléchargement impossible : ${e.message}`);
  process.exit(1);
});

if (!reponse.ok) {
  console.error(`Apple a répondu ${reponse.status} sur ${URL_RACINE}`);
  console.error('');
  console.error("Si l'adresse a changé, le certificat se trouve sur");
  console.error('https://www.apple.com/certificateauthority/ — cherche');
  console.error('« Apple Root CA - G3 Root », au format .cer (DER).');
  process.exit(1);
}

const octets = new Uint8Array(await reponse.arrayBuffer());

/**
 * Un certificat DER commence par une séquence ASN.1 : 0x30, puis 0x82 pour une
 * longueur sur deux octets. Ce n'est pas de la superstition — une page
 * d'erreur HTML renvoyée avec un code 200 passerait sans ça, et on poserait
 * tranquillement du HTML en base64 dans la configuration du serveur.
 */
if (octets[0] !== 0x30 || octets[1] !== 0x82) {
  console.error("Ce qui a été téléchargé n'est pas un certificat DER.");
  console.error(`Premiers octets : ${[...octets.slice(0, 8)].map((b) => b.toString(16)).join(' ')}`);
  process.exit(1);
}

const base64 = Buffer.from(octets).toString('base64');

console.log('');
console.log(`Certificat récupéré : ${octets.length} octets, ${base64.length} caractères en base64.`);
console.log('');
console.log('À poser en secret Supabase :');
console.log('');
console.log(base64);
console.log('');
