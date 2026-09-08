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

  it('trouve « à refaire » quand le parent tape « refuser »', () => {
    // La question ne porte plus le mot — le bouton s'appelle « À refaire » —
    // mais c'est celui que le parent tape. Les mots-clés existent pour ça, et
    // ce test est ce qui garantit qu'ils font leur travail.
    finds('comment refuser une mission', 'refuser-sans-vexer');
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

  /**
   * Une réponse nomme les boutons tels qu'ils s'appellent à l'écran.
   *
   * Une entrée disait « Comment refuser une mission ». Le bouton s'appelle
   * « À refaire », et il n'y en a aucun qui s'appelle « Refuser » : le parent
   * le cherche, ne le trouve pas, et écrit au support pour une fonction qui
   * existe. La FAQ avait alors créé le ticket qu'elle était censée éviter.
   *
   * Ce test ne bannit pas le verbe — « paiement refusé » et « code famille
   * refusé » sont les mots justes, et ils restent. Il ne refuse que les
   * tournures qui nomment une action sur une mission avec un mot qui n'est pas
   * sur le bouton. Et rien n'est vérifié dans `keywords` : ils ne s'affichent
   * nulle part, et c'est justement leur travail de rattraper l'écart entre le
   * mot du parent et celui de l'écran.
   */
  it('ne nomme jamais un bouton qui n’existe pas', () => {
    const inventes = /(refuser|valider|rejeter)\s+(une|la|cette|sa|les)?\s*mission/i;
    const refus = /\bun refus\b/i;

    for (const entry of FAQ) {
      const visible = `${entry.question} ${entry.answer}`.replace(/[’]/g, "'");
      expect(visible).not.toMatch(inventes);
      expect(visible).not.toMatch(refus);
    }
  });
});
