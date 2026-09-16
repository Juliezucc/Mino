import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sessionEndingSoon } from '@/domain/notifications';
import { Child } from '@/domain/types';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

const enfant = { id: 'enf-1', familyId: 'fam', firstName: 'Noah', age: 9 } as Child;

/**
 * « Plus que 5 minutes » doit arriver cinq minutes avant la fin.
 *
 * **Ce que faisait le code, et c'est pire que de ne rien envoyer.** Le magasin
 * annonçait l'avertissement au démarrage de la séance. La charge portait bien
 * un `inSeconds` juste. Mais `pousserAuxAutres` ne transmet pas ce champ, et
 * une notification poussée est remise TOUT DE SUITE : un enfant obtenait
 * trente minutes et son écran lui annonçait dans la seconde qu'il ne lui en
 * restait que cinq. Puis plus rien à la vingt-cinquième.
 *
 * Et lorsqu'il lançait lui-même la séance, la fonction Edge `notify` écarte
 * l'appareil appelant : il ne recevait strictement rien, ni au début ni à la
 * fin.
 *
 * Deux textes publiés le promettaient pourtant — `faq.ts` (« L'enfant reçoit
 * un avertissement cinq minutes avant ») et l'écran Réglages du parent.
 *
 * La correction tient en une idée : **une notification à retardement ne peut
 * pas voyager par une notification poussée.** Elle se programme, donc sur
 * l'appareil où elle doit sonner — celui de l'enfant.
 */
describe('le calcul du délai', () => {
  it('vise cinq minutes avant la fin, et pas l’instant présent', () => {
    const maintenant = new Date('2026-09-16T14:00:00Z');
    const fin = new Date('2026-09-16T14:30:00Z').toISOString();
    const charge = sessionEndingSoon(enfant, fin, maintenant);
    expect(charge).not.toBeNull();
    // 30 min de séance − 5 min de préavis = 25 min d'attente.
    expect(charge!.inSeconds).toBe(25 * 60);
    expect(charge!.audience).toBe('child');
    expect(charge!.kind).toBe('session.endingSoon');
  });

  it('ne dit rien pour une séance plus courte que le préavis', () => {
    // Sonner à l'instant où l'écran s'ouvre ne serait que du bruit.
    const maintenant = new Date('2026-09-16T14:00:00Z');
    const fin = new Date('2026-09-16T14:04:00Z').toISOString();
    expect(sessionEndingSoon(enfant, fin, maintenant)).toBeNull();
  });
});

describe('qui porte l’avertissement', () => {
  const magasin = lire('src/store/useMinoStore.ts');
  const layout = lire('app/child/_layout.tsx');

  it('le magasin ne l’annonce plus : il partirait par le serveur, donc tout de suite', () => {
    expect(magasin).not.toMatch(/announce\(notify\.sessionEndingSoon/);
  });

  it('la demande, elle, part toujours du magasin', () => {
    // Celle-là doit bien arriver tout de suite : le parent l'attend.
    expect(magasin).toMatch(/announce\(notify\.sessionRequested/);
  });

  it('l’appareil de l’enfant le programme quand une séance tourne', () => {
    expect(layout).toMatch(/useRunningSession\(activeChildId\)/);
    expect(layout).toMatch(/notify\.sessionEndingSoon\(/);
    expect(layout).toMatch(/service\.schedule\(charge\)/);
  });

  it('et il l’annule si la séance s’arrête avant l’heure', () => {
    // Sans quoi l'avertissement sonnerait dans le vide, après coup.
    expect(layout).toMatch(/service\.cancel\(/);
  });

  /**
   * La garde qui explique POURQUOI cet effet vit dans l'écran et non dans le
   * magasin : `approveSession` s'exécute sur le téléphone du parent. Un envoi
   * programmé depuis là sonnerait sur le mauvais appareil, et chez le mauvais
   * destinataire — la charge porte pourtant `audience: 'child'`.
   */
  it('approveSession n’annonce rien, parce qu’il tourne chez le parent', () => {
    const i = magasin.indexOf('async approveSession(');
    expect(i).toBeGreaterThan(0);
    expect(magasin.slice(i, i + 700)).not.toMatch(/announce\(/);
  });
});

describe('le champ qui se perdait en route', () => {
  it('pousserAuxAutres ne transmet toujours pas inSeconds — et c’est pour ça qu’on ne pousse plus', () => {
    /**
     * Cet essai ne demande pas de corriger `pousserAuxAutres` : Expo remet une
     * notification poussée immédiatement, un délai n'y a pas de sens. Il fixe
     * le fait, pour que personne ne remette un envoi à retardement sur ce
     * chemin en croyant qu'il le porte.
     */
    const jeton = lire('src/services/notifications/jetonPush.ts');
    const i = jeton.indexOf('export async function pousserAuxAutres');
    expect(i).toBeGreaterThan(0);
    expect(jeton.slice(i, i + 700)).not.toMatch(/inSeconds/);
  });
});
