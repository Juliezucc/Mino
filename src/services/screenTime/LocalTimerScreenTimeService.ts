import { ID } from '@/domain/types';

import {
  ScreenTimeAuthorization,
  ScreenTimeCapability,
  ScreenTimeGrant,
  ScreenTimeService,
  ScreenTimeStatus,
  ShieldedSelection,
} from './ScreenTimeService';

/**
 * MVP implementation: an honest in-app countdown.
 *
 * It deliberately does not pretend to block anything — `capability` says
 * 'timer-only' so the UI can word things truthfully.
 */
export class LocalTimerScreenTimeService implements ScreenTimeService {
  readonly name = 'timer';
  readonly capability: ScreenTimeCapability = 'timer-only';

  private grants = new Map<ID, ScreenTimeGrant>();

  // Nothing to authorise, because nothing is enforced. Saying 'unsupported'
  // rather than 'approved' keeps the UI from offering a permission screen that
  // would grant nothing.
  async authorization(): Promise<ScreenTimeAuthorization> {
    return 'unsupported';
  }

  async requestAuthorization(): Promise<ScreenTimeAuthorization> {
    return 'unsupported';
  }

  async chooseApps(): Promise<ShieldedSelection> {
    return { count: 0 };
  }

  async selection(): Promise<ShieldedSelection> {
    return { count: 0 };
  }

  async grant(params: { sessionId: ID; childId: ID; minutes: number }): Promise<ScreenTimeGrant> {
    const startedAt = new Date();
    const grant: ScreenTimeGrant = {
      sessionId: params.sessionId,
      childId: params.childId,
      minutes: params.minutes,
      startedAt: startedAt.toISOString(),
      endsAt: new Date(startedAt.getTime() + params.minutes * 60_000).toISOString(),
    };
    this.grants.set(params.sessionId, grant);
    return grant;
  }

  /**
   * Rien à lever : ce service ne bloque rien, il compte.
   *
   * Ce n'est pas un oubli poli — c'est la même honnêteté que partout ailleurs
   * ici. Une plage libre sur un appareil sans bouclier n'a rien à ouvrir,
   * puisque rien n'était fermé.
   */
  async ouvrirPlageLibre(_jusqua: Date): Promise<void> {
    return;
  }

  async revoke(sessionId: ID): Promise<{ consumedMinutes: number }> {
    const grant = this.grants.get(sessionId);
    if (!grant) return { consumedMinutes: 0 };
    this.grants.delete(sessionId);

    const elapsedMs = Date.now() - new Date(grant.startedAt).getTime();
    const consumed = Math.min(grant.minutes, Math.max(0, Math.round(elapsedMs / 60_000)));
    return { consumedMinutes: consumed };
  }

  async status(childId: ID): Promise<ScreenTimeStatus> {
    const grant = [...this.grants.values()].find((g) => g.childId === childId);
    if (!grant) return { active: false, remainingSeconds: 0 };

    const remaining = Math.max(
      0,
      Math.round((new Date(grant.endsAt).getTime() - Date.now()) / 1000),
    );
    return { active: remaining > 0, grant, remainingSeconds: remaining };
  }
}
