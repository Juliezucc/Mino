import { buildReport, fingerprint, redact, redactStack, referenceOf } from '@/domain/diagnostics';

/**
 * Ce fichier garde une frontière, pas une fonctionnalité. Un signalement est le
 * seul chemin par lequel du texte écrit par un parent quitte son téléphone :
 * ce qui suit vérifie qu'un prénom d'enfant ne peut pas l'emprunter.
 */

const context = { appVersion: '1.0.0', platform: 'ios', route: '/parent/(tabs)/index' };

describe('ce qui ne part pas', () => {
  it('retire les prénoms des enfants, quelle que soit la casse', () => {
    const text = redact('Camille ne voit pas sa mission et camille est triste', ['Camille']);

    expect(text).not.toMatch(/camille/i);
    expect(text).toBe('[enfant] ne voit pas sa mission et [enfant] est triste');
  });

  it('ne coupe pas un prénom au milieu d’un autre mot', () => {
    // « Léa » ne doit pas amputer « Léandre » ni « Léabelle ».
    expect(redact('Léandre a un souci', ['Léa'])).toBe('Léandre a un souci');
  });

  it('retire les adresses e-mail', () => {
    expect(redact('écrivez à julie@exemple.fr')).toBe('écrivez à [email]');
  });

  it('retire le code parent et le code famille', () => {
    expect(redact('mon code est 4821')).toBe('mon code est [code]');
    expect(redact('le code famille K7X2M9 ne marche pas')).toBe('le code famille [code] ne marche pas');
  });

  it('retire les chemins de la machine dans une pile d’appels', () => {
    const stack = 'Error: boom\n    at load (file:///Users/julie/Mino/src/data/repo.ts:12:5)';

    expect(redactStack(stack)).not.toContain('julie');
    expect(redactStack(stack)).toContain('repo.ts:12:5');
  });

  it('borne la pile : vingt lignes suffisent à corriger un bug', () => {
    const stack = Array.from({ length: 60 }, (_, i) => `    at frame${i} (a.ts:1:1)`).join('\n');

    expect(redactStack(stack).split('\n')).toHaveLength(20);
  });

  it('nettoie le message au montage, sans qu’on ait à y penser', () => {
    const report = buildReport({
      kind: 'manual',
      message: 'Noah a écrit à julie@exemple.fr',
      context,
      firstNames: ['Noah'],
    });

    expect(report.message).toBe('[enfant] a écrit à [email]');
  });
});

describe('le regroupement', () => {
  it('donne la même empreinte au même plantage', () => {
    const crash = (message: string) =>
      buildReport({ kind: 'crash', message: '', stack: `Error: ${message}\n at a (b.ts:1:1)`, context });

    expect(crash('boom').fingerprint).toBe(crash('boom').fingerprint);
  });

  it('sépare deux plantages différents', () => {
    const a = buildReport({ kind: 'crash', message: '', stack: 'Error: A\n at x', context });
    const b = buildReport({ kind: 'crash', message: '', stack: 'Error: B\n at x', context });

    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('sépare un même plantage entre deux versions', () => {
    const at = (appVersion: string) =>
      buildReport({ kind: 'crash', message: '', stack: 'Error: A\n at x', context: { ...context, appVersion } });

    // Sinon un bug corrigé continue de grossir le même groupe, et on ne voit
    // jamais qu'il a cessé.
    expect(at('1.0.0').fingerprint).not.toBe(at('1.1.0').fingerprint);
  });

  it('regroupe deux signalements écrits depuis le même écran', () => {
    const written = (message: string) => buildReport({ kind: 'manual', message, context });

    // Deux parents ne décrivent jamais un problème avec les mêmes mots.
    expect(written('ça marche pas').fingerprint).toBe(written('rien ne se passe').fingerprint);
  });

  it('produit une empreinte stable et courte', () => {
    expect(fingerprint(['a', undefined, 'b'])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('la référence donnée au parent', () => {
  it('se lit à voix haute au téléphone', () => {
    const report = buildReport({
      kind: 'manual',
      message: 'souci',
      context,
      now: new Date('2026-08-20T14:35:00.000Z'),
    });

    expect(referenceOf(report)).toMatch(/^MINO-[0-9A-F]{4}-\d{4}$/);
  });
});

/**
 * L'adresse à laquelle répondre, et le fait qu'elle survive au nettoyage.
 *
 * **Le défaut, trouvé par Julie en lisant l'écran.** Un parent bloqué écrivait,
 * recevait une référence, et attendait une réponse qui ne pouvait pas venir :
 * la table ne gardait que l'identifiant de session, et `redact` efface les
 * adresses du message — la règle protège l'adresse d'un tiers citée en
 * passant, et elle protégeait aussi le parent de toute réponse. Depuis la
 * tablette d'un enfant, l'identité est anonyme : il n'y avait même pas de
 * jointure possible.
 */
describe('à qui répondre', () => {
  const contexte = { appVersion: '1.0.5', platform: 'ios' as const };

  it('garde l’adresse donnée EXPRÈS, là où elle efface celles du texte', () => {
    const rapport = buildReport({
      kind: 'manual',
      message: 'Écrivez-moi à voisin@exemple.fr, ça ne marche pas',
      context: contexte,
      replyTo: 'julie@exemple.fr',
    });

    // Le message reste nettoyé : personne n'a demandé qu'on garde l'adresse
    // d'un tiers citée en passant.
    expect(rapport.message).not.toContain('voisin@exemple.fr');
    // Mais celle que le parent a donnée pour être joint, oui.
    expect(rapport.replyTo).toBe('julie@exemple.fr');
  });

  it('n’invente pas une adresse quand le parent n’en donne pas', () => {
    const rapport = buildReport({ kind: 'manual', message: 'ça bloque', context: contexte });
    expect(rapport.replyTo).toBeUndefined();
  });

  it('refuse ce qui n’a pas la forme d’une adresse', () => {
    // La colonne sert à écrire à quelqu'un : y ranger une phrase ferait croire
    // à une adresse au moment de répondre.
    for (const faux of ['pas une adresse', 'julie@', '@exemple.fr', 'julie@exemple']) {
      expect(buildReport({ kind: 'manual', message: 'x', context: contexte, replyTo: faux }).replyTo)
        .toBeUndefined();
    }
  });
});
