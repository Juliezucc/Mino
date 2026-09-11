import { TERMS } from '@/content/terms';
import type { Block } from '@/content/document';

/**
 * Le formulaire type de rétractation, ligne à ligne.
 *
 * **Ce que ce fichier garde.** Le texte est repris mot pour mot de l'annexe à
 * l'article R. 221-1 du code de la consommation, dans sa rédaction du décret
 * n° 2022-424 du 25 mars 2022. Sa mise en page fait partie du texte : les
 * champs se présentent l'un sous l'autre, dans cet ordre, et l'astérisque
 * renvoie à « rayez la mention inutile ». Un formulaire reflué en paragraphe
 * continu n'est plus le formulaire de l'annexe.
 *
 * **Le défaut a eu lieu, ailleurs.** La session du site rendait ce bloc dans
 * un `<p>` unique, où HTML écrase les retours à la ligne en espaces : le
 * formulaire sortait en une phrase continue. Sa vérification comparait le
 * texte échappé au texte échappé — elle confirmait donc ce qu'elle produisait,
 * et ne pouvait que réussir. Ici, `Text` de React Native honore les retours,
 * mais rien ne garantissait qu'ils restent dans la source.
 */
const LIGNES_DE_L_ANNEXE = [
  'MODÈLE DE FORMULAIRE DE RÉTRACTATION',
  '(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)',
  'Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :',
  'Commandé le (*)/reçu le (*) :',
  'Nom du (des) consommateur(s) :',
  'Adresse du (des) consommateur(s) :',
  'Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :',
  'Date :',
  '(*) Rayez la mention inutile.',
];

function blocs(): Block[] {
  return TERMS.sections.flatMap((s) => s.blocks);
}

function formulaire(): Extract<Block, { kind: 'form' }> {
  const bloc = blocs().find(
    (b): b is Extract<Block, { kind: 'form' }> =>
      b.kind === 'form' && b.text.includes('FORMULAIRE DE RÉTRACTATION'),
  );
  if (!bloc) throw new Error('le formulaire type n’est plus dans les conditions générales');
  return bloc;
}

describe('le formulaire type de rétractation', () => {
  it('est présent, et dans un bloc à lui', () => {
    // Pas un `note` : ce style est celui des avertissements, et un formulaire
    // n'est pas une emphase. Voir le commentaire de `Block`.
    expect(formulaire().kind).toBe('form');
  });

  it('porte chaque ligne de l’annexe, mot pour mot', () => {
    const texte = formulaire().text;
    for (const ligne of LIGNES_DE_L_ANNEXE) {
      expect(texte).toContain(ligne);
    }
  });

  it('garde ces lignes SÉPARÉES — c’est la moitié du formulaire', () => {
    const lignes = formulaire()
      .text.split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Chaque ligne de l'annexe est une ligne à elle seule, et non un fragment
    // noyé dans une phrase voisine.
    for (const attendue of LIGNES_DE_L_ANNEXE) {
      expect(lignes).toContain(attendue);
    }
  });

  it('les garde dans l’ORDRE de l’annexe', () => {
    const texte = formulaire().text;
    const rangs = LIGNES_DE_L_ANNEXE.map((l) => texte.indexOf(l));
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
  });

  it('nomme l’éditeur à qui la rétractation doit être adressée', () => {
    // L'annexe dit « le professionnel insère ici son nom, son adresse
    // géographique et son adresse électronique » : laisser le gabarit tel quel
    // rendrait le formulaire inutilisable.
    const texte = formulaire().text;
    expect(texte).toMatch(/À l’attention de .+/);
    expect(texte).not.toContain('le professionnel insère ici');
    expect(texte).toMatch(/@/);
  });
});
