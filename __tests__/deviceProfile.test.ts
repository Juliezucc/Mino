import {
  changementDeProfilLibre,
  choixEnregistre,
  etatsPourChoix,
  profileToOpen,
} from '@/data/deviceProfile';
import { usageDeLAppareil } from '@/domain/notifications';

const children = [{ id: 'noah' }, { id: 'elliott' }];

/**
 * À qui appartient cet appareil.
 *
 * Deux besoins qui tirent en sens inverse : ne pas faire se reconnecter un
 * enfant à chaque lancement, et empêcher qu'il prenne le profil de son frère —
 * dont les minos sont juste à côté, à une touche de son temps d'écran.
 */
describe('le profil de l’appareil', () => {
  it('rouvre sur le dernier profil, pour ne pas se reconnecter chaque jour', () => {
    expect(profileToOpen({ lockedChildId: null, lastChildId: 'elliott' }, children)).toBe('elliott');
  });

  it('ouvre toujours sur l’enfant auquel l’appareil est réservé', () => {
    // Même si quelqu'un est passé par un autre profil entre-temps.
    expect(profileToOpen({ lockedChildId: 'noah', lastChildId: 'elliott' }, children)).toBe('noah');
  });

  it('retombe sur le sélecteur quand l’enfant n’existe plus', () => {
    // Enfant supprimé, ou appareil rattaché à une autre famille : ouvrir sur un
    // profil disparu donnerait un écran vide sans rien expliquer.
    expect(profileToOpen({ lockedChildId: 'parti', lastChildId: null }, children)).toBeNull();
    expect(profileToOpen({ lockedChildId: null, lastChildId: 'parti' }, children)).toBeNull();
    expect(profileToOpen({ lockedChildId: null, lastChildId: null }, children)).toBeNull();
  });

  it('préfère le sélecteur au mauvais profil', () => {
    // Un verrou pointant dans le vide ne doit pas se rabattre en douce sur le
    // dernier profil utilisé : le parent a demandé un appareil réservé.
    expect(profileToOpen({ lockedChildId: 'parti', lastChildId: 'elliott' }, children)).toBe('elliott');
  });

  /**
   * Un appareil réservé rouvre toujours sur son enfant — c'est tout ce que le
   * réservage fait désormais.
   *
   * Il demandait aussi le code parent pour changer de profil. À l'usage, cela
   * produisait deux codes d'affilée : un pour atteindre le sélecteur, un autre
   * pour l'espace parent, que le sélecteur venait de reverrouiller. Changer de
   * profil ne se paie plus d'un code ; l'espace parent, si.
   */
  it('rouvre sur l’enfant réservé, quel que soit le dernier profil ouvert', () => {
    expect(profileToOpen({ lockedChildId: 'noah', lastChildId: 'elliott' }, children)).toBe('noah');
  });
});

/**
 * « À qui est cet appareil ? », et surtout : se tromper doit se rattraper.
 *
 * Le reproche numéro un de la recette. La question n'était posée qu'à
 * l'inscription, et les réglages n'écrivaient qu'un `lockedChildId` : un
 * parent qui avait répondu « c'est mon téléphone » le restait pour toujours,
 * y compris le jour où il donnait cette tablette à son enfant.
 *
 * Trois champs se déduisent de la réponse, et ils doivent s'écrire ensemble —
 * écrits séparément, ils se contredisent.
 */
describe('la réponse « à qui est cet appareil »', () => {
  it('se relit telle qu’elle a été donnée', () => {
    expect(choixEnregistre(etatsPourChoix({ kind: 'enfant', childId: 'noah' }))).toEqual({
      kind: 'enfant',
      childId: 'noah',
    });
    expect(choixEnregistre(etatsPourChoix({ kind: 'partage' }))).toEqual({ kind: 'partage' });
    expect(choixEnregistre(etatsPourChoix({ kind: 'parent' }))).toEqual({
      kind: 'parent',
      parentId: null,
    });
  });

  it('retient DE QUEL parent est ce téléphone', () => {
    // Sans cela, le téléphone du père salue la mère — « Bonjour Sylvain » sur
    // le téléphone de Vincent, vu à l'usage.
    const etats = etatsPourChoix({ kind: 'parent', parentId: 'par-vincent' });
    expect(etats.parentId).toBe('par-vincent');
    expect(choixEnregistre(etats)).toEqual({ kind: 'parent', parentId: 'par-vincent' });
  });

  it('se corrige : le téléphone du parent peut devenir celui de l’enfant', () => {
    // Le chemin qui n'existait pas. On part de « il est à moi » et on répond
    // autrement : aucun des trois champs ne doit rester sur l'ancienne réponse.
    const avant = etatsPourChoix({ kind: 'parent' });
    expect(avant).toEqual({
      lockedChildId: null,
      usagePersonnel: true,
      declareALEnfant: false,
      parentId: null,
    });

    const apres = etatsPourChoix({ kind: 'enfant', childId: 'noah' });
    expect(apres).toEqual({
      lockedChildId: 'noah',
      usagePersonnel: false,
      declareALEnfant: true,
      // Effacé : un téléphone qu'on donne à son enfant ne doit pas continuer
      // de porter le nom du parent.
      parentId: null,
    });
  });

  it('dit à qui le serveur écrit, sans que personne ait à le recalculer', () => {
    // `usageDeLAppareil` décide de la destination des notifications. Les deux
    // fonctions lisent les mêmes champs : elles ne peuvent pas diverger.
    expect(usageDeLAppareil(etatsPourChoix({ kind: 'parent' }))).toBe('parent');
    expect(usageDeLAppareil(etatsPourChoix({ kind: 'partage' }))).toBe('partage');
    expect(usageDeLAppareil(etatsPourChoix({ kind: 'enfant', childId: 'noah' }))).toBe('enfant');
  });

  it('laisse un enfant vérifier le code parent, jamais le choisir', () => {
    // `declareALEnfant` est ce que lit `parentGate` : vrai dès qu'un enfant se
    // sert de l'appareil, faux sur le seul cas où il n'y en a pas.
    expect(etatsPourChoix({ kind: 'enfant', childId: 'noah' }).declareALEnfant).toBe(true);
    expect(etatsPourChoix({ kind: 'partage' }).declareALEnfant).toBe(true);
    expect(etatsPourChoix({ kind: 'parent' }).declareALEnfant).toBe(false);
  });
});

/**
 * Changer de profil, et à quel prix.
 *
 * Le code disait « d'un enfant à l'autre : jamais de code ». C'est juste sur
 * la tablette du salon, où deux enfants se succèdent dix fois par jour — leur
 * demander quatre chiffres à chaque fois ferait taper le code devant eux. Ce
 * l'est beaucoup moins sur la tablette de Manon, où le profil de son frère, et
 * surtout ses minutes, se trouvaient à une touche.
 */
describe('changer de profil', () => {
  it('est libre sur un appareil partagé', () => {
    expect(changementDeProfilLibre({ lockedChildId: null })).toBe(true);
  });

  it('passe par le code parent sur l’appareil réservé à un enfant', () => {
    expect(changementDeProfilLibre({ lockedChildId: 'manon' })).toBe(false);
  });
});
