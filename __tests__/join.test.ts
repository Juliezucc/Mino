import { buildDemoFamily } from '@/data/demo';
import { matchesFamily } from '@/data/localRepository';

/**
 * Joining is a security boundary: getting it wrong drops a stranger inside a
 * family with children in it. These cases are the ones that would actually be
 * tried.
 */
describe('joining a family', () => {
  const data = buildDemoFamily(new Date('2026-08-20T10:00:00.000Z'));
  const code = data.family.code;
  const email = data.parents[0].email;

  it('accepts the right pair', () => {
    expect(matchesFamily(data, { code, parentEmail: email })).toBe(true);
  });

  it('forgives how a code and an e-mail get typed', () => {
    expect(
      matchesFamily(data, { code: `  ${code.toLowerCase()} `, parentEmail: `  ${email.toUpperCase()} ` }),
    ).toBe(true);
  });

  it('refuses the right code with the wrong e-mail', () => {
    expect(matchesFamily(data, { code, parentEmail: 'voisin@exemple.fr' })).toBe(false);
  });

  it('refuses the right e-mail with the wrong code', () => {
    expect(matchesFamily(data, { code: 'MINO-0000', parentEmail: email })).toBe(false);
  });

  it('refuses an empty pair', () => {
    expect(matchesFamily(data, { code: '', parentEmail: '' })).toBe(false);
  });

  it('never lets the referral code stand in for the family code', () => {
    // They are different strings on purpose: one is shared with strangers.
    expect(data.family.referralCode).not.toBe(data.family.code);
    expect(matchesFamily(data, { code: data.family.referralCode, parentEmail: email })).toBe(false);
  });
});
