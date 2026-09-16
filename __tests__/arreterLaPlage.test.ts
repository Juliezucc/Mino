import * as actions from '@/domain/actions';
import { interromprePlage, reprendrePlage } from '@/domain/actions';
import { buildDemoFamily } from '@/data/demo';
import {
  FreeWindow,
  dansSonCreneau,
  estInterrompue,
  gestePlageLibre,
  jourLocal,
  openWindowAt,
  prochaineOuverture,
} from '@/domain/freeWindows';
import { FamilyData } from '@/domain/types';

/**
 * Arrêter la plage en cours — pour aujourd'hui, pas pour toujours.
 *
 * **Demandé par Julie après un test dans sa propre famille : « plage libre :
 * il faut que le parent puisse quand même arrêter quand il veut. Pas besoin de
 * compteur de temps d'écran, juste "enfant - arrêter". »**
 *
 * Le seul geste qui existait, `toggleFreeWindow`, suspend la plage POUR
 * TOUJOURS. Arrêter le mercredi après-midi une fois aurait éteint tous les
 * mercredis suivants, et personne ne retourne rallumer un réglage six jours
 * plus tard : le parent aurait perdu la fonctionnalité en s'en servant.
 *
 * D'où une DATE, qui se périme d'elle-même. Ce que ces essais tiennent : elle
 * ferme aujourd'hui, elle ne ferme que aujourd'hui, et elle ne ferme que ce
 * qu'elle doit.
 */
const MERCREDI_15H = new Date(2026, 8, 16, 15, 0); // 16 septembre 2026, un mercredi
const JEUDI_15H = new Date(2026, 8, 17, 15, 0);

const plage = (over: Partial<FreeWindow> = {}): FreeWindow => ({
  id: 'fw-1',
  familyId: 'fam',
  label: 'Mercredi après-midi',
  childIds: null,
  days: [3],
  startMinute: 14 * 60,
  endMinute: 16 * 60,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const famille = (fenetres: FreeWindow[]): FamilyData =>
  ({ freeWindows: fenetres }) as unknown as FamilyData;

describe('arrêter une plage libre pour la journée', () => {
  it('l’écran est ouvert tant que le parent n’a rien fait', () => {
    expect(openWindowAt([plage()], 'enf-1', MERCREDI_15H)).not.toBeNull();
  });

  it('et il se referme dès que le parent arrête', () => {
    const apres = interromprePlage(famille([plage()]), 'fw-1', MERCREDI_15H);
    expect(openWindowAt(apres.freeWindows!, 'enf-1', MERCREDI_15H)).toBeNull();
  });

  it('la semaine suivante, la plage est revenue toute seule', () => {
    // C'est toute la différence avec « Suspendre », et la raison d'une date.
    const apres = interromprePlage(famille([plage()]), 'fw-1', MERCREDI_15H);
    const mercrediSuivant = new Date(2026, 8, 23, 15, 0);
    expect(openWindowAt(apres.freeWindows!, 'enf-1', mercrediSuivant)).not.toBeNull();
    expect(apres.freeWindows![0].enabled).toBe(true);
  });

  it('un arrêt d’hier n’arrête rien aujourd’hui', () => {
    const hier = plage({ days: [3, 4], interruptedOn: jourLocal(MERCREDI_15H) });
    expect(openWindowAt([hier], 'enf-1', JEUDI_15H)).not.toBeNull();
  });

  it('le parent peut se raviser dans la foulée', () => {
    let data = interromprePlage(famille([plage()]), 'fw-1', MERCREDI_15H);
    data = reprendrePlage(data, 'fw-1');
    expect(openWindowAt(data.freeWindows!, 'enf-1', MERCREDI_15H)).not.toBeNull();
  });

  it('n’arrête que la plage visée', () => {
    const autre = plage({ id: 'fw-2', label: 'Devoirs finis', startMinute: 600, endMinute: 1200 });
    const data = interromprePlage(famille([plage(), autre]), 'fw-1', MERCREDI_15H);
    expect(openWindowAt(data.freeWindows!, 'enf-1', MERCREDI_15H)?.id).toBe('fw-2');
  });

  it('n’écrit rien au grand livre', () => {
    // La règle 1 des plages libres vaut aussi pour l'arrêt : arrêter n'est pas
    // dépenser. Le solde de l'enfant ne bouge pas d'un mino.
    const avant = { freeWindows: [plage()], transactions: [] } as unknown as FamilyData;
    const apres = interromprePlage(avant, 'fw-1', MERCREDI_15H);
    expect(apres.transactions).toBe(avant.transactions);
  });

  it('ne promet pas à l’enfant une réouverture qui n’aura pas lieu', () => {
    // « Ça rouvre à 14 h » dit à midi, alors que le parent a arrêté la plage du
    // jour, serait une promesse que rien ne tiendra. On annonce donc la
    // suivante — mercredi prochain — et pas celle de cet après-midi.
    const midi = new Date(2026, 8, 16, 12, 0);
    const arretee = plage({ interruptedOn: jourLocal(midi) });
    expect(prochaineOuverture([plage()], 'enf-1', midi)?.quand.getDate()).toBe(16);
    expect(prochaineOuverture([arretee], 'enf-1', midi)?.quand.getDate()).toBe(23);
  });
});

describe('ce que le parent voit sur son accueil', () => {
  it('la plage arrêtée reste visible tant que son heure n’est pas passée', () => {
    // Sans quoi le bouton « Reprendre » disparaîtrait avec l'arrêt lui-même,
    // et l'arrêt d'une touche n'aurait pas de retour.
    const arretee = plage({ interruptedOn: jourLocal(MERCREDI_15H) });
    expect(dansSonCreneau(arretee, MERCREDI_15H)).toBe(true);
    expect(estInterrompue(arretee, MERCREDI_15H)).toBe(true);
  });

  it('et disparaît quand l’heure est passée', () => {
    const dixSept = new Date(2026, 8, 16, 17, 0);
    expect(dansSonCreneau(plage(), dixSept)).toBe(false);
  });

  it('une plage nominative compte aussi comme « en cours »', () => {
    // `openWindowAt([plage], null)` répondait non pour une plage réservée à un
    // enfant : la pastille « OUVERTE » des réglages ne s'allumait jamais pour
    // celles-là, et l'accueil ne les aurait pas montrées non plus.
    const nominative = plage({ childIds: ['enf-1'] });
    expect(openWindowAt([nominative], null, MERCREDI_15H)).toBeNull();
    expect(dansSonCreneau(nominative, MERCREDI_15H)).toBe(true);
  });

  it('une plage suspendue n’est pas « en cours »', () => {
    expect(dansSonCreneau(plage({ enabled: false }), MERCREDI_15H)).toBe(false);
  });
});

/**
 * Ce que l'appareil de l'enfant fait du bouclier, à cet instant.
 *
 * Quatre cas, dont trois se sont révélés faux au premier essai — et aucun ne
 * se voit en relisant un écran. C'est pour eux que la décision est sortie du
 * magasin : ici, on peut la mettre dans chacun des quatre états.
 */
describe('le geste de l’appareil pendant une plage libre', () => {
  const rien = { fenetres: [], childId: null, levee: null, enfantsEnSeance: [] };

  it('lève le bouclier jusqu’à la fin de la plage', () => {
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [plage()],
      childId: 'enf-1',
      maintenant: MERCREDI_15H,
    });
    expect(geste).toEqual({ kind: 'ouvrir', fenetre: plage(), minutes: 60 });
  });

  it('le repose quand le parent arrête la plage', () => {
    const arretee = plage({ interruptedOn: jourLocal(MERCREDI_15H) });
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [arretee],
      childId: 'enf-1',
      levee: { id: 'fw-1', childId: 'enf-1' },
      maintenant: MERCREDI_15H,
    });
    expect(geste.kind).toBe('refermer');
  });

  it('ne repose rien si nous n’avions rien levé', () => {
    // Le cas d'un appareil qui démarre en dehors de toute plage : reposer le
    // bouclier serait sans effet au mieux, et couperait une séance au pire.
    const geste = gestePlageLibre({ ...rien, fenetres: [plage()], childId: 'enf-1' });
    expect(geste.kind).toBe('rien');
  });

  it('ne referme pas parce que le parent a ouvert son espace', () => {
    // LE PIÈGE. Le parent touche « Espace parent » sur la tablette, le profil
    // actif tombe à `null`, et une plage nominative cesse d'être « ouverte »
    // pour cet appareil — alors qu'elle n'a pas bougé. Sans ce cas, l'écran de
    // l'enfant se refermait au milieu du mercredi après-midi.
    const nominative = plage({ childIds: ['enf-1'] });
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [nominative],
      childId: null,
      levee: { id: 'fw-1', childId: 'enf-1' },
      maintenant: MERCREDI_15H,
    });
    expect(geste.kind).toBe('rien');
  });

  /**
   * **Le frère, et l'exemption qui allait trop loin.**
   *
   * L'essai juste au-dessus tient un cas réel : le parent ouvre son espace, la
   * plage n'a pas bougé, on ne referme pas. Mais la condition qui le tenait ne
   * posait aucune question sur le profil ACTIF — elle demandait seulement si
   * la plage restait ouverte pour l'enfant à qui on l'avait levée. Elle
   * couvrait donc aussi le cas où un autre enfant prend l'appareil.
   *
   * Le bouclier est global à l'appareil : un seul `ManagedSettingsStore` côté
   * iOS, une seule échéance côté Android, sans aucune notion d'enfant. Laisser
   * « rien » ici, c'est laisser à Noah les applications que le parent avait
   * bloquées pour lui, pendant une plage réservée à sa sœur — et son écran ne
   * lui annonce rien, puisque de son côté aucune plage n'est ouverte.
   *
   * C'est le blocage qui tombe, c'est-à-dire le produit.
   */
  it('referme quand c’est un AUTRE ENFANT qui prend la tablette', () => {
    const pourManon = plage({ childIds: ['enf-1'] });
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [pourManon],
      childId: 'enf-2', // Noah ouvre son profil
      levee: { id: 'fw-1', childId: 'enf-1' }, // le bouclier avait été levé pour Manon
      maintenant: MERCREDI_15H,
    });
    expect(geste.kind).toBe('refermer');
  });

  it('mais ne referme pas si c’est le même enfant qui revient', () => {
    // La plage lui est bien ouverte : le haut de la fonction répond « ouvrir »
    // avant même d'arriver à l'exemption. On le tient quand même, parce que
    // c'est cette distinction-là qui a été ajoutée.
    const pourManon = plage({ childIds: ['enf-1'] });
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [pourManon],
      childId: 'enf-1',
      levee: { id: 'fw-1', childId: 'enf-1' },
      maintenant: MERCREDI_15H,
    });
    expect(geste.kind).toBe('ouvrir');
  });

  it('laisse une séance en cours tenir l’écran', () => {
    // Le bouclier d'une séance appartient à `grant`/`revoke` : le reposer ici
    // prendrait à l'enfant des minutes qu'il a déjà payées.
    const arretee = plage({ interruptedOn: jourLocal(MERCREDI_15H) });
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [arretee],
      childId: 'enf-1',
      levee: { id: 'fw-1', childId: 'enf-1' },
      enfantsEnSeance: ['enf-1'],
      maintenant: MERCREDI_15H,
    });
    // Oublier, et non refermer : la plage est finie, mais ce n'est plus elle
    // qui tient l'écran ouvert.
    expect(geste.kind).toBe('oublier');
  });

  it('repose le bouclier quand la plage arrive à son heure de fin', () => {
    const seize = new Date(2026, 8, 16, 16, 0);
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [plage()],
      childId: 'enf-1',
      levee: { id: 'fw-1', childId: 'enf-1' },
      maintenant: seize,
    });
    expect(geste.kind).toBe('refermer');
  });

  it('et aussi quand le parent a supprimé la plage', () => {
    const geste = gestePlageLibre({
      ...rien,
      fenetres: [],
      childId: 'enf-1',
      levee: { id: 'fw-1', childId: 'enf-1' },
      maintenant: MERCREDI_15H,
    });
    expect(geste.kind).toBe('refermer');
  });
});


/**
 * Une demande née AVANT la plage, confirmée PENDANT.
 *
 * `startSession` refusait déjà de lancer une séance pendant une plage ouverte.
 * `approveSession` ne le faisait pas — et c'est pourtant là que le compteur
 * démarre vraiment. Manon demande 30 minutes à 13 h 50, la plage de 14 h n'est
 * pas encore ouverte, la demande passe légitimement. Le parent confirme à
 * 14 h 05 : trente minutes retirées, pendant un créneau où l'écran de l'enfant
 * annonce « tes minos ne bougent pas ».
 *
 * Et pour une séance supervisée, `grant` n'est jamais appelé : l'enfant payait
 * donc sans qu'aucun bouclier ne soit levé pour lui. L'écran n'était ouvert que
 * par la plage — ce que le produit promet de ne jamais faire payer.
 */
describe('confirmer une demande pendant une plage ouverte', () => {
  const avecPlage = (): FamilyData => {
    const base = buildDemoFamily(new Date('2026-09-16T09:00:00'));
    return {
      ...base,
      freeWindows: [
        {
          id: 'fw-mer',
          familyId: base.family.id,
          label: 'Mercredi après-midi',
          childIds: null,
          days: [3],
          startMinute: 14 * 60,
          endMinute: 16 * 60,
          enabled: true,
          createdAt: base.family.createdAt,
        },
      ],
    };
  };

  it('refuse, au lieu de débiter un temps qui ne coûte rien', () => {
    const data = avecPlage();
    const enfant = data.children[0];
    const treizeCinquante = new Date(2026, 8, 16, 13, 50);
    const demande = actions.startSession(
      data,
      { childId: enfant.id, minutes: 10 },
      treizeCinquante,
    );

    const quatorzeCinq = new Date(2026, 8, 16, 14, 5);
    if (demande.session.status !== 'requested') {
      // La famille de démonstration n'exige pas toujours l'accord : on force
      // l'état demandé, puisque c'est ce chemin-là qui nous intéresse.
      const forcee = {
        ...demande.data,
        sessions: demande.data.sessions.map((s) =>
          s.id === demande.session.id ? { ...s, status: 'requested' as const } : s,
        ),
      };
      expect(() =>
        actions.approveSession(forcee, { sessionId: demande.session.id }, quatorzeCinq),
      ).toThrow(/déjà ouvert/);
      return;
    }
    expect(() =>
      actions.approveSession(demande.data, { sessionId: demande.session.id }, quatorzeCinq),
    ).toThrow(/déjà ouvert/);
  });
});
