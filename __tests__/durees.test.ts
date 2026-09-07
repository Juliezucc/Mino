import { bornesPour, SEANCE_MINIMALE } from '@/domain/minos';

/**
 * Ce qu'un enfant peut réellement demander.
 *
 * L'écran proposait trois durées figées — 10, 20, 30 — filtrées par le solde.
 * Avec quinze minutes gagnées, seul « 10 » survivait, et les cinq autres
 * devenaient inatteignables : affichées, comptées, gagnées, indépensables
 * jusqu'à ce que le solde atteigne vingt.
 *
 * Corriger la liste ne suffisait pas — le principe était faux. Un solde est un
 * nombre quelconque, et un enfant qui a sept minutes doit pouvoir en prendre
 * sept. D'où un curseur, et d'où ces bornes.
 */
describe('les bornes du curseur de temps', () => {
  it('laissent prendre tout le solde, quel qu\'il soit', () => {
    // Le cas trouvé en conduisant le produit : 15 gagnées, 10 proposées.
    expect(bornesPour(15)).toEqual({ min: 5, max: 15 });
    expect(bornesPour(7)).toEqual({ min: 5, max: 7 });
    expect(bornesPour(120)).toEqual({ min: 5, max: 120 });
  });

  it('abaissent le plancher quand le solde est plus petit', () => {
    // Sans cette règle, un enfant avec trois minutes n'aurait de nouveau rien
    // à prendre : le défaut serait revenu, simplement déplacé plus bas.
    expect(bornesPour(3)).toEqual({ min: 3, max: 3 });
    expect(bornesPour(1)).toEqual({ min: 1, max: 1 });
    expect(SEANCE_MINIMALE).toBe(5);
  });

  it('ne proposent rien quand il n\'y a rien', () => {
    // Le repli affichait une pastille « 0 mino », qui invitait à démarrer une
    // séance vide.
    expect(bornesPour(0)).toBeNull();
    expect(bornesPour(-5)).toBeNull();
  });
});
