import { NO_DEVICE_PROFILE, readDeviceProfile } from '@/data/deviceProfile';
import { ID } from '@/domain/types';

import {
  ScreenTimeAuthorization,
  ScreenTimeGrant,
  ScreenTimeService,
  ScreenTimeStatus,
  ShieldedSelection,
} from './ScreenTimeService';
import { NativeScreenTime } from './native';

/**
 * Real enforcement: the apps the parent chose stay shielded, and a session
 * lifts the shield for exactly the minutes the child earned.
 *
 * One implementation covers both platforms because both native modules expose
 * the same four verbs. What differs — FamilyControls on iOS, usage access plus
 * an overlay on Android — differs entirely below this line.
 *
 * The deadline is handed to the native side rather than kept here: the shield
 * has to come back even if the child force-quits Mino, which is precisely the
 * case a JavaScript timer cannot cover.
 */
export class DeviceManagedScreenTimeService implements ScreenTimeService {
  readonly name = 'device-managed';
  readonly capability = 'device-managed' as const;

  /** Kept only to bill the time used; the shield itself is the native side's. */
  private grants = new Map<ID, ScreenTimeGrant>();

  /**
   * Les séances ouvertes sans bouclier, parce que le parent a choisi le
   * compteur seul. Elles ne se distinguent d'aucune autre côté grand livre —
   * seul le module natif n'a rien à en faire, ni pour l'échéance ni pour le
   * verrou. Sans cette liste, `revoke` aurait appelé un bouclier qui n'existe
   * pas et laissé la séance ouverte dans le registre.
   */
  private sansBouclier = new Set<ID>();

  constructor(private readonly native: NativeScreenTime) {}

  authorization(): Promise<ScreenTimeAuthorization> {
    return this.native.authorizationStatus();
  }

  requestAuthorization(): Promise<ScreenTimeAuthorization> {
    return this.native.requestAuthorization();
  }

  async chooseApps(): Promise<ShieldedSelection> {
    const selection = await this.native.presentPicker();
    // Anything chosen goes behind the shield straight away, so the setup ends
    // in the state the parent expects rather than at the next session.
    if (selection.count > 0) await this.native.shield();
    return selection;
  }

  selection(): Promise<ShieldedSelection> {
    return this.native.selectionCount();
  }

  /**
   * Lever le bouclier jusqu'à la fin de la plage, et rien de plus.
   *
   * Aucune écriture au grand livre, aucune séance : c'est du temps que le
   * parent a déjà donné. La seule chose à faire est de rendre l'écran
   * ouvert — et de confier l'échéance au natif, qui refermera tout seul.
   *
   * Silencieux quand l'autorisation manque : il n'y a alors aucun bouclier à
   * lever, et lever un verrou qui n'existe pas n'a jamais ouvert une porte.
   */
  async ouvrirPlageLibre(jusqua: Date): Promise<void> {
    const etat = await this.native.authorizationStatus().catch(() => 'denied' as const);
    if (etat !== 'approved') return;
    const selection = await this.native.selectionCount().catch(() => ({ count: 0 }));
    if (selection.count === 0) return;
    await this.native.unshield(jusqua.getTime());
  }

  async grant(params: { sessionId: ID; childId: ID; minutes: number }): Promise<ScreenTimeGrant> {
    /**
     * **Refuser de lever un verrou qui n'existe pas.**
     *
     * Ce service levait le bouclier sans avoir jamais vérifié qu'il était en
     * place. Sur un appareil où l'autorisation n'a pas été accordée — le cas de
     * toute famille qui n'a pas fini l'installation — l'enchaînement était le
     * suivant : l'enfant lance sa séance, le grand livre débite ses minutes, le
     * compte à rebours démarre… et aucune application ne s'ouvre ni ne se
     * ferme, parce qu'il n'y a rien à ouvrir ni à fermer.
     *
     * Autrement dit, l'enfant paie de son temps gagné pour rien. C'est la seule
     * chose que Mino ne doit jamais faire : les minutes sont méritées, et un
     * registre en ajout seul ne les rend pas.
     *
     * On lève donc ici, avant toute écriture. L'écran de l'enfant referme la
     * séance et affiche une phrase qui ne l'accuse de rien — ce n'est pas lui
     * qui a laissé l'installation en plan.
     *
     * **Sauf si le parent a dit qu'il voulait le compteur seul**, et ce cas-là
     * n'est pas une panne : une famille peut très bien se servir de Mino comme
     * d'un décompte convenu entre eux, sans rien verrouiller — c'est courant
     * avec un adolescent, chez qui le bouclier se négocie mal. Cette réponse-là
     * ne se devine pas depuis le système : l'autorisation manque exactement de
     * la même façon dans les deux cas. Elle est donc demandée au parent, dans
     * son espace, et gardée sur cet appareil-ci (voir `DeviceProfile`).
     */
    const droit = await this.native.authorizationStatus().catch(() => 'denied' as const);
    if (droit !== 'approved') {
      const { compteurSeul } = await readDeviceProfile().catch(() => NO_DEVICE_PROFILE);
      if (!compteurSeul) {
        throw new Error(
          // Pas d'unité : ce service ne connaît pas l'âge de l'enfant, et la
          // phrase n'a rien à compter. Voir la même raison dans `actions.ts`.
          'Le blocage n’est pas encore réglé sur cet appareil. Demande à un parent d’ouvrir Mino : ce que tu as gagné t’attend, rien n’est perdu.',
        );
      }
      // Compteur seul : la séance existe, le temps se décompte, et il n'y a
      // simplement pas de verrou à lever. On n'appelle pas le module natif —
      // il refuserait, et il aurait raison.
      const debut = new Date();
      const fin = new Date(debut.getTime() + params.minutes * 60_000);
      const sans: ScreenTimeGrant = {
        sessionId: params.sessionId,
        childId: params.childId,
        minutes: params.minutes,
        startedAt: debut.toISOString(),
        endsAt: fin.toISOString(),
      };
      this.grants.set(params.sessionId, sans);
      this.sansBouclier.add(params.sessionId);
      return sans;
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + params.minutes * 60_000);

    await this.native.unshield(endsAt.getTime());

    const grant: ScreenTimeGrant = {
      sessionId: params.sessionId,
      childId: params.childId,
      minutes: params.minutes,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
    this.grants.set(params.sessionId, grant);
    return grant;
  }

  async revoke(sessionId: ID): Promise<{ consumedMinutes: number }> {
    const grant = this.grants.get(sessionId);

    // Compteur seul : rien n'a été levé, il n'y a rien à reposer. Appeler le
    // module natif ici jetait — et la séance restait ouverte dans le grand
    // livre, à consommer des minutes que plus personne ne refermait.
    if (this.sansBouclier.has(sessionId)) {
      this.sansBouclier.delete(sessionId);
      this.grants.delete(sessionId);
      if (!grant) return { consumedMinutes: 0 };
      const ecouleMs = Date.now() - new Date(grant.startedAt).getTime();
      return {
        consumedMinutes: Math.min(grant.minutes, Math.max(0, Math.round(ecouleMs / 60_000))),
      };
    }

    /**
     * Ce qu'il restait, demandé AVANT de reposer le bouclier — `shield()`
     * efface l'échéance, donc après il n'y a plus rien à lire.
     *
     * On facture sur cette valeur et non sur `Date.now()`, et c'est tout
     * l'objet du détour : l'horloge du téléphone se règle. Un enfant qui la
     * reculait de deux heures avant de fermer sa session faisait rendre à
     * `Date.now() - startedAt` un écart minuscule, se voyait débiter zéro
     * minute, et gardait à la fois son temps d'écran et ses minos. Côté natif
     * l'échéance est aussi mesurée à l'horloge monotone, qui ne se règle pas.
     */
    const resteMs = await this.native.remaining().catch(() => null);

    // Shield first, bill after: if anything below throws, the apps are already
    // locked again. The wrong failure mode here is a child left with an open
    // phone, not a minute mis-billed.
    await this.native.shield();
    if (!grant) return { consumedMinutes: 0 };
    this.grants.delete(sessionId);

    // Le repli sur l'horloge murale ne sert que si le module natif n'a pas
    // répondu. Il est moins sûr, mais il vaut mieux qu'une facturation à zéro.
    const consommeMs =
      resteMs === null
        ? Date.now() - new Date(grant.startedAt).getTime()
        : grant.minutes * 60_000 - resteMs;

    return {
      consumedMinutes: Math.min(grant.minutes, Math.max(0, Math.round(consommeMs / 60_000))),
    };
  }

  async status(childId: ID): Promise<ScreenTimeStatus> {
    const grant = [...this.grants.values()].find((g) => g.childId === childId);

    // Compteur seul : le module natif ne sait rien de cette séance — il n'a
    // pas d'échéance à tenir. C'est la nôtre qui compte, et sans ce détour le
    // compte à rebours de l'enfant s'affichait à zéro dès la première seconde.
    if (grant && this.sansBouclier.has(grant.sessionId)) {
      const resteS = Math.max(0, Math.round((new Date(grant.endsAt).getTime() - Date.now()) / 1000));
      return { active: resteS > 0, grant, remainingSeconds: resteS };
    }

    // The native side is the authority on how long is left: it survives the app
    // being killed, and this map does not.
    const remainingMs = await this.native.remaining();
    const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

    if (!grant) return { active: remainingSeconds > 0, remainingSeconds };
    return { active: remainingSeconds > 0, grant, remainingSeconds };
  }
}
