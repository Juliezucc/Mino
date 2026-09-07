import { dureesPour } from '@/domain/minos';

/**
 * Ce qu'un enfant peut réellement dépenser.
 *
 * L'écran proposait trois durées figées — 10, 20, 30 — filtrées par le solde.
 * Avec 15 minutes gagnées, seul 10 survivait, et les cinq autres devenaient
 * inatteignables : affichées, comptées, gagnées, indépensables jusqu'à vingt.
 *
 * Tout le produit repose sur une promesse tenue à la minute près. Un reliquat
 * qu'on ne peut pas prendre est une promesse retirée en silence — et l'enfant
 * qui compte s'en aperçoit avant nous.
 */
describe('les durées proposées à l’enfant', () => {
  it('permettent toujours de tout dépenser', () => {
    // Le cas trouvé en conduisant le produit : 15 gagnées, 10 proposées.
    expect(dureesPour(15)).toEqual([10, 15]);
    expect(dureesPour(45)).toEqual([10, 20, 30, 45]);
    expect(dureesPour(7)).toEqual([7]);
  });

  it('ne proposent jamais deux fois la même', () => {
    // Le solde tombant pile sur un palier ne doit pas produire « 30 et 30 ».
    expect(dureesPour(10)).toEqual([10]);
    expect(dureesPour(30)).toEqual([10, 20, 30]);
  });

  it('ne proposent rien quand il n’y a rien', () => {
    // Une puce « 0 mino » invitait à démarrer une séance vide.
    expect(dureesPour(0)).toEqual([]);
    expect(dureesPour(-5)).toEqual([]);
  });
});
