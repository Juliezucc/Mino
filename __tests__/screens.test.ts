import { buildDemoFamily } from '@/data/demo';
import * as actions from '@/domain/actions';
import { bandForAge, unitFor, unitOf, registerOf, tailleBouton } from '@/domain/ageBand';
import { activeDevices, describeDevice } from '@/domain/devices';
import { balanceOf } from '@/domain/ledger';
import { Child, FamilyData } from '@/domain/types';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'fox',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

function demo(): { data: FamilyData; childId: string; consoleId: string } {
  const data = buildDemoFamily(new Date('2026-08-20T10:00:00.000Z'));
  return { data, childId: data.children[0].id, consoleId: data.devices[0].id };
}

describe('age register', () => {
  it('switches to the teenage register at 13', () => {
    expect(bandForAge(12)).toBe('enfant');
    expect(bandForAge(13)).toBe('ado');
    expect(unitFor('enfant')).toBe('minos');
    expect(unitFor('ado')).toBe('minutes');
  });

  it('reads the unit straight off the child', () => {
    expect(unitOf(child({ age: 7 }))).toBe('minos');
    expect(unitOf(child({ age: 15 }))).toBe('minutes');
    expect(unitOf(null)).toBe('minos');
  });
});

describe('declared devices', () => {
  it('adds and names a screen', () => {
    const { data } = demo();
    const out = actions.addDevice(data, { label: '  Xbox du salon  ', kind: 'console' });

    expect(out.device.label).toBe('Xbox du salon');
    expect(activeDevices(out.data.devices)).toHaveLength(3);
  });

  it('refuses a device with no name', () => {
    const { data } = demo();
    expect(() => actions.addDevice(data, { label: '   ', kind: 'tv' })).toThrow();
  });

  it('archives rather than deletes, so old sessions still read', () => {
    const { data, consoleId } = demo();
    const next = actions.removeDevice(data, consoleId);

    expect(activeDevices(next.devices)).toHaveLength(1);
    // The row survives, so a past session can still be named.
    expect(describeDevice(next.devices, consoleId)).toBe('Console du salon');
  });

  it('falls back gracefully for a device that no longer exists', () => {
    expect(describeDevice([], 'dev_gone')).toBe('un autre écran');
    expect(describeDevice([], undefined)).toBe('cet appareil');
  });
});

/**
 * Un lundi, à midi. La famille de démonstration porte une plage libre le
 * mercredi de 14 h à 16 h, et pendant une plage libre `startSession` refuse de
 * dépenser des minutes — l'écran est déjà ouvert. Un test sans date héritait
 * de l'heure du jour et échouait le mercredi après-midi, lui seul.
 */
const LUNDI = new Date('2026-08-17T15:00:00Z');

describe('sessions', () => {
  it('starts immediately on the device Mino runs on', () => {
    const { data, childId } = demo();
    const out = actions.startSession(data, { childId, minutes: 20 }, LUNDI);
    expect(out.session.status).toBe('running');
    expect(out.session.deviceId).toBeUndefined();
  });

  it('waits for a parent on a declared screen, and bills nothing meanwhile', () => {
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const out = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId });
    expect(out.session.status).toBe('requested');
    expect(out.session.deviceId).toBe(consoleId);
    expect(balanceOf(out.data.transactions, childId)).toBe(before);
  });

  it('waits on this device too when the family asked for approval', () => {
    const { data, childId } = demo();
    const strict = {
      ...data,
      children: data.children.map((c) => (c.id === childId ? { ...c, requireApproval: true } : c)),
    };

    expect(actions.startSession(strict, { childId, minutes: 10 }, LUNDI).session.status).toBe(
      'requested',
    );
  });

  it('starts the clock when the parent approves, not when the child asked', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const approved = new Date('2026-08-20T10:30:00.000Z');
    const { data, childId, consoleId } = demo();

    const request = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId }, asked);
    const started = actions.approveSession(request.data, { sessionId: request.session.id }, approved);

    expect(started.session.status).toBe('running');
    expect(started.session.startedAt).toBe(approved.toISOString());
    // Half an hour of waiting must not eat into the twenty minutes.
    expect(new Date(started.session.endsAt).getTime() - approved.getTime()).toBe(20 * 60_000);
  });

  it('bills only the time actually used on a supervised screen', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const stopped = new Date('2026-08-20T10:12:00.000Z');
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId }, asked);
    const started = actions.approveSession(request.data, { sessionId: request.session.id }, asked);
    const ended = actions.endSession(
      started.data,
      { sessionId: started.session.id, status: 'stopped' },
      stopped,
    );

    expect(ended.session.consumedMinutes).toBe(12);
    expect(balanceOf(ended.data.transactions, childId)).toBe(before - 12);
  });

  it('costs nothing when the parent says no', () => {
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 30, deviceId: consoleId });
    const refused = actions.refuseSession(request.data, { sessionId: request.session.id });

    expect(refused.session.status).toBe('refused');
    expect(balanceOf(refused.data.transactions, childId)).toBe(before);
  });

  it('refuses a second request while one is already waiting', () => {
    const { data, childId, consoleId } = demo();
    const first = actions.startSession(data, { childId, minutes: 10, deviceId: consoleId });
    expect(() => actions.startSession(first.data, { childId, minutes: 10 })).toThrow();
  });
});

/**
 * ------------------------------------------------------- corriger l'âge après coup
 *
 * Le prénom, l'âge et l'avatar n'étaient saisissables qu'à la création. La
 * fiche de l'enfant les affichait ensuite — « 9 ans » — sans permettre d'y
 * toucher : un parent qui s'était trompé d'une touche n'avait que la
 * suppression du profil, donc la perte de tout l'historique, pour se rattraper.
 *
 * Et l'âge n'est pas une mention d'état civil, c'est un réglage du produit : il
 * décide du registre au seuil de 13 ans, et des missions proposées.
 */
describe('modifier le profil d’un enfant', () => {
  it('fait basculer le registre quand l’âge franchit 13 ans', () => {
    const { data, childId } = demo();
    const avant = data.children.find((c) => c.id === childId)!;
    expect(unitOf(avant)).toBe('minos');

    const apres = actions.updateChild(data, childId, { age: 14 });
    const grandi = apres.children.find((c) => c.id === childId)!;

    expect(unitOf(grandi)).toBe('minutes');
    expect(bandForAge(grandi.age)).toBe('ado');
  });

  it('ne touche ni au compteur, ni à l’historique, ni aux missions', () => {
    // C'est toute la différence avec la seule sortie qui existait — supprimer
    // le profil et le recréer, qui emporte tout.
    const { data, childId } = demo();
    const apres = actions.updateChild(data, childId, { age: 14, firstName: 'Noa' });

    expect(balanceOf(apres.transactions, childId)).toBe(balanceOf(data.transactions, childId));
    expect(apres.transactions).toEqual(data.transactions);
    expect(apres.completions).toEqual(data.completions);
    expect(apres.assignments).toEqual(data.assignments);
    expect(apres.missions).toEqual(data.missions);
  });

  it('garde l’identifiant, qui est ce à quoi tout le reste est rattaché', () => {
    const { data, childId } = demo();
    const apres = actions.updateChild(data, childId, {
      id: 'autre-chose',
      age: 10,
    } as Partial<Child>);

    expect(apres.children.find((c) => c.id === childId)?.age).toBe(10);
    expect(apres.children.some((c) => c.id === 'autre-chose')).toBe(false);
  });

  it('ne modifie que l’enfant nommé', () => {
    const { data } = demo();
    const deux = { ...data, children: [...data.children, child({ id: 'c2', age: 7 })] };
    const apres = actions.updateChild(deux, data.children[0].id, { age: 15 });

    expect(apres.children.find((c) => c.id === 'c2')?.age).toBe(7);
  });
});

/**
 * Les boutons géants sont pour les petits, et `bigButtons` n'était lu nulle
 * part.
 *
 * Il est calculé correctement depuis toujours dans `registerOf`, et douze
 * écrans de l'espace enfant écrivaient `size="kid"` en dur à côté. Un
 * adolescent de quatorze ans recevait donc partout les boutons prévus pour les
 * cinq ans — exactement le registre que `src/domain/ageBand.ts` existe pour
 * protéger, et que `CLAUDE.md` nomme comme la raison numéro un qu'un
 * adolescent ferme l'application.
 */
describe('la taille des boutons de l’enfant', () => {
  it('est géante sous 13 ans', () => {
    expect(tailleBouton(child({ age: 5 }))).toBe('kid');
    expect(tailleBouton(child({ age: 12 }))).toBe('kid');
  });

  it('redevient ordinaire à partir de 13 ans', () => {
    expect(tailleBouton(child({ age: 13 }))).toBe('default');
    expect(tailleBouton(child({ age: 16 }))).toBe('default');
  });

  it('suit exactement `bigButtons`, et ne redéfinit pas le seuil', () => {
    // Deux endroits qui décident du même seuil finissent par ne plus être
    // d'accord : c'est ce qui vient d'arriver avec `size="kid"`.
    for (const age of [4, 12, 13, 17]) {
      const c = child({ age });
      expect(tailleBouton(c) === 'kid').toBe(registerOf(c).bigButtons);
    }
  });

  it('ne fait pas de suppositions sans enfant', () => {
    // Le sélecteur de profil, ou une fraction de seconde avant que le profil
    // n'arrive : le registre par défaut est celui du plus jeune.
    expect(tailleBouton(null)).toBe(registerOf(null).bigButtons ? 'kid' : 'default');
  });
});
