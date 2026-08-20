import { balanceOf, historyOf, withOpeningBalances } from '@/domain/ledger';
import { ScreenTimeTransaction } from '@/domain/types';

/**
 * A device carries only the recent ledger. These tests guard the one thing that
 * must survive that truncation: the balance is still exactly the sum of the
 * lines the device holds.
 */

const WINDOW = '2026-05-01T00:00:00.000Z';

const tx = (over: Partial<ScreenTimeTransaction> & { id: string; childId: string; delta: number }): ScreenTimeTransaction => ({
  familyId: 'f1',
  kind: 'mission_reward',
  reason: 'Mission validée',
  createdAt: '2026-06-01T10:00:00.000Z',
  ...over,
});

describe('bounded history', () => {
  it('makes the truncated past add up to the true balance', () => {
    const recent = [tx({ id: 't1', childId: 'noah', delta: 15 }), tx({ id: 't2', childId: 'noah', delta: -10 })];

    // The server says 120: 115 of it happened before the window.
    const result = withOpeningBalances(recent, { noah: 120 }, 'f1', WINDOW);

    expect(balanceOf(result, 'noah')).toBe(120);
  });

  it('adds nothing when the device already holds the whole story', () => {
    const recent = [tx({ id: 't1', childId: 'noah', delta: 15 })];

    expect(withOpeningBalances(recent, { noah: 15 }, 'f1', WINDOW)).toHaveLength(1);
  });

  it('handles a child whose past is entirely spent, not just partly', () => {
    // Nothing recent at all, and a balance that is only history.
    const result = withOpeningBalances([], { lea: 55 }, 'f1', WINDOW);

    expect(result).toHaveLength(1);
    expect(balanceOf(result, 'lea')).toBe(55);
  });

  it('keeps one child out of another child’s opening line', () => {
    const recent = [tx({ id: 't1', childId: 'noah', delta: 15 })];
    const result = withOpeningBalances(recent, { noah: 40, elliott: 20 }, 'f1', WINDOW);

    expect(balanceOf(result, 'noah')).toBe(40);
    expect(balanceOf(result, 'elliott')).toBe(20);
  });

  it('sorts the opening line last, under everything the child can remember', () => {
    const recent = [tx({ id: 't1', childId: 'noah', delta: 15, createdAt: '2026-05-02T08:00:00.000Z' })];
    const history = historyOf(withOpeningBalances(recent, { noah: 100 }, 'f1', WINDOW), 'noah');

    expect(history[history.length - 1].kind).toBe('initial_balance');
  });

  it('can carry a negative correction made before the window', () => {
    // A parent who adjusted a counter downwards four months ago: the opening
    // line has to be able to go the other way too.
    const recent = [tx({ id: 't1', childId: 'noah', delta: 30 })];

    expect(balanceOf(withOpeningBalances(recent, { noah: 10 }, 'f1', WINDOW), 'noah')).toBe(10);
  });
});
