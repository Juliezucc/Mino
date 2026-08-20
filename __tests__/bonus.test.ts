import { BONUS_WINDOW_HOURS, bonusHeadline, pendingBonus } from '@/domain/bonus';
import { ScreenTimeTransaction } from '@/domain/types';

const NOW = new Date('2026-08-20T18:00:00.000Z');
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3600_000).toISOString();

const tx = (over: Partial<ScreenTimeTransaction> = {}): ScreenTimeTransaction => ({
  id: 'b1',
  familyId: 'f1',
  childId: 'c1',
  delta: 15,
  kind: 'bonus',
  reason: 'Belle journée',
  createdAt: hoursAgo(1),
  ...over,
});

/**
 * Un cadeau qu'on ne voit pas arriver n'est pas un cadeau.
 *
 * Et il ne se fête qu'une fois : ce qui a déjà été montré est retenu sur
 * l'appareil, parce que le registre, lui, ne se modifie jamais.
 */
describe('le bonus à fêter', () => {
  it('trouve le bonus qui vient d’arriver', () => {
    expect(pendingBonus([tx()], 'c1', null, NOW)?.id).toBe('b1');
  });

  it('ne fête pas deux fois le même', () => {
    expect(pendingBonus([tx()], 'c1', 'b1', NOW)).toBeNull();
  });

  it('ne ressort pas un cadeau oublié', () => {
    // Une réinstallation, ou un enfant qui n'a pas ouvert l'application de la
    // semaine, ne doit pas déclencher une fête pour un geste qu'il ne
    // rattache plus à rien.
    expect(pendingBonus([tx({ createdAt: hoursAgo(BONUS_WINDOW_HOURS + 1) })], 'c1', null, NOW))
      .toBeNull();
    expect(pendingBonus([tx({ createdAt: hoursAgo(BONUS_WINDOW_HOURS - 1) })], 'c1', null, NOW))
      .not.toBeNull();
  });

  it('prend le plus récent quand il y en a plusieurs', () => {
    const list = [
      tx({ id: 'vieux', createdAt: hoursAgo(6) }),
      tx({ id: 'recent', createdAt: hoursAgo(1) }),
    ];
    expect(pendingBonus(list, 'c1', null, NOW)?.id).toBe('recent');
  });

  it('ne confond jamais deux enfants', () => {
    // Le cadeau d'un frère ne s'affiche pas sur l'écran de l'autre.
    expect(pendingBonus([tx({ childId: 'c2' })], 'c1', null, NOW)).toBeNull();
  });

  it('ignore ce qui n’est pas un bonus', () => {
    expect(pendingBonus([tx({ kind: 'mission_reward' })], 'c1', null, NOW)).toBeNull();
    expect(pendingBonus([tx({ kind: 'screen_time_used', delta: -20 })], 'c1', null, NOW)).toBeNull();
  });

  it('ignore un ajustement négatif, qui n’a rien d’un cadeau', () => {
    expect(pendingBonus([tx({ delta: -10 })], 'c1', null, NOW)).toBeNull();
  });
});

describe('ce que Mino dit en l’apportant', () => {
  it('reprend les mots du parent, qui valent mieux que les nôtres', () => {
    expect(bonusHeadline('Pour ton exposé')).toBe('Pour ton exposé');
  });

  it('a quelque chose à dire même sans raison écrite', () => {
    expect(bonusHeadline('   ')).toBe('Juste comme ça 💙');
  });
});
