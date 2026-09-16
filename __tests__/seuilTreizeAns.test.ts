import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { suggestionsCommunes } from '@/domain/missionLibrary';
import { Child } from '@/domain/types';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

const enfant = (id: string, age: number): Child => ({
  id,
  familyId: 'fam',
  firstName: id,
  age,
  avatarKey: 'fox',
  createdAt: '2026-09-16T00:00:00.000Z',
});

/**
 * `TEEN_FROM = 13` décide de tout, et `CLAUDE.md` est catégorique : « toute
 * tranche d'âge, tout quiz, toute liste de suggestions qui enjambe 13 ans est
 * un défaut ». Un adolescent à qui l'on sert des confettis et une monnaie
 * appelée « minos » ferme l'application et ne la rouvre pas.
 *
 * Ces essais tiennent les trois endroits où le seuil était enjambé, et ils
 * n'ont rien de théorique : chacun se voyait à l'écran.
 */
describe('les suggestions de missions', () => {
  const petit = enfant('noah', 8);
  const grande = enfant('lea', 14);

  it('conviennent à l’enfant quand un seul est coché', () => {
    const pour = suggestionsCommunes([petit], [petit, grande]);
    expect(pour.length).toBeGreaterThan(0);
  });

  /**
   * **Le défaut : `picked.length === 1 ? picked[0] : null`.**
   *
   * Et `suggestionsFor(null, …)` n'applique AUCUN filtre d'âge. Cocher deux
   * enfants désactivait donc complètement le seuil : la rangée « Missions
   * prêtes à l'emploi » proposait « Mettre mon pyjama » — écrit pour 5 à 9 ans
   * — à attribuer à une adolescente de quatorze ans.
   */
  it('et à TOUS quand plusieurs le sont — c’est une intersection', () => {
    const communes = suggestionsCommunes([petit, grande], [petit, grande]);
    const pourLePetit = new Set(suggestionsCommunes([petit], [petit, grande]).map((s) => s.title));
    const pourLaGrande = new Set(suggestionsCommunes([grande], [petit, grande]).map((s) => s.title));

    for (const s of communes) {
      expect(pourLePetit.has(s.title)).toBe(true);
      expect(pourLaGrande.has(s.title)).toBe(true);
    }
  });

  it('et l’intersection est bien plus étroite que l’absence de filtre', () => {
    // Si les deux ensembles étaient identiques, l'essai ci-dessus ne prouverait
    // rien : on vérifie qu'il y a réellement quelque chose à écarter entre un
    // enfant de huit ans et une adolescente de quatorze.
    const communes = suggestionsCommunes([petit, grande], [petit, grande]).length;
    const sansFiltre = suggestionsCommunes([], [petit, grande]).length;
    expect(communes).toBeLessThan(sansFiltre);
  });
});

describe('le branchement du formulaire', () => {
  /**
   * La garde qui manquait à la garde. Les deux essais ci-dessus tiennent la
   * fonction du domaine — mais le défaut d'origine n'était pas dans le
   * domaine : il était dans la façon dont le FORMULAIRE l'appelait, avec un
   * `null` qui désactivait le filtre. Éprouver la fonction sans éprouver son
   * branchement, c'est exactement l'angle mort qui a laissé passer le défaut.
   */
  it('passe TOUS les enfants cochés, et pas seulement le premier', () => {
    const form = lire('src/features/parent/MissionForm.tsx');
    expect(form).toMatch(/suggestionsCommunes\(picked, children\)/);
    // L'ancienne forme, celle qui rendait `null` dès deux enfants cochés.
    expect(form).not.toMatch(/suggestionsFor\(child, siblings\)/);
  });
});

describe('le registre dans les écrans de l’enfant', () => {
  it('l’accueil ne félicite pas un adolescent comme un petit', () => {
    // « Bravo ! » n'était servi qu'en une seule version, quel que soit l'âge.
    const ecran = lire('app/child/(tabs)/index.tsx');
    const i = ecran.indexOf('Toutes tes missions sont faites');
    expect(i).toBeGreaterThan(0);
    // La branche qui précède doit interroger l'unité, comme partout ailleurs.
    expect(ecran.slice(i - 120, i)).toMatch(/unit === 'minos'/);
  });

  it('le sélecteur de profils annonce la même unité que ce qu’il affiche', () => {
    /**
     * Le libellé accessible disait « 35 minutes disponibles » à un enfant de
     * huit ans pendant que l'écran affichait « 35 minos » deux lignes plus
     * bas. Un enfant malvoyant entendait donc le mot que l'application s'est
     * interdit de lui dire.
     */
    const ecran = lire('app/who.tsx');
    expect(ecran).not.toMatch(/accessibilityLabel=\{`\$\{child\.firstName\}, \$\{minutes\} minutes/);
    const i = ecran.indexOf('accessibilityLabel={`${child.firstName}');
    expect(ecran.slice(i, i + 160)).toMatch(/unitOf\(child\)/);
  });
});
