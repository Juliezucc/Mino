import { canSwitchFreely, profileToOpen } from '@/data/deviceProfile';

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

  it('ne laisse changer de profil librement que sur un appareil partagé', () => {
    expect(canSwitchFreely({ lockedChildId: null, lastChildId: 'noah' })).toBe(true);
    expect(canSwitchFreely({ lockedChildId: 'noah', lastChildId: 'noah' })).toBe(false);
  });
});
