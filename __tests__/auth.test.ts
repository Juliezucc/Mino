import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalAuthService } from '@/services/auth';

/**
 * The parent PIN is the shortest secret in the product and the one a child is
 * closest to. These are the properties that keep it worth having.
 */
describe('parent PIN', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('never appears in the family document', () => {
    const data = buildDemoFamily();
    // The document is readable by every device in the family, the child's
    // tablet included. Nothing that unlocks the parent area belongs in it.
    expect(JSON.stringify(data)).not.toContain('1234');
    expect(Object.keys(data.parents[0])).not.toContain('pin');
  });

  it('accepts the right code and refuses the wrong one', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    expect((await auth.verifyParentPin('4821')).ok).toBe(true);
    expect((await auth.verifyParentPin('4822')).ok).toBe(false);
  });

  it('refuses anything that is not four digits', async () => {
    const auth = new LocalAuthService();
    expect((await auth.setParentPin('123')).ok).toBe(false);
    expect((await auth.setParentPin('12a4')).ok).toBe(false);
    expect((await auth.setParentPin('')).ok).toBe(false);
  });

  it('locks out after five wrong tries', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    for (let i = 0; i < 4; i += 1) {
      expect((await auth.verifyParentPin('0000')).reason).toBe('Code incorrect.');
    }

    // The fifth failure says so straight away, rather than letting a parent
    // discover the lock on the try after.
    const fifth = await auth.verifyParentPin('0000');
    expect(fifth.reason).toMatch(/Trop d’essais/);

    // Ten thousand combinations fall in seconds to a script; the lock is what
    // makes a four-digit code worth anything at all.
    const locked = await auth.verifyParentPin('4821');
    expect(locked.ok).toBe(false);
    expect(locked.reason).toMatch(/Trop d’essais/);
  });

  it('forgets the failures as soon as the right code is typed', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    for (let i = 0; i < 4; i += 1) await auth.verifyParentPin('0000');
    expect((await auth.verifyParentPin('4821')).ok).toBe(true);

    // A parent who fumbled four times and then got it right is not one try
    // away from being locked out.
    for (let i = 0; i < 4; i += 1) await auth.verifyParentPin('0000');
    expect((await auth.verifyParentPin('4821')).ok).toBe(true);
  });

  it('starts from no PIN at all, so an unset one unlocks nothing', async () => {
    const auth = new LocalAuthService();
    expect((await auth.verifyParentPin('1234')).ok).toBe(false);
    expect((await auth.verifyParentPin('')).ok).toBe(false);
  });

  it('resets the lock when a new PIN is set', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');
    for (let i = 0; i < 5; i += 1) await auth.verifyParentPin('0000');

    await auth.setParentPin('9137');
    expect((await auth.verifyParentPin('9137')).ok).toBe(true);
  });
});

describe('autorité parentale', () => {
  it('horodate la déclaration du parent, et la garde sur sa ligne', () => {
    const quand = '2026-08-22T09:30:00.000Z';
    const data = buildEmptyFamily({
      familyName: 'Durand',
      parentName: 'Claire',
      email: 'claire@exemple.fr',
      consentAt: quand,
    });
    // L'instant, pas le simple fait : c'est la date qui vaut preuve le jour où
    // on la demande.
    expect(data.parents[0].consentAt).toBe(quand);
  });

  it('laisse la date absente sur les comptes créés avant que l’écran ne demande', () => {
    const data = buildEmptyFamily({
      familyName: 'Durand',
      parentName: 'Claire',
      email: 'claire@exemple.fr',
    });
    expect(data.parents[0].consentAt).toBeUndefined();
  });
});
