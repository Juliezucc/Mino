import { FAQ } from '@/content/faq';
import { answerFor, normalize, searchFaq, tokenize } from '@/domain/support';

/**
 * Ces tests ne vérifient pas un algorithme, ils vérifient une promesse : les
 * questions que les parents posent vraiment trouvent leur réponse. Chaque cas
 * ci-dessous est une phrase telle qu'elle serait tapée, avec ses fautes.
 */

const finds = (query: string, id: string) => {
  const results = searchFaq(query);
  expect(results.map((r) => r.entry.id)).toContain(id);
};

describe('la saisie telle qu’elle arrive', () => {
  it('ignore les accents, la casse et la ponctuation', () => {
    expect(normalize('Temps d’écran')).toBe('temps d ecran');
    expect(normalize('BLOQUÉ !!')).toBe('bloque');
  });

  it('écarte les mots qui ne discriminent rien', () => {
    expect(tokenize('comment est-ce que je peux faire')).toEqual([]);
  });

  it('ramène le pluriel au singulier', () => {
    expect(tokenize('les applications bloquées')).toEqual(['application', 'bloquee']);
  });
});

describe('les questions que les parents posent', () => {
  it('trouve le blocage quand on écrit « ça bloque pas »', () => {
    finds('ça bloque pas', 'applis-ne-se-bloquent-pas');
  });

  it('trouve le code famille sans accent ni majuscule', () => {
    finds('ou est le code famille', 'ou-trouver-code-famille');
  });

  it('trouve la console quand on écrit le nom de la marque', () => {
    finds('switch', 'console-tv-ordinateur');
    finds('ps5', 'console-tv-ordinateur');
  });

  it('trouve l’annulation, la question la plus chère à ne pas répondre', () => {
    finds('je veux resilier', 'annuler');
  });

  it('trouve le code parent oublié', () => {
    finds('jai oublie mon code parent', 'code-parent-oublie');
  });

  it('trouve la géolocalisation quand un parent s’inquiète', () => {
    finds('est ce que vous localisez mon enfant', 'geolocalisation');
  });

  it('trouve le prix', () => {
    finds('combien ca coute', 'prix');
  });

  it('ne répond rien plutôt que n’importe quoi', () => {
    expect(searchFaq('xyzzy quelque chose sans rapport')).toHaveLength(0);
    expect(searchFaq('')).toHaveLength(0);
  });
});

describe('la réponse automatique', () => {
  it('tranche quand une entrée devance nettement les autres', () => {
    const answer = answerFor('parrainage');
    expect(answer?.entry.id).toBe('parrainage');
    expect(answer?.confidence).toBe('sure');
  });

  it('ne tranche pas quand deux réponses se valent', () => {
    // « mission » touche une dizaine d'entrées : trancher serait deviner.
    expect(answerFor('mission')?.confidence).toBe('maybe');
  });

  it('ne répond pas du tout quand rien ne correspond', () => {
    expect(answerFor('recette de gateau au chocolat')).toBeNull();
  });
});

describe('la base elle-même', () => {
  it('n’a pas deux entrées sous le même identifiant', () => {
    const ids = FAQ.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('donne à chaque entrée de quoi être trouvée', () => {
    for (const entry of FAQ) {
      expect(entry.keywords.length).toBeGreaterThanOrEqual(3);
      expect(entry.answer.length).toBeGreaterThan(40);
    }
  });

  it('retrouve chaque entrée par sa propre question', () => {
    // Le filet : une entrée que sa propre question ne trouve pas est une
    // entrée que personne ne trouvera jamais.
    for (const entry of FAQ) {
      const results = searchFaq(entry.question, FAQ, 3);
      expect(results.map((r) => r.entry.id)).toContain(entry.id);
    }
  });
});
