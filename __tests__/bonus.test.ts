import { buildDemoFamily } from '@/data/demo';
import { adjustBalance, grantBonus } from '@/domain/actions';
import { balanceOf } from '@/domain/ledger';

const NOW = new Date('2026-08-20T18:00:00.000Z');

function demo() {
  const data = buildDemoFamily(NOW);
  return { data, childId: data.children[0].id };
}

describe('bonus', () => {
  it('adds time and says why, in its own category', () => {
    const { data, childId } = demo();
    const before = balanceOf(data.transactions, childId);

    const next = grantBonus(data, { childId, minutes: 15, reason: 'Coup de main spontané' }, NOW);
    const tx = next.transactions.at(-1)!;

    expect(balanceOf(next.transactions, childId)).toBe(before + 15);
    expect(tx.kind).toBe('bonus');
    expect(tx.reason).toBe('Coup de main spontané');
  });

  it('can never take time away', () => {
    const { data, childId } = demo();
    expect(() => grantBonus(data, { childId, minutes: -10, reason: 'Punition' }, NOW)).toThrow();
    expect(() => grantBonus(data, { childId, minutes: 0, reason: 'Rien' }, NOW)).toThrow();
  });

  it('stays distinct from a correction', () => {
    const { data, childId } = demo();
    const corrected = adjustBalance(data, { childId, delta: -5, reason: 'Validé par erreur' }, NOW);

    // Both move the balance; only one is a gift, and the history says which.
    expect(corrected.transactions.at(-1)!.kind).toBe('parent_adjustment');
    expect(grantBonus(data, { childId, minutes: 5, reason: 'Bravo' }, NOW).transactions.at(-1)!.kind).toBe(
      'bonus',
    );
  });

  it('is just another line in the ledger, so the balance still derives', () => {
    const { data, childId } = demo();
    const next = grantBonus(data, { childId, minutes: 20, reason: 'Belle journée' }, NOW);

    const summed = next.transactions
      .filter((t) => t.childId === childId)
      .reduce((sum, t) => sum + t.delta, 0);
    expect(balanceOf(next.transactions, childId)).toBe(summed);
  });
});
