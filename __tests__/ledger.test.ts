import { buildDemoFamily } from '@/data/demo';
import {
  balanceDetail,
  balanceOf,
  capsulesFor,
  formatDuration,
  formatMinutes,
  historyOf,
} from '@/domain/ledger';

describe('screen-time ledger', () => {
  it('derives the demo balances from transactions only', () => {
    const data = buildDemoFamily();
    const [noah, elliott, lea] = data.children;

    expect(balanceOf(data.transactions, noah.id)).toBe(35);
    expect(balanceOf(data.transactions, elliott.id)).toBe(20);
    // Léa est à zéro : c'est l'état où Mino reste et discute, et la démo doit
    // le montrer dès la première ouverture.
    expect(balanceOf(data.transactions, lea.id)).toBe(0);
  });

  it('never leaks minutes between children', () => {
    const data = buildDemoFamily();
    const total = data.transactions.reduce((sum, tx) => sum + tx.delta, 0);
    // Every child in the family, so adding one cannot silently weaken this.
    const summed = data.children.reduce(
      (sum, child) => sum + balanceOf(data.transactions, child.id),
      0,
    );

    expect(summed).toBe(total);
  });

  it('splits earned and used minutes for today', () => {
    const now = new Date();
    const data = buildDemoFamily(now);
    const noah = data.children[0];

    const detail = balanceDetail(data.transactions, noah.id, now);
    expect(detail.minutes).toBe(35);
    expect(detail.earnedToday).toBe(35);
    expect(detail.usedToday).toBe(0);
  });

  it('lists history newest first', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];
    const history = historyOf(data.transactions, noah.id);

    expect(history.length).toBeGreaterThan(0);
    for (let i = 1; i < history.length; i += 1) {
      expect(history[i - 1].createdAt >= history[i].createdAt).toBe(true);
    }
  });

  it('formats time the way the child screens display it', () => {
    expect(formatMinutes(35)).toBe('35:00');
    expect(formatMinutes(-4)).toBe('0:00');
    expect(formatDuration(1199)).toBe('19:59');
    expect(formatDuration(0)).toBe('00:00');
  });

  it('shows one capsule per 5 minutes', () => {
    expect(capsulesFor(50)).toEqual({ full: 10, partial: 0 });
    expect(capsulesFor(12)).toEqual({ full: 2, partial: 0.4 });
    expect(capsulesFor(0)).toEqual({ full: 0, partial: 0 });
  });
});
