import { ISODate } from './types';

/**
 * Lire l'état du bouclier sur les appareils des enfants — silence compris.
 *
 * Ce fichier est pur, et c'est volontaire : la règle qu'il contient est la
 * seule chose qui sépare « Mino encadre la tablette de Malo » de « Mino croit
 * encadrer la tablette de Malo ». Elle mérite d'être testable sans appareil.
 *
 * LE POINT QUI SE RATE. On serait tenté de ne regarder que `status`, et de
 * n'alerter que sur `denied`. Mais le contournement le plus efficace ne
 * produit jamais de `denied` : Mino désinstallé, ou simplement plus jamais
 * ouvert, l'appareil se tait, et sa dernière nouvelle reste éternellement
 * « approved ». Le silence est le vrai signal — il faut donc le lire, et
 * c'est ce que fait `PERIME_HEURES`.
 *
 * Trois jours, et non trois heures : un enfant part en colonie, laisse sa
 * tablette à la maison, et son parent n'a pas à recevoir une alerte pour ça.
 * Trois jours sans que Mino s'ouvre une seule fois sur un appareil d'enfant,
 * en revanche, ne se produit pas par hasard.
 */
export const PERIME_HEURES = 72;

export type EtatBouclier = 'actif' | 'coupe' | 'a-regler' | 'muet' | 'inconnu';

export interface AppareilRapporte {
  id: string;
  label: string | null;
  childId: string | null;
  status: string | null;
  seenAt: ISODate | null;
  joinedAt: ISODate;
}

/**
 * L'état d'un appareil, tel qu'un parent doit le lire.
 *
 * L'ordre des cas n'est pas indifférent : le silence l'emporte sur le dernier
 * statut connu. Un appareil qui a dit « approved » il y a deux semaines n'est
 * pas un appareil protégé, c'est un appareil dont on ne sait rien.
 */
export function etatDe(appareil: AppareilRapporte, maintenant: Date = new Date()): EtatBouclier {
  if (!appareil.seenAt) {
    // Jamais un mot depuis l'appairage. S'il vient d'arriver, laissons-lui le
    // temps de se signaler ; passé le délai, c'est du silence comme un autre.
    return perime(appareil.joinedAt, maintenant) ? 'muet' : 'inconnu';
  }
  if (perime(appareil.seenAt, maintenant)) return 'muet';

  switch (appareil.status) {
    case 'approved':
      return 'actif';
    case 'denied':
      return 'coupe';
    case 'not-determined':
    case 'unavailable':
      return 'a-regler';
    default:
      return 'inconnu';
  }
}

function perime(quand: ISODate, maintenant: Date): boolean {
  const ecart = maintenant.getTime() - new Date(quand).getTime();
  return ecart > PERIME_HEURES * 3_600_000;
}

/**
 * Ce qu'on montre au parent, en une phrase et sans jargon.
 *
 * On ne dit jamais « autorisation révoquée » : un parent n'a pas à traduire.
 * On dit ce qui se passe et ce qu'il peut faire, et on nomme l'appareil par
 * l'enfant quand on le connaît — c'est ainsi qu'il le désigne lui-même.
 */
export function phraseDe(etat: EtatBouclier): { titre: string; detail: string; grave: boolean } {
  switch (etat) {
    case 'actif':
      return {
        titre: 'Blocage actif',
        detail: 'Les applications encadrées s’ouvrent avec le temps gagné, et pas autrement.',
        grave: false,
      };
    case 'coupe':
      return {
        titre: 'Blocage désactivé sur cet appareil',
        detail:
          'L’autorisation a été retirée dans les réglages du téléphone. Mino compte encore les minutes, mais il ne ferme plus rien. À réactiver depuis l’appareil, dans Réglages.',
        grave: true,
      };
    case 'a-regler':
      return {
        titre: 'Blocage pas encore réglé',
        detail:
          'L’appareil a rejoint la famille mais le blocage n’a jamais été autorisé. Ouvrez Mino dessus et suivez « Autoriser le temps d’écran ».',
        grave: true,
      };
    case 'muet':
      return {
        titre: 'Sans nouvelles depuis plusieurs jours',
        detail:
          'Mino ne s’est pas ouvert sur cet appareil depuis un moment. Tant qu’il reste muet, on ne peut pas affirmer que le blocage fonctionne encore.',
        grave: true,
      };
    default:
      return {
        titre: 'En attente d’un premier signe',
        detail: 'Cet appareil vient de rejoindre la famille. Ouvrez Mino dessus une première fois.',
        grave: false,
      };
  }
}

/** Combien d'appareils demandent une intervention. Zéro est la bonne réponse. */
export function aRegler(appareils: AppareilRapporte[], maintenant: Date = new Date()): number {
  return appareils.filter((a) => phraseDe(etatDe(a, maintenant)).grave).length;
}
