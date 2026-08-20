import { MINUTES_PER_MINO, formatMinos, minoUnit, toMinos, toMinutes } from '@/domain/minos';

describe('minos', () => {
  it('is exactly one minute, and stays that way', () => {
    // The guard rail: the day this fails, Mino has a virtual currency.
    expect(MINUTES_PER_MINO).toBe(1);
    expect(toMinos(35)).toBe(35);
    expect(toMinutes(35)).toBe(35);
  });

  it('agrees with the number', () => {
    // French keeps the singular after zéro and un.
    expect(minoUnit(0)).toBe('mino');
    expect(minoUnit(1)).toBe('mino');
    expect(minoUnit(2)).toBe('minos');
    expect(minoUnit(15)).toBe('minos');
  });

  it('formats the way a child reads it', () => {
    expect(formatMinos(15)).toBe('15 minos');
    expect(formatMinos(1)).toBe('1 mino');
    expect(formatMinos(15, { signed: true })).toBe('+15 minos');
    expect(formatMinos(-20, { signed: true })).toBe('-20 minos');
  });
});
