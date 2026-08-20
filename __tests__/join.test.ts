import { buildDemoFamily } from '@/data/demo';
import { matchesFamily } from '@/data/localRepository';
import { createFamilyCode } from '@/domain/id';

/**
 * Pairing is a security boundary: getting it wrong drops a stranger inside a
 * family with children in it. Since a child is asked for the family code and
 * nothing else, that code carries the whole weight.
 */
describe('joining a family', () => {
  const data = buildDemoFamily(new Date('2026-08-20T10:00:00.000Z'));
  const code = data.family.code;

  it('accepts the right code', () => {
    expect(matchesFamily(data, { code })).toBe(true);
  });

  it('forgives how a code gets typed by a child', () => {
    expect(matchesFamily(data, { code: `  ${code.toLowerCase()} ` })).toBe(true);
  });

  it('refuses a wrong code', () => {
    expect(matchesFamily(data, { code: 'MINO-000000' })).toBe(false);
  });

  it('refuses an empty code', () => {
    expect(matchesFamily(data, { code: '' })).toBe(false);
    expect(matchesFamily(data, { code: '   ' })).toBe(false);
  });

  it('never lets the referral code stand in for the family code', () => {
    // They are different strings on purpose: one is shared with strangers.
    expect(data.family.referralCode).not.toBe(data.family.code);
    expect(matchesFamily(data, { code: data.family.referralCode })).toBe(false);
  });

  it('is long enough that guessing is not a strategy', () => {
    // 32^6 ≈ a billion. At four characters it was a million, which a script
    // gets through in an afternoon.
    const generated = createFamilyCode();
    expect(generated).toMatch(/^MINO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('never produces I, O, 0 or 1, which get misread aloud', () => {
    const codes = Array.from({ length: 200 }, () => createFamilyCode());
    expect(codes.some((c) => /[IO01]/.test(c.slice(5)))).toBe(false);
  });
});
