import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

/**
 * Sur le téléphone d'un parent, le premier geste est le CODE — pas « Passer à ».
 *
 * **Le défaut, relevé par Julie sur son propre iPhone.** L'accueil parent lui
 * proposait, en bouton bleu pleine largeur, « Passer à Raphaël » ; le code
 * famille tenait en petit texte gris dessous. Ses mots : « on ne doit pas voir
 * "passer à Raphaël" pour bloquer l'écran : c'est l'écran du parent ! On passe
 * pas au profil Raphaël, on va sur l'appareil de l'enfant ! »
 *
 * Elle a raison, et la hiérarchie était fondée sur une hypothèse devenue
 * fausse : « sur un appareil partagé, le cas le plus courant, l'enfant joue sur
 * celui-ci ». L'appareil sait depuis dire qu'il est celui d'un parent
 * (`choixEnregistre(device).kind === 'parent'`, posé à l'inscription ou dans
 * « À moi »). Là, aucun enfant ne joue : basculer sur le profil de son fils
 * l'emmène exactement là où il n'y a rien à régler.
 *
 * Rien dans les types ne relie l'écran à la carte : la prop a une valeur par
 * défaut, et l'oublier compile. C'est ce lien-là que cet essai tient.
 */
describe('la carte du premier pas', () => {
  const carte = lire('src/features/parent/FirstStepCard.tsx');
  const accueil = lire('app/parent/(tabs)/index.tsx');

  it('ne propose pas « Passer à… » sur le téléphone d’un parent', () => {
    // Le bouton n'existe que dans la branche « ce n'est pas le téléphone d'un
    // parent » : si quelqu'un le remonte hors du ternaire, l'essai tombe.
    const branche = carte.slice(carte.indexOf('{telephoneDuParent ?'));
    const bouton = branche.indexOf('Passer à ${premier.firstName}');
    const sinon = branche.indexOf(') : (');
    expect(sinon).toBeGreaterThan(0);
    expect(bouton).toBeGreaterThan(sinon);
  });

  it('y montre le code famille à la place', () => {
    expect(carte).toMatch(/\{telephoneDuParent \? \(\s*code\s*\) : \(/);
  });

  it('et ne montre jamais le code deux fois', () => {
    expect(carte).toMatch(/appareilDeLEnfant \|\| telephoneDuParent \? null : code/);
  });

  it('l’accueil parent le dit à la carte', () => {
    expect(accueil).toMatch(/choixEnregistre\(device\)\.kind === 'parent'/);
    expect(accueil).toMatch(/telephoneDuParent=\{telephoneDuParent\}/);
  });

  it('sur l’appareil d’un enfant, on n’explique pas comment installer Mino ici', () => {
    // On est dessus. La carte descend aussi sous « Vue d'ensemble » — c'est
    // l'autre appel, celui qui porte `appareilDeLEnfant`.
    expect(accueil).toMatch(/appareilDeLEnfant\s*\/?>/);
  });
});
