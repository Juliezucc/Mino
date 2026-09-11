import { ouvertureDeProfil } from '@/data/deviceProfile';

/**
 * Changer de profil sur l'appareil d'un enfant.
 *
 * **Le défaut que ces essais gravent.** Julie a demandé que le code parent
 * autorise à passer d'un enfant à l'autre sur un appareil réservé à l'un
 * d'eux. C'était écrit, et ça ne marchait pas : l'écran du code renvoyait au
 * sélecteur, `router.replace` remontait un sélecteur NEUF, et son effet de
 * montage rappelait `lockParent()` — effaçant le déverrouillage obtenu une
 * seconde plus tôt. Retoucher le profil redemandait le code. Indéfiniment, et
 * sans qu'un seul texte à l'écran n'explique le refus.
 *
 * La correction tient dans une donnée : le profil demandé VOYAGE avec la
 * demande de code, et le sélecteur termine le geste en revenant. C'est ce que
 * `ouvertureDeProfil` rend, et c'est pour cela qu'elle rend un objet là où un
 * booléen aurait suffi à décrire le refus.
 */
describe('ouvrir le profil d’un enfant', () => {
  const partage = { lockedChildId: null };
  const aManon = { lockedChildId: 'enf-manon' };

  it('s’ouvre sans rien demander sur la tablette partagée', () => {
    expect(ouvertureDeProfil(partage, 'enf-noah', false)).toEqual({ kind: 'ouvrir' });
  });

  it('s’ouvre sans rien demander sur le profil de l’enfant à qui l’appareil est réservé', () => {
    expect(ouvertureDeProfil(aManon, 'enf-manon', false)).toEqual({ kind: 'ouvrir' });
  });

  it('demande le code pour le profil d’un AUTRE enfant — et emporte lequel', () => {
    // La seconde moitié est tout le correctif : sans `ouvrir`, le sélecteur
    // remonté ne sait plus quel profil on venait de demander.
    expect(ouvertureDeProfil(aManon, 'enf-noah', false)).toEqual({
      kind: 'demander-le-code',
      ouvrir: 'enf-noah',
    });
  });

  it('ne redemande rien à un parent qui vient de taper son code', () => {
    expect(ouvertureDeProfil(aManon, 'enf-noah', true)).toEqual({ kind: 'ouvrir' });
  });
});
