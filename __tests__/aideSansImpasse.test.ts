import { FAQ } from '@/content/faq';
import { GUIDE, chapterById } from '@/content/guide';

/**
 * « Voir les étapes » ne doit jamais mener à un écran vide.
 *
 * **Le défaut, trouvé par Julie dans l'application publiée.** La FAQ renvoyait
 * vers trois chapitres de guide — `appareil-enfant`, `autres-ecrans`,
 * `blocage-applications` — dont AUCUN n'existait : le guide porte `installer`,
 * `console`, `blocage`. Zéro correspondance sur les trois.
 *
 * Et `app/guide/[id].tsx` rendait `null` sur un chapitre introuvable : pas de
 * titre, pas de bouton de retour, un rectangle bleu clair dont on ne sortait
 * que par le geste système. Une erreur de données devenue cul-de-sac.
 *
 * Les deux sont corrigés. Cet essai garde le lien entre les deux fichiers,
 * parce que c'est un lien que rien d'autre ne vérifie : renommer un chapitre
 * du guide ne casse aucun type, aucune compilation, et se voit seulement en
 * touchant le bouton sur un vrai téléphone.
 */
describe('les renvois de la FAQ vers le guide', () => {
  const renvois = FAQ.filter((e) => e.guide).map((e) => ({ id: e.id, guide: e.guide as string }));

  it('il y en a — sinon cet essai ne surveille rien', () => {
    expect(renvois.length).toBeGreaterThan(0);
  });

  it.each(renvois)('« $id » renvoie vers un chapitre qui existe : $guide', ({ guide }) => {
    expect(chapterById(guide)).toBeDefined();
  });

  it('et chaque chapitre nommé porte au moins une étape', () => {
    // Un chapitre vide rendrait un écran presque aussi muet que l'absence de
    // chapitre : le lecteur a touché « Voir les étapes » pour voir des étapes.
    for (const { guide } of renvois) {
      expect(chapterById(guide)?.steps.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('les identifiants du guide sont uniques', () => {
    const ids = GUIDE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
