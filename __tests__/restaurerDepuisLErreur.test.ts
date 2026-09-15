import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEJA_RATTACHE, inviteAChangerDeCompte } from '@/domain/billing';
import { RESTAURER, inviteARestaurer } from '@/services/billing/restauration';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

/**
 * Le message nomme un geste ; la carte doit porter ce geste.
 *
 * Trois messages de boutique disent au parent de toucher « Restaurer mes
 * achats ». Le bouton, lui, vivait tout en bas des deux écrans d'abonnement,
 * en ghost, après les formules et le bloc de réassurance — c'est-à-dire hors
 * de l'écran au moment précis où on venait de lui dire d'y toucher.
 *
 * Julie l'a rencontré pour de vrai : achat refusé parce qu'il appartenait à un
 * autre compte de boutique, et rien à faire de ce refus.
 */
describe('« Restaurer mes achats » quand l’erreur le réclame', () => {
  it('reconnaît les messages qui invitent à restaurer', () => {
    expect(inviteARestaurer(`Touchez « ${RESTAURER} ».`)).toBe(true);
    expect(inviteARestaurer('Vérifiez votre connexion et réessayez.')).toBe(false);
    expect(inviteARestaurer(null)).toBe(false);
    expect(inviteARestaurer('')).toBe(false);
  });

  it.each([
    ['le paywall de l’inscription', 'app/onboarding/abonnement.tsx', 'erreur'],
    ['l’écran Abonnement', 'app/parent/abonnement.tsx', 'error'],
  ])('%s met le bouton dans la carte d’erreur', (_nom, chemin, variable) => {
    const source = lire(chemin);
    expect(source).toMatch(new RegExp(`inviteARestaurer\\(${variable}\\)`));
    // Dans la carte, pas ailleurs : la condition et le bouton se suivent.
    const i = source.indexOf(`inviteARestaurer(${variable})`);
    expect(source.slice(i, i + 220)).toMatch(/label=\{RESTAURER\}/);
  });

  it('et les deux écrans nomment le bouton par la constante', () => {
    // Un libellé recopié qu'on retouche d'un seul côté rendrait la carte muette
    // le jour exact où elle sert.
    for (const chemin of ['app/onboarding/abonnement.tsx', 'app/parent/abonnement.tsx']) {
      expect(lire(chemin)).not.toMatch(/label="Restaurer mes achats"/);
    }
  });
});

/**
 * Le refus « déjà rattaché », sa mesure, et la porte qu'il doit ouvrir.
 *
 * **Vécu par Julie.** Elle avait résilié son abonnement, puis s'est vu
 * refuser : « connectez-vous avec ce compte […] ou résiliez-le ». On lui
 * prescrivait le geste qu'elle venait de faire — parce que résilier, chez
 * Apple, coupe le renouvellement sans rien terminer : l'abonnement court
 * jusqu'au dernier jour payé, et le statut reste `active` jusque-là.
 *
 * Et l'écran où elle lisait « connectez-vous avec ce compte » était le seul du
 * parcours d'où l'on ne pouvait pas se connecter.
 */
describe('« cet abonnement est déjà rattaché à un autre compte Mino »', () => {
  it('tient sous la limite au-delà de laquelle le message est JETÉ', () => {
    // 300 dans `raisonDeLaFonction` — et au-delà il n'est pas tronqué, il est
    // remplacé par « La vérification de l'achat n'a pas abouti », c'est-à-dire
    // par une phrase muette, au moment exact où elle sert.
    expect(DEJA_RATTACHE.length).toBeLessThanOrEqual(300);
  });

  it('dit que résilier ne détache pas tout de suite', () => {
    expect(DEJA_RATTACHE).toMatch(/résilier ne le détache pas tout de suite/);
    // Et ne promet plus de reprendre « alors », c'est-à-dire aussitôt.
    expect(DEJA_RATTACHE).not.toMatch(/vous pourrez alors reprendre/);
  });

  it('ne livre ni la famille détentrice, ni une date', () => {
    // Une date ferait d'un refus constant un oracle : qui détient un
    // identifiant de transaction interrogerait les échéances d'inconnus.
    expect(DEJA_RATTACHE).not.toMatch(/\d{4}|@|MINO-/);
  });

  it('n’invite pas à restaurer — ce serait le même refus', () => {
    expect(inviteARestaurer(DEJA_RATTACHE)).toBe(false);
    expect(inviteAChangerDeCompte(DEJA_RATTACHE)).toBe(true);
    expect(inviteAChangerDeCompte('La boutique n’a pas répondu.')).toBe(false);
    expect(inviteAChangerDeCompte(null)).toBe(false);
  });

  it('et la fonction Edge envoie ce texte-là, pas une copie', () => {
    const source = lire('supabase/functions/store-purchase/index.ts');
    expect(source).toMatch(/import \{ DEJA_RATTACHE, STATUTS_AVEC_BENEFICE \}/);
    expect(source).not.toMatch(/const DEJA_RATTACHE =/);
    // Les deux chemins de refus — avec et sans jeton de compte — le partagent.
    expect(source.match(/fail\(DEJA_RATTACHE, 403\)/g)).toHaveLength(2);
  });
});

describe('la sortie de l’écran d’abonnement', () => {
  it('le paywall de l’inscription porte « J’ai déjà un compte Mino »', () => {
    const source = lire('app/onboarding/abonnement.tsx');
    expect(source).toMatch(/label="J’ai déjà un compte Mino"/);
    expect(source).toMatch(/router\.push\('\/login'\)/);
  });

  it('… et il y mène aussi depuis la carte d’erreur', () => {
    const source = lire('app/onboarding/abonnement.tsx');
    const i = source.indexOf('inviteAChangerDeCompte(erreur)');
    expect(i).toBeGreaterThan(0);
    expect(source.slice(i, i + 260)).toMatch(/J’ai déjà un compte Mino/);
  });

  it('l’écran Abonnement mène aux réglages de la boutique', () => {
    // Le parent y est déjà connecté : ce qu'il lui manque, c'est la date de fin
    // que le message ne peut pas donner. Elle est chez Apple ou Google.
    const source = lire('app/parent/abonnement.tsx');
    const i = source.indexOf('inviteAChangerDeCompte(error)');
    expect(i).toBeGreaterThan(0);
    expect(source.slice(i, i + 260)).toMatch(/ouvrirGestion/);
  });

  it('et le bouton retour d’Android n’est plus refusé sous une page empilée', () => {
    // Sans quoi la sortie ajoutée ci-dessus déplacerait l'impasse au lieu de
    // la fermer : le paywall, invisible sous l'écran de connexion, continuait
    // d'intercepter le geste.
    const hook = lire('src/hooks/useRetourBloque.ts');
    expect(hook).toMatch(/useFocusEffect/);
    expect(hook).not.toMatch(/useEffect\(/);
  });
});
