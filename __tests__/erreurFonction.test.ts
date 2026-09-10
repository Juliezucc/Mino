import { raisonDeLaFonction } from '@/data/erreurFonction';

/**
 * Ce qu'un parent lit quand une fonction Edge refuse.
 *
 * Le défaut d'origine tenait en une ligne : on relayait `error.message`, qui
 * est la phrase de `supabase-js` — « Edge Function returned a non-2xx status
 * code » — et jamais celle du serveur. Elle s'est affichée en rouge, en
 * anglais, sur le paywall et sur l'écran Abonnement.
 *
 * Ces essais tiennent les deux moitiés de la règle : le message français du
 * serveur doit remonter, et rien d'autre ne doit atteindre l'écran.
 */
describe('la raison rendue par une fonction Edge', () => {
  const erreurAvecCorps = (corps: unknown, jsonLeve = false) =>
    Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: {
        json: async () => {
          if (jsonLeve) throw new Error('body already consumed');
          return corps;
        },
      },
    });

  it('rend le message du serveur, pas celui de la bibliothèque', async () => {
    const dit = await raisonDeLaFonction(
      erreurAvecCorps({ error: 'Cet achat appartient à un autre compte.' }),
      'La vérification de l’achat n’a pas abouti.',
    );

    expect(dit).toBe('Cet achat appartient à un autre compte.');
  });

  it('ne laisse jamais passer la phrase anglaise de supabase-js', async () => {
    const repli = 'La vérification de l’achat n’a pas abouti.';

    // Sans contexte lisible : c'est le cas où l'ancien code affichait l'anglais.
    const sansContexte = await raisonDeLaFonction(
      new Error('Edge Function returned a non-2xx status code'),
      repli,
    );
    // Corps sans notre champ `error` : une passerelle, une page HTML, un 502.
    const corpsEtranger = await raisonDeLaFonction(erreurAvecCorps({ message: 'Bad Gateway' }), repli);
    // Corps déjà consommé : on est dans un chemin d'erreur, il n'en faut pas une seconde.
    const corpsIllisible = await raisonDeLaFonction(erreurAvecCorps(null, true), repli);

    for (const rendu of [sansContexte, corpsEtranger, corpsIllisible]) {
      expect(rendu).toBe(repli);
      expect(rendu).not.toContain('non-2xx');
    }
  });

  it('refuse un corps qui n’est plus une phrase', async () => {
    // Une trace ou une page entière n'est pas un message : elle ne s'affiche
    // pas à un parent, même si elle porte le bon nom de champ.
    const pave = 'x'.repeat(400);

    expect(await raisonDeLaFonction(erreurAvecCorps({ error: pave }), 'Repli.')).toBe('Repli.');
    expect(await raisonDeLaFonction(erreurAvecCorps({ error: '   ' }), 'Repli.')).toBe('Repli.');
  });
});
