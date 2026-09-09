// La signature d'une offre promotionnelle Apple.
//
// C'est ce qui permet de donner au parrain le mois promis quand il paie par
// l'App Store. Ni le report de la date d'essai ni l'avoir au solde client
// n'existent chez Apple : l'offre promotionnelle est le seul mécanisme, et
// elle exige une signature de notre serveur — sans quoi n'importe quelle
// application pourrait s'accorder des mois gratuits.

import { env } from './mino.ts';
import { chargerCleApple } from './store.ts';
import { chargeOffre } from '../../../src/domain/offrePromo.ts';

/** Ce que StoreKit attend pour appliquer l'offre à l'achat. */
export interface OffreSignee {
  identifier: string;
  keyIdentifier: string;
  nonce: string;
  signature: string;
  timestamp: number;
}

/**
 * Convertit la signature brute de Web Crypto au format qu'attend Apple.
 *
 * **Le piège, et il est muet.** `crypto.subtle.sign` rend 64 octets — `r` puis
 * `s`, format IEEE P1363. Apple attend du **DER** : une séquence ASN.1 de deux
 * entiers. Les deux sont des signatures parfaitement valides de la même chose ;
 * seule la seconde est acceptée. Envoyer la première ne produit aucune erreur
 * lisible — la feuille de paiement s'ouvre au plein tarif, comme si l'offre
 * n'existait pas, et le parent paie un mois qu'on lui avait promis gratuit.
 *
 * Les entiers ASN.1 sont signés : un octet de tête ≥ 0x80 se lirait comme un
 * nombre négatif, d'où le `0x00` ajouté devant. Et les zéros de tête inutiles
 * se retirent, sinon la longueur annoncée ne correspond plus.
 *
 * La longueur totale d'une signature P-256 ne dépasse jamais 70 octets : un
 * seul octet de longueur suffit, sans la forme longue du DER.
 */
function enDer(brute: Uint8Array): Uint8Array {
  const entier = (octets: Uint8Array): number[] => {
    let debut = 0;
    while (debut < octets.length - 1 && octets[debut] === 0) debut += 1;
    const valeur = Array.from(octets.slice(debut));
    if ((valeur[0] & 0x80) !== 0) valeur.unshift(0x00);
    return [0x02, valeur.length, ...valeur];
  };

  const corps = [...entier(brute.slice(0, 32)), ...entier(brute.slice(32, 64))];
  return Uint8Array.from([0x30, corps.length, ...corps]);
}

const base64 = (octets: Uint8Array) => btoa(String.fromCharCode(...octets));

/**
 * Signe l'offre promotionnelle pour une famille et une formule données.
 *
 * `appAccountToken` est le jeton que l'application transmet aussi à l'achat :
 * c'est lui qui relie l'offre à cette famille-là. Apple compare les deux, et
 * une offre signée pour quelqu'un d'autre est refusée — c'est ce qui empêche de
 * faire circuler une signature.
 */
export async function signerOffre(input: {
  productId: string;
  offerId: string;
  appAccountToken: string;
}): Promise<OffreSignee> {
  const keyId = env('APPLE_KEY_ID');
  const nonce = crypto.randomUUID();
  // En millisecondes, et Apple refuse une signature trop ancienne : elle se
  // demande au moment d'acheter, jamais à l'avance.
  const timestamp = Date.now();

  const charge = chargeOffre({
    bundleId: env('APPLE_BUNDLE_ID'),
    keyId,
    productId: input.productId,
    offerId: input.offerId,
    appAccountToken: input.appAccountToken,
    nonce,
    timestampMs: timestamp,
  });

  const brute = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      await chargerCleApple(),
      new TextEncoder().encode(charge),
    ),
  );

  return {
    identifier: input.offerId,
    keyIdentifier: keyId,
    nonce,
    signature: base64(enDer(brute)),
    timestamp,
  };
}
