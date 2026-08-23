import { buildDemoFamily } from '@/data/demo';
import { adjustBalance, endSession, startSession } from '@/domain/actions';
import { balanceOf } from '@/domain/ledger';
import {
  DeviceManagedScreenTimeService,
  LocalTimerScreenTimeService,
} from '@/services/screenTime';

describe('using screen time', () => {
  it('bills only the minutes actually spent', () => {
    const start = new Date('2026-08-17T15:00:00Z');
    const data = buildDemoFamily(start);
    const noah = data.children[0];

    const started = startSession(data, { childId: noah.id, minutes: 20 }, start);
    // Nothing is charged upfront — the child still owns their 35 minutes.
    expect(balanceOf(started.data.transactions, noah.id)).toBe(35);

    const twelveMinutesLater = new Date(start.getTime() + 12 * 60_000);
    const ended = endSession(
      started.data,
      { sessionId: started.session.id, status: 'stopped' },
      twelveMinutesLater,
    );

    expect(ended.transaction?.delta).toBe(-12);
    expect(ended.transaction?.kind).toBe('screen_time_used');
    expect(balanceOf(ended.data.transactions, noah.id)).toBe(23);
    expect(ended.session.status).toBe('stopped');
  });

  it('never charges more than the session that was granted', () => {
    const start = new Date('2026-08-17T15:00:00Z');
    const data = buildDemoFamily(start);
    const noah = data.children[0];

    const started = startSession(data, { childId: noah.id, minutes: 10 }, start);
    const muchLater = new Date(start.getTime() + 90 * 60_000);
    const ended = endSession(started.data, { sessionId: started.session.id }, muchLater);

    expect(ended.transaction?.delta).toBe(-10);
    expect(balanceOf(ended.data.transactions, noah.id)).toBe(25);
  });

  it('refuses to start a session the child cannot afford', () => {
    const data = buildDemoFamily();
    const elliott = data.children[1];

    expect(() => startSession(data, { childId: elliott.id, minutes: 30 })).toThrow();
    expect(() => startSession(data, { childId: elliott.id, minutes: 0 })).toThrow();
  });

  it('refuses two sessions at once for the same child', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];
    const started = startSession(data, { childId: noah.id, minutes: 10 });

    expect(() => startSession(started.data, { childId: noah.id, minutes: 10 })).toThrow();
  });

  it('records parent adjustments as ledger entries', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];

    const bonus = adjustBalance(data, { childId: noah.id, delta: 15, reason: 'Bonus parent' });
    expect(balanceOf(bonus.transactions, noah.id)).toBe(50);

    const penalty = adjustBalance(bonus, { childId: noah.id, delta: -5, reason: 'Retrait parent' });
    expect(balanceOf(penalty.transactions, noah.id)).toBe(45);
    expect(penalty.transactions.at(-1)?.kind).toBe('parent_adjustment');
  });
});

describe('ScreenTimeService seam', () => {
  it('is honest about what the fallback can do', async () => {
    const service = new LocalTimerScreenTimeService();
    expect(service.capability).toBe('timer-only');
    // Not 'approved': there is nothing to approve when nothing is enforced,
    // and claiming otherwise would make the app offer a useless permission.
    expect(await service.authorization()).toBe('unsupported');
    expect((await service.selection()).count).toBe(0);
  });

  it('tracks a grant until it is revoked', async () => {
    const service = new LocalTimerScreenTimeService();
    await service.grant({ sessionId: 'ses_1', childId: 'child_1', minutes: 20 });

    const status = await service.status('child_1');
    expect(status.active).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(1190);

    await service.revoke('ses_1');
    expect((await service.status('child_1')).active).toBe(false);
  });
});

describe('device-managed screen time', () => {
  /** Stands in for the Swift and Kotlin modules, which cannot run in Jest. */
  function fakeNative() {
    const calls: string[] = [];
    let shielded = true;
    let until = 0;
    return {
      calls,
      isShielded: () => shielded,
      async authorizationStatus() {
        return 'approved' as const;
      },
      async requestAuthorization() {
        return 'approved' as const;
      },
      async presentPicker() {
        return { count: 7 };
      },
      async selectionCount() {
        return { count: 7 };
      },
      async shield() {
        calls.push('shield');
        shielded = true;
        until = 0;
      },
      async unshield(deadline: number) {
        calls.push('unshield');
        shielded = false;
        until = deadline;
      },
      async remaining() {
        calls.push('remaining');
        return Math.max(0, until - Date.now());
      },
      /** Simule un enfant qui recule l'horloge : le natif, lui, ne bouge pas. */
      reculerHorloge(ms: number) {
        until += ms;
      },
    };
  }

  it('shields whatever the parent just picked, without waiting for a session', async () => {
    const native = fakeNative();
    const service = new DeviceManagedScreenTimeService(native);

    expect((await service.chooseApps()).count).toBe(7);
    expect(native.calls).toContain('shield');
  });

  it('lifts the shield for exactly the minutes earned', async () => {
    const native = fakeNative();
    const service = new DeviceManagedScreenTimeService(native);

    const grant = await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });
    expect(native.isShielded()).toBe(false);

    const span = new Date(grant.endsAt).getTime() - new Date(grant.startedAt).getTime();
    expect(span).toBe(20 * 60_000);

    const status = await service.status('c1');
    expect(status.active).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(1190);
  });

  it('puts the shield back before billing anything', async () => {
    const native = fakeNative();
    const service = new DeviceManagedScreenTimeService(native);

    await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });
    await service.revoke('ses_1');

    expect(native.isShielded()).toBe(true);
    // `remaining` vient AVANT `shield` : reposer le bouclier efface l'échéance,
    // et c'est elle qui sert à facturer.
    expect(native.calls).toEqual(['unshield', 'remaining', 'shield']);
  });

  it('re-shields even for a session it never knew about', async () => {
    const native = fakeNative();
    const service = new DeviceManagedScreenTimeService(native);

    // The app was killed and restarted mid-session: the map is empty, but the
    // apps must still be locked again.
    const out = await service.revoke('ses_unknown');
    expect(out.consumedMinutes).toBe(0);
    expect(native.isShielded()).toBe(true);
  });
});

/**
 * L'horloge du téléphone se règle. Celle du bouclier, non.
 *
 * Ce n'est pas une hypothèse d'école : reculer l'heure est le contournement le
 * plus simple qui soit, à la portée de n'importe quel enfant qui sait ouvrir
 * les réglages, et il rapportait deux fois — la session durait plus longtemps,
 * et elle ne coûtait rien.
 *
 * Côté natif, l'échéance est aussi mesurée à `SystemClock.elapsedRealtime()`,
 * qui compte depuis le démarrage et ne se règle pas ; on garde la plus courte
 * des deux. Côté JavaScript, la facture ne se calcule plus sur `Date.now()`
 * mais sur ce qu'il RESTAIT d'après le natif — c'est ce que tiennent ces deux
 * tests.
 */
describe('l’horloge reculée', () => {
  function natifFige(resteMs: number) {
    const calls: string[] = [];
    return {
      calls,
      async authorizationStatus() {
        return 'approved' as const;
      },
      async requestAuthorization() {
        return 'approved' as const;
      },
      async presentPicker() {
        return { count: 3 };
      },
      async selectionCount() {
        return { count: 3 };
      },
      async shield() {
        calls.push('shield');
      },
      async unshield() {
        calls.push('unshield');
      },
      async remaining() {
        calls.push('remaining');
        return resteMs;
      },
    };
  }

  it('facture ce que le natif dit, pas ce que dit l’horloge du téléphone', async () => {
    // Le natif tient bon : il restait 5 minutes sur les 20 accordées.
    const service = new DeviceManagedScreenTimeService(natifFige(5 * 60_000));
    await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });

    // Un enfant qui aurait reculé l'horloge ferait rendre à
    // `Date.now() - startedAt` un écart quasi nul, donc zéro minute facturée.
    const { consumedMinutes } = await service.revoke('ses_1');

    expect(consumedMinutes).toBe(15);
  });

  it('se replie sur l’horloge murale seulement si le natif ne répond pas', async () => {
    const natif = natifFige(0);
    natif.remaining = async () => {
      throw new Error('module absent');
    };
    const service = new DeviceManagedScreenTimeService(natif);
    await service.grant({ sessionId: 'ses_2', childId: 'c1', minutes: 20 });

    // Moins sûr, mais très au-dessus d'une facturation à zéro — et le bouclier
    // est reposé dans tous les cas.
    const { consumedMinutes } = await service.revoke('ses_2');
    expect(consumedMinutes).toBe(0);
    expect(natif.calls).toContain('shield');
  });
});
