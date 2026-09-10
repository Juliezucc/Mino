import {
  fabriquerCode,
  fabriquerCodeFamille,
  fabriquerCodeParrainage,
  fabriquerId,
} from '@/domain/identifiants';

/**
 * Ces règles servent maintenant deux exécutions : l'application, qui tire ses
 * octets d'`expo-crypto`, et la fonction Edge qui inscrit une famille depuis le
 * site, qui tire les siens de Deno. Un code famille fabriqué d'un côté doit
 * être reconnu de l'autre — d'où ces vérifications sur la forme, et non sur une
 * valeur.
 */

/** Une source d'octets prévisible : on vérifie la règle, pas le hasard. */
const octetsFixes = (valeurs: number[]) => {
  let i = 0;
  return (taille: number) => {
    const out = new Uint8Array(taille);
    for (let k = 0; k < taille; k += 1) {
      out[k] = valeurs[i % valeurs.length];
      i += 1;
    }
    return out;
  };
};

const octetsDuSysteme = (taille: number) => {
  const out = new Uint8Array(taille);
  crypto.getRandomValues(out);
  return out;
};

describe('les codes', () => {
  it('ne contiennent que des caractères qui se relisent à voix haute', () => {
    for (let essai = 0; essai < 200; essai += 1) {
      expect(fabriquerCode(6, octetsDuSysteme)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('ne rendent jamais I, O, 0 ni 1 — ils se confondent quand on les retape', () => {
    let vu = '';
    for (let essai = 0; essai < 200; essai += 1) vu += fabriquerCode(8, octetsDuSysteme);
    expect(vu).not.toMatch(/[IO01]/);
  });

  it('donnent la longueur demandée même si la source rend peu d’octets à la fois', () => {
    expect(fabriquerCode(10, () => new Uint8Array([0, 1, 2]))).toHaveLength(10);
  });

  it('rejettent les octets qui biaiseraient le tirage', () => {
    // 32 caractères : 256 est un multiple exact, donc rien n'est rejeté
    // aujourd'hui. Le plafond suit l'alphabet ; on vérifie qu'un octet au ras
    // du plafond retombe bien sur le premier caractère et pas ailleurs.
    expect(fabriquerCode(1, octetsFixes([0]))).toBe('A');
    expect(fabriquerCode(1, octetsFixes([32]))).toBe('A');
    expect(fabriquerCode(1, octetsFixes([31]))).toBe('9');
  });
});

describe('le code famille', () => {
  it('porte le préfixe MINO- et six caractères', () => {
    expect(fabriquerCodeFamille(octetsDuSysteme)).toMatch(
      /^MINO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
    );
  });

  it('reste hors de portée d’une recherche exhaustive', () => {
    // Six caractères sur 32, soit environ un milliard de combinaisons. Quatre
    // n'en feraient qu'un million : ce code est la seule chose entre un inconnu
    // et une famille avec des enfants dedans.
    const code = fabriquerCodeFamille(octetsDuSysteme).slice('MINO-'.length);
    expect(code.length).toBeGreaterThanOrEqual(6);
  });

  it('ne se répète pas d’un tirage à l’autre', () => {
    const tirages = new Set(
      Array.from({ length: 500 }, () => fabriquerCodeFamille(octetsDuSysteme)),
    );
    expect(tirages.size).toBe(500);
  });
});

describe('le code de parrainage', () => {
  it('fait six caractères, sans préfixe', () => {
    const code = fabriquerCodeParrainage(octetsDuSysteme);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('ne peut jamais être confondu avec un code famille', () => {
    // L'un se partage avec des inconnus, l'autre laisse un appareil rejoindre
    // la famille : ils ne doivent pas avoir la même forme.
    for (let essai = 0; essai < 100; essai += 1) {
      expect(fabriquerCodeParrainage(octetsDuSysteme).startsWith('MINO-')).toBe(false);
    }
  });
});

describe('les identifiants', () => {
  it('portent leur préfixe, pour qu’un journal se lise', () => {
    expect(fabriquerId('fam')).toMatch(/^fam_[a-z0-9]+$/);
    expect(fabriquerId('child')).toMatch(/^child_[a-z0-9]+$/);
  });

  it('ne se répètent pas dans la même milliseconde', () => {
    const tirages = new Set(Array.from({ length: 2000 }, () => fabriquerId('m')));
    expect(tirages.size).toBe(2000);
  });
});
