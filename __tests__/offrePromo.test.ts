import { OFFRE_PARRAINAGE, SEPARATEUR, chargeOffre } from '@/domain/offrePromo';

/**
 * La seule partie de la chaîne des offres promotionnelles qu'on puisse
 * éprouver sans un iPhone, un abonné et un parrainage qualifié.
 *
 * Elle mérite des tests précisément pour cette raison : une charge mal
 * assemblée ne produit aucune erreur. La feuille de paiement d'Apple s'ouvre au
 * plein tarif, exactement comme si aucune offre n'existait, et le parent paie
 * un mois qu'on lui avait promis gratuit.
 */
describe('la charge signée d’une offre promotionnelle', () => {
  const champs = {
    bundleId: 'fr.minoapp.mino',
    keyId: 'J4G9S3LQNH',
    productId: 'mino.premium.yearly',
    offerId: 'parrainage_annuel',
    appAccountToken: 'A1B2C3D4-0000-0000-0000-000000000001',
    nonce: 'FFFFFFFF-1111-2222-3333-444444444444',
    timestampMs: 1_757_433_600_000,
  };

  it('assemble les sept champs dans l’ordre imposé par Apple', () => {
    expect(chargeOffre(champs).split(SEPARATEUR)).toEqual([
      'fr.minoapp.mino',
      'J4G9S3LQNH',
      'mino.premium.yearly',
      'parrainage_annuel',
      'a1b2c3d4-0000-0000-0000-000000000001',
      'ffffffff-1111-2222-3333-444444444444',
      '1757433600000',
    ]);
  });

  it('met en minuscules le jeton de compte et le nonce, et eux seuls', () => {
    // Apple reconstruit la chaîne de son côté en minuscules. Signer des
    // majuscules donne une signature valide… d'une autre chaîne, et l'offre est
    // refusée sans un mot. L'identifiant de clé, lui, est majuscule chez Apple
    // et doit le rester.
    const charge = chargeOffre(champs);
    expect(charge).toContain('J4G9S3LQNH');
    expect(charge).not.toContain('A1B2C3D4');
    expect(charge).not.toContain('FFFFFFFF');
  });

  it('sépare avec U+2063 et rien d’autre', () => {
    // Un espace, un point ou un tiret produiraient une chaîne parfaitement
    // lisible et parfaitement refusée.
    expect(SEPARATEUR.codePointAt(0)).toBe(0x2063);
    expect(chargeOffre(champs)).not.toContain(' ');
  });

  it('donne à chaque formule l’identifiant que porte la console', () => {
    // Les deux ne se ressemblent pas, et c'est imposé : App Store Connect
    // réserve un identifiant pour tout le groupe d'abonnements, à vie.
    expect(OFFRE_PARRAINAGE.monthly).toBe('parrainage');
    expect(OFFRE_PARRAINAGE.yearly).toBe('parrainage_annuel');
    // Aucun tiret : la console ne les accepte pas.
    for (const id of Object.values(OFFRE_PARRAINAGE)) {
      expect(id).toMatch(/^[A-Za-z0-9._]+$/);
    }
  });
});
