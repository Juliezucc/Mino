import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
