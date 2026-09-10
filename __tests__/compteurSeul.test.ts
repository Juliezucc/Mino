import AsyncStorage from '@react-native-async-storage/async-storage';

import { writeDeviceProfile } from '@/data/deviceProfile';
import { etatDe, phraseDe, aRegler } from '@/domain/shieldReport';
import { DeviceManagedScreenTimeService } from '@/services/screenTime';

/**
 * ---------------------------------------------------------------------------
 * « Je peux activer mon temps alors que le blocage n'est pas activé. »
 * ---------------------------------------------------------------------------
 *
 * Relevé sur une vraie tablette Android, et c'est le défaut le plus grave que
 * Mino ait porté : l'enfant lance sa séance, le grand livre débite les minutes
 * qu'il a méritées, le compte à rebours démarre — et rien ne s'ouvre ni ne se
 * ferme, parce qu'aucun bouclier n'a jamais été posé. Mino lui prend son temps
 * gagné en échange de rien, ce qui est exactement la seule chose qu'il ne doit
 * jamais faire.
 *
 * Mais refuser sèchement ne suffit pas : deux familles se cachent derrière la
 * même absence d'autorisation, et aucun signal technique ne les sépare. Celle
 * qui voulait le blocage et n'a pas fini l'installation, et celle qui se sert
 * de Mino comme d'un décompte convenu — usage légitime, courant avec un
 * adolescent. Seul le parent sait laquelle il est. On le lui demande, une fois,
 * et sa réponse vit sur cet appareil-là.
 */

/** Un module natif qui n'a jamais reçu l'autorisation. Le cas de la tablette. */
function natifSansDroit() {
  const calls: string[] = [];
  return {
    calls,
    async authorizationStatus() {
      return 'denied' as const;
    },
    async requestAuthorization() {
      return 'denied' as const;
    },
    async presentPicker() {
      return { count: 0 };
    },
    async selectionCount() {
      return { count: 0 };
    },
    async shield() {
      calls.push('shield');
    },
    async unshield() {
      calls.push('unshield');
    },
    async remaining() {
      calls.push('remaining');
      return 0;
    },
  };
}

describe('dépenser des minutes sans bouclier', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('refuse la séance tant que le parent n’a pas répondu', async () => {
    const natif = natifSansDroit();
    const service = new DeviceManagedScreenTimeService(natif);

    await expect(
      service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 }),
    ).rejects.toThrow(/blocage/i);

    // Et surtout : rien n'a été tenté côté natif, donc rien n'a pu être débité
    // par un chemin détourné. Le refus arrive avant toute écriture.
    expect(natif.calls).toEqual([]);
  });

  it('n’accuse pas l’enfant, et lui dit que ses minutes l’attendent', async () => {
    const service = new DeviceManagedScreenTimeService(natifSansDroit());
    // Le message s'affiche sur l'écran d'un enfant de cinq ans : ce n'est pas
    // lui qui a laissé l'installation en plan, et il doit repartir en sachant
    // qu'il n'a rien perdu.
    await expect(
      service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 }),
    ).rejects.toThrow(/pas perdue/i);
  });

  it('accepte la séance quand le parent a choisi le compteur seul', async () => {
    await writeDeviceProfile({ compteurSeul: true });
    const natif = natifSansDroit();
    const service = new DeviceManagedScreenTimeService(natif);

    const grant = await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });

    expect(new Date(grant.endsAt).getTime() - new Date(grant.startedAt).getTime()).toBe(20 * 60_000);
    // Le module natif refuserait, et il aurait raison : on ne l'appelle pas.
    expect(natif.calls).toEqual([]);
  });

  it('décompte le temps restant sur notre propre échéance', async () => {
    // Sans ce détour, le compte à rebours de l'enfant s'affichait à zéro dès la
    // première seconde : le natif, qui ne sait rien de cette séance, répond
    // « il ne reste rien » — et il dit vrai, de son point de vue.
    await writeDeviceProfile({ compteurSeul: true });
    const service = new DeviceManagedScreenTimeService(natifSansDroit());

    await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });
    const etat = await service.status('c1');

    expect(etat.active).toBe(true);
    expect(etat.remainingSeconds).toBeGreaterThan(1190);
  });

  it('referme la séance sans appeler un bouclier qui n’existe pas', async () => {
    // Le piège : `revoke` reposait le bouclier avant de facturer. Sur un
    // appareil sans autorisation, cet appel jette — et la séance restait
    // ouverte dans le grand livre, à consommer des minutes que plus personne ne
    // refermait.
    await writeDeviceProfile({ compteurSeul: true });
    const natif = natifSansDroit();
    const service = new DeviceManagedScreenTimeService(natif);

    await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 20 });
    const { consumedMinutes } = await service.revoke('ses_1');

    expect(consumedMinutes).toBe(0);
    expect(natif.calls).toEqual([]);
  });

  it('revient au refus dès que le parent change d’avis', async () => {
    await writeDeviceProfile({ compteurSeul: true });
    const service = new DeviceManagedScreenTimeService(natifSansDroit());
    await service.grant({ sessionId: 'ses_1', childId: 'c1', minutes: 5 });

    await writeDeviceProfile({ compteurSeul: false });
    await expect(
      service.grant({ sessionId: 'ses_2', childId: 'c1', minutes: 5 }),
    ).rejects.toThrow();
  });
});

/**
 * Ce que le parent lit dans la liste des appareils.
 *
 * Un appareil dont le parent a explicitement voulu le compteur seul remontait
 * « blocage pas encore réglé », en jaune, tous les jours : on lui reprochait sa
 * propre décision, et le compteur d'appareils « à regarder » ne retombait
 * jamais à zéro — ce qui finit par le rendre inutile pour ceux qui, eux, ont un
 * vrai problème.
 */
describe('l’appareil en compteur seul, vu du parent', () => {
  const appareil = {
    id: 'd1',
    label: 'Tablette du salon',
    childId: 'c1',
    status: 'compteur-seul',
    seenAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  };

  it('se lit comme une décision, pas comme une panne', () => {
    expect(etatDe(appareil)).toBe('compteur-seul');
    expect(phraseDe(etatDe(appareil)).grave).toBe(false);
  });

  it('ne compte pas parmi les appareils à regarder', () => {
    expect(aRegler([appareil])).toBe(0);
  });

  it('reste muet s’il cesse de donner de ses nouvelles', () => {
    // Le silence l'emporte toujours sur le dernier statut connu, décision du
    // parent comprise : un appareil dont on ne sait rien n'est pas un appareil
    // dont on sait quelque chose.
    const vieux = { ...appareil, seenAt: '2020-01-01T00:00:00.000Z' };
    expect(etatDe(vieux)).toBe('muet');
  });
});
