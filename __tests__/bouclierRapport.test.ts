import { AppareilRapporte, aRegler, etatDe, phraseDe } from '@/domain/shieldReport';

/**
 * Le mode de panne le plus grave du produit, et la règle qui le referme.
 *
 * « Il FAUT le blocage » : c'est la promesse. Or le blocage peut mourir sur
 * l'appareil de l'enfant sans que le parent en sache rien — son propre écran
 * lit l'autorisation de SON téléphone, où tout va bien. Un bouclier mort dont
 * le parent ignore la mort est pire qu'un bouclier absent : il produit la
 * confiance sans la protection.
 *
 * Le piège est de ne regarder que le statut. Le contournement le plus efficace
 * ne produit jamais de « denied » : on désinstalle Mino, ou on ne l'ouvre plus,
 * et la dernière nouvelle reste éternellement « approved ». C'est le SILENCE
 * qu'il faut lire, et c'est ce que tient le test central ci-dessous.
 */

const T0 = new Date('2026-08-23T12:00:00Z');
const ilYA = (heures: number) => new Date(T0.getTime() - heures * 3_600_000).toISOString();

function appareil(over: Partial<AppareilRapporte> = {}): AppareilRapporte {
  return {
    id: 'dev-1',
    label: 'iPad de Malo',
    childId: 'enf-1',
    status: 'approved',
    seenAt: ilYA(1),
    joinedAt: ilYA(200),
    ...over,
  };
}

describe('l’état du bouclier vu du parent', () => {
  it('dit « actif » quand l’appareil vient de le confirmer', () => {
    expect(etatDe(appareil(), T0)).toBe('actif');
    expect(phraseDe(etatDe(appareil(), T0)).grave).toBe(false);
  });

  it('dit « coupé » quand l’autorisation a été retirée', () => {
    expect(etatDe(appareil({ status: 'denied' }), T0)).toBe('coupe');
    expect(phraseDe('coupe').grave).toBe(true);
  });

  it('UN APPAREIL QUI SE TAIT N’EST PAS UN APPAREIL PROTÉGÉ', () => {
    // Le cas qui compte. Dernière nouvelle : « tout va bien », il y a deux
    // semaines. Mino a été désinstallé le lendemain. Ne regarder que le statut
    // afficherait « blocage actif » pour toujours.
    const muet = appareil({ status: 'approved', seenAt: ilYA(24 * 14) });

    expect(etatDe(muet, T0)).toBe('muet');
    expect(phraseDe(etatDe(muet, T0)).grave).toBe(true);
  });

  it('laisse passer une absence ordinaire de deux jours', () => {
    // Une tablette laissée à la maison pendant un week-end n'est pas un
    // incident, et alerter là-dessus apprendrait au parent à ignorer les
    // alertes — ce qui est la seule façon de rendre celle du dessus inutile.
    expect(etatDe(appareil({ seenAt: ilYA(48) }), T0)).toBe('actif');
  });

  it('distingue « jamais réglé » de « vient d’arriver »', () => {
    const neuf = appareil({ status: null, seenAt: null, joinedAt: ilYA(2) });
    const oublie = appareil({ status: null, seenAt: null, joinedAt: ilYA(24 * 10) });

    expect(etatDe(neuf, T0)).toBe('inconnu');
    expect(phraseDe(etatDe(neuf, T0)).grave).toBe(false);

    // Dix jours après l'appairage sans un mot, ce n'est plus de la patience.
    expect(etatDe(oublie, T0)).toBe('muet');
    expect(phraseDe(etatDe(oublie, T0)).grave).toBe(true);
  });

  it('compte ce qui demande une intervention, et rien d’autre', () => {
    const parc = [
      appareil({ id: 'a' }),
      appareil({ id: 'b', status: 'denied' }),
      appareil({ id: 'c', seenAt: ilYA(24 * 9) }),
      appareil({ id: 'd', status: 'not-determined' }),
    ];

    expect(aRegler(parc, T0)).toBe(3);
    expect(aRegler([appareil()], T0)).toBe(0);
  });

  it('ne parle jamais de « révocation » ni d’« autorisation système »', () => {
    // Un parent n'a pas à traduire. Chaque phrase dit ce qui se passe et ce
    // qu'il peut faire, dans des mots qu'il emploie lui-même.
    for (const etat of ['actif', 'coupe', 'a-regler', 'muet', 'inconnu'] as const) {
      const { titre, detail } = phraseDe(etat);
      expect(`${titre} ${detail}`).not.toMatch(/révoqu|API|token|jeton|statut/i);
      expect(detail.length).toBeGreaterThan(30);
    }
  });
});

/**
 * Le téléphone d'un parent n'a rien à régler.
 *
 * **Le défaut, trouvé en suivant le parcours du second parent.** Son téléphone
 * s'appaire comme n'importe quel appareil et remontait donc son état de
 * bouclier : « pas encore réglé », puisqu'aucune autorisation n'y a jamais été
 * demandée — et il n'y en a aucune à demander, personne ne joue dessus. Le
 * tableau de bord de l'autre parent affichait un avertissement jaune
 * permanent, avec une consigne qui reviendrait à mettre le téléphone d'un
 * adulte derrière le bouclier.
 *
 * Un avertissement qui ne peut pas s'éteindre apprend à ignorer les autres, y
 * compris celui de la tablette où le blocage manque vraiment.
 */
describe('le téléphone d’un parent', () => {
  const vu = (status: string) => ({
    id: 'dev-1',
    label: 'iPhone de Marc',
    childId: null,
    status,
    seenAt: '2026-09-11T08:00:00.000Z',
    joinedAt: '2026-09-10T08:00:00.000Z',
  });
  const MAINTENANT = new Date('2026-09-11T09:00:00.000Z');

  it('n’est pas un appareil à régler', () => {
    expect(etatDe(vu('telephone-parent'), MAINTENANT)).toBe('telephone-parent');
    expect(phraseDe('telephone-parent').grave).toBe(false);
  });

  it('le dit dans ses mots, et pas dans ceux du compteur seul', () => {
    // « Vous avez choisi de ne pas verrouiller » serait faux : personne n'a
    // rien choisi, il n'y a simplement rien à verrouiller.
    expect(phraseDe('telephone-parent').detail).not.toMatch(/choisi/i);
    expect(phraseDe('telephone-parent').titre).not.toMatch(/compteur/i);
  });

  it('reste soumis au silence, comme tous les autres', () => {
    // Trois jours sans un mot restent trois jours sans un mot : l'état connu
    // ne survit pas à l'absence de nouvelles.
    const vieux = { ...vu('telephone-parent'), seenAt: '2026-09-01T08:00:00.000Z' };
    expect(etatDe(vieux, MAINTENANT)).toBe('muet');
  });
});
