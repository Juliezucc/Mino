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
