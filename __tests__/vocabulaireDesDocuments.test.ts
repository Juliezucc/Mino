import { readFileSync } from 'node:fs';

/**
 * Un seul nom pour une fonctionnalité, dans tous les documents.
 *
 * **Le défaut, relevé par la session du site.** Les CGV et la politique de
 * confidentialité disaient « encadrement », la FAQ disait « blocage », et
 * l'écran de l'application s'appelle « Blocage des applications ». Trois mots
 * pour une seule chose, dans un paquet que le même parent lit d'un document à
 * l'autre.
 *
 * J'avais introduit « encadrement » pour ne pas sur-promettre sur Android, où
 * le mécanisme est une surimpression et non un verrou. C'était une mauvaise
 * réponse à une vraie question : changer de mot ne rend pas la description plus
 * exacte, il rend seulement les documents impossibles à rapprocher. La
 * précision se met dans la DESCRIPTION — et elle y est, plateforme par
 * plateforme. Le nom, lui, est celui de l'écran.
 *
 * C'est la règle des libellés de `CLAUDE.md`, appliquée aux documents.
 */
const DOCUMENTS = ['src/content/terms.ts', 'src/content/privacy.ts', 'src/content/faq.ts'];

/**
 * Les emplois légitimes, qui ne nomment pas la fonctionnalité.
 *
 * « encadrer un enfant » et « un transfert encadré par les clauses
 * contractuelles types » sont du français ordinaire ; « l'écran verrouillé »
 * est le nom que le téléphone se donne à lui-même. Les exclure nommément vaut
 * mieux qu'une expression régulière qui essaierait de deviner.
 */
const LEGITIMES = [
  'de l’expliquer et de l’encadrer',
  'le transfert est encadré par les clauses',
  'il est encadré par les clauses',
  'l’écran verrouillé',
];

/**
 * Les mots-clés de recherche sont ceux du LECTEUR, pas les nôtres.
 *
 * `keywords` existe pour attraper ce qu'un parent tape — « verrouiller »,
 * « bloque pas », « pin oublie », y compris de travers et sans accent. Les
 * soumettre à notre règle de vocabulaire reviendrait à appauvrir la recherche
 * au nom de la cohérence d'une prose qu'ils ne lisent pas.
 */
function proseSeule(source: string): string {
  return source.replace(/keywords:\s*\[[^\]]*\]/g, '');
}

function sansLesEmploisLegitimes(source: string): string {
  return LEGITIMES.reduce((texte, phrase) => texte.split(phrase).join(''), proseSeule(source));
}

describe('le nom de la fonctionnalité de blocage', () => {
  it.each(DOCUMENTS)('n’est ni « encadrement » ni « verrouillage » dans %s', (chemin) => {
    const texte = sansLesEmploisLegitimes(readFileSync(chemin, 'utf8'));
    expect(texte).not.toMatch(/encadr/i);
    expect(texte).not.toMatch(/verrouill/i);
  });

  it('est bien « blocage », et il est employé', () => {
    for (const chemin of DOCUMENTS) {
      expect(readFileSync(chemin, 'utf8')).toMatch(/bloc(age|quer|que|quées|quent)/i);
    }
  });
});

/**
 * Et aucun document ne promet ce que Mino ne tient pas sur les urgences.
 *
 * La FAQ affirmait « les appels d'urgence passent toujours, quoi qu'il
 * arrive » — la phrase exacte que les CGV venaient de corriger, dans le même
 * paquet. Notre code ne pose aucune exemption : sur iPhone, une application
 * Téléphone cochée est bloquée comme une autre. Ce qui reste ouvert appartient
 * au système, et nous ne pouvons pas nous en porter garants.
 */
describe('ce qu’on promet sur les appels d’urgence', () => {
  it.each(DOCUMENTS)('ne donne aucune garantie absolue dans %s', (chemin) => {
    const texte = readFileSync(chemin, 'utf8');
    expect(texte).not.toMatch(/quoi qu’il arrive/);
    expect(texte).not.toMatch(/ne les laissent bloquer par une application/);
  });
});
