import { readFileSync } from 'node:fs';

/**
 * Un champ numérique qui ne dit pas sa longueur ne se referme jamais.
 *
 * **Le défaut, rapporté deux fois par Julie, sur deux écrans.** Les claviers
 * numériques d'iOS n'ont aucune touche « Valider » : rien que des chiffres et
 * une flèche d'effacement, qui occupe en bas à droite la place exacte où la
 * main va chercher à valider. Le bouton à atteindre est sous le clavier, caché
 * par lui.
 *
 * `Field` referme donc le clavier quand le champ est PLEIN — mais il ne peut le
 * faire que si l'appelant a déclaré `maxLength`. Trois des quatre champs de
 * code de l'application ne le déclaraient pas, dont les deux de l'écran du
 * second parent : la correction ne les aurait pas atteints, et le défaut serait
 * revenu identique au build suivant.
 *
 * Cet essai lit les écrans, parce que c'est là que la déclaration manque.
 */
const ECRANS = [
  'app/join.tsx',
  'app/onboarding/account.tsx',
  'app/parent/compte.tsx',
  'src/features/parent/MissionForm.tsx',
];

/** Les champs `<Field …/>` d'un fichier, un par entrée. */
function champs(chemin: string): string[] {
  const source = readFileSync(chemin, 'utf8');
  return source.split('<Field').slice(1).map((bloc) => bloc.split('/>')[0]);
}

describe('les champs à clavier numérique', () => {
  it('déclarent tous leur longueur — sauf celui qui n’en a pas à déclarer', () => {
    for (const chemin of ECRANS) {
      for (const champ of champs(chemin)) {
        if (!champ.includes('number-pad')) continue;

        // Les minutes d'une mission n'ont pas de longueur fixe : 5, 15, 120.
        // Refermer au troisième chiffre couperait la saisie de « 120 ».
        const estUneDuree = /minutes|durée|duree/i.test(champ);
        if (estUneDuree) {
          expect(champ).not.toContain('maxLength');
          continue;
        }

        expect(champ).toContain('maxLength');
      }
    }
  });

  it('et `Field` referme bien le clavier quand le champ est plein', () => {
    const source = readFileSync('src/components/ui/Field.tsx', 'utf8');
    expect(source).toContain('Keyboard.dismiss()');
    expect(source).toContain('CLAVIERS_SANS_RETOUR');
    // La garde qui évite de couper une saisie ailleurs : seulement les claviers
    // sans touche retour, et seulement si une longueur est déclarée.
    expect(source).toContain("typeof maxLength === 'number'");
  });

  it('ne compte pas sur `returnKeyType`, qui ne peut rien ici', () => {
    // La première correction écrite l'a été sur `returnKeyLabel` — propre à
    // Android — et n'aurait rien fait sur l'iPhone de Julie. Un clavier
    // numérique iOS n'a pas de touche retour à décorer.
    const source = readFileSync('src/components/ui/Field.tsx', 'utf8');
    // La propriété, pas la prose : le commentaire du fichier la NOMME pour
    // expliquer pourquoi elle ne peut rien, et c'est très bien ainsi.
    expect(source).not.toMatch(/returnKeyLabel=/);
  });
});
