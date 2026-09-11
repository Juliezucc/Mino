import Constants from 'expo-constants';
import { create } from 'zustand';

import { DEMO_PARENT_PIN, buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalRepository } from '@/data/localRepository';
import { ChangeEvent, MinoRepository } from '@/data/repository';
import {
  ChoixDAppareil,
  DeviceProfile,
  NO_DEVICE_PROFILE,
  choixComplete,
  etatsPourChoix,
  profileToOpen,
  readDeviceProfile,
  writeDeviceProfile,
} from '@/data/deviceProfile';
import {
  ajouterParent as ajouterParentDistant,
  rattacherParent as rattacherParentDistant,
  retirerParent as retirerParentDistant,
} from '@/data/parents';
import { createSupabaseRepository } from '@/data/supabaseRepository';
import * as actions from '@/domain/actions';
import { GatedAction, LOCKED_MESSAGE, isLocked } from '@/domain/access';
import { envoyerCourrier } from '@/services/courrier';
import { Plan, Referral, Subscription } from '@/domain/billing';
import { DeviceKind } from '@/domain/devices';
import { minutesRestantes, openWindowAt } from '@/domain/freeWindows';
import { AvatarKey, FamilyData, ID, ISODate, RepeatRule } from '@/domain/types';
import * as notify from '@/domain/notifications';
import { AuthResult, getAuthService } from '@/services/auth';
import { getNotificationService } from '@/services/notifications';
import {
  poserJetonPush,
  pousserAuxAutres,
  retirerJetonPush,
} from '@/services/notifications/jetonPush';
import { getScreenTimeService } from '@/services/screenTime';
import { CheckoutOutcome, getBillingService } from '@/services/billing';

/**
 * Single source of truth for the running app.
 *
 * Screens never mutate data themselves: they call an action, the action runs the
 * pure domain function, the result is persisted through the repository, and the
 * new document is published to every screen at once.
 */

function createRepository(): MinoRepository {
  return createSupabaseRepository() ?? new LocalRepository();
}

export type Role = 'child' | 'parent';

interface MinoState {
  status: 'loading' | 'ready';
  repository: MinoRepository;
  data: FamilyData | null;
  activeChildId: ID | null;
  parentUnlocked: boolean;
  lastError: string | null;

  /**
   * Le serveur n'a pas répondu au démarrage.
   *
   * À distinguer absolument de « cette famille n'existe pas » : sans cette
   * nuance, un parent dont le réseau a hoqueté retomberait sur « Créer mon
   * compte », c'est-à-dire sur l'écran qui lui annonce que sa famille a
   * disparu. Voir `app/hors-ligne.tsx`.
   */
  offline: boolean;
  retry: () => Promise<void>;
  /** Chasser le message d'erreur d'une pression. Voir `features/ErrorToast`. */
  clearError: () => void;

  /**
   * Billing lives outside the family document on purpose: it belongs to the
   * payment provider, not to the family's own content, and the app only ever
   * mirrors what the provider says.
   */
  subscription: Subscription | null;
  referrals: Referral[];

  notifications: notify.NotificationPreferences;
  setNotificationPreferences: (patch: Partial<notify.NotificationPreferences>) => void;

  bootstrap: () => Promise<void>;
  startDemo: () => Promise<void>;
  /**
   * Ouvrir une famille sur une session anonyme, avant que le parent ne se
   * présente. Premier écran du parcours d'inscription — voir
   * `docs/ops/parcours-inscription.md`.
   */
  fonderFamille: (input: { consentAt: ISODate }) => Promise<{ ok: boolean; reason?: string }>;
  createAccount: (input: {
    parentName: string;
    email: string;
    /** Absent quand le compte existe déjà : il ne reste alors que la famille à créer. */
    password?: string;
    /** Absent quand un code parent a déjà été posé — on ne le redemande pas. */
    pin?: string;
    familyName?: string;
    consentAt: ISODate;
  }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Suppression définitive : le serveur d'abord, l'appareil ensuite. */
  deleteAccount: () => Promise<AuthResult>;
  /** From the child's device: attach to a family with the family code. */
  joinFamily: (input: { code: string }) => Promise<boolean>;
  resetAll: () => Promise<void>;

  /**
   * À qui appartient cet appareil : réservé à un enfant, ou partagé. Vit sur
   * l'appareil et non dans le document familial — la tablette du salon et le
   * téléphone de Noah ne doivent pas se comporter pareil.
   */
  device: DeviceProfile;
  /** Le profil sur lequel rouvrir, s'il en existe un qui soit encore valable. */
  resumeChildId: () => ID | null;
  /** Réserve cet appareil à un enfant, ou le rend partagé avec `null`. */
  lockDeviceTo: (childId: ID | null) => Promise<void>;
  /**
   * « Sur cet appareil, je veux le compteur sans le blocage. »
   *
   * La réponse du parent à la seule question que le système ne sait pas poser :
   * quand l'autorisation manque, est-ce une installation inachevée ou un choix
   * assumé ? Voir `DeviceProfile.compteurSeul`.
   */
  setCompteurSeul: (valeur: boolean) => Promise<void>;
  /**
   * « C'est mon téléphone à moi » : aucun enfant ne joue ici, il n'y a rien à
   * verrouiller. Voir `DeviceProfile.usagePersonnel`.
   */
  declarerUsage: (choix: ChoixDAppareil) => Promise<void>;
  /**
   * Ajouter un second parent — un profil, pas un compte.
   *
   * Il rejoint avec le code famille comme le reste de la maison, et sans mot
   * de passe de plus. Voir `src/data/parents.ts` pour la raison qui oblige à
   * passer par le serveur.
   *
   * `code` n'est à donner que là où le magasin ne l'a pas déjà : sur un
   * appareil qui vient de rejoindre la famille, l'espace parent n'a encore
   * jamais été ouvert, et il n'y a donc rien en mémoire. Rend l'identifiant du
   * parent créé — l'appelant en a besoin pour dire « ce téléphone est le
   * sien ».
   */
  ajouterParent: (input: { prenom: string; code?: string }) => Promise<ID>;
  /** Retirer un profil de parent — jamais le titulaire du compte. */
  retirerParent: (id: ID) => Promise<void>;
  /**
   * « Ce téléphone-ci est celui de Marc » — à l'appairage, ou après une casse.
   *
   * Révoque l'appareil précédent du même coup. Voir `src/data/parents.ts`.
   */
  rattacherParent: (id: ID, code: string) => Promise<void>;
  /**
   * Le code à quatre chiffres, gardé le temps que l'espace parent reste ouvert
   * — et uniquement sur la tablette d'un enfant.
   *
   * **Pourquoi le garder, et pourquoi ce n'est pas ce qu'on croit.** Sur une
   * session d'appareil, la base refuse toute écriture de parent. Le serveur
   * doit donc revérifier la présence d'un adulte à CHAQUE geste, et le code
   * est cette preuve. Le retaper à chaque mission confirmée rendrait la
   * fonctionnalité inutilisable.
   *
   * En mémoire vive seulement, jamais dans AsyncStorage : relancer
   * l'application — le geste que l'enfant a — le fait disparaître, exactement
   * comme `parentUnlocked`. Sur le téléphone d'un parent, il n'est même pas
   * posé : ce chemin n'en a pas besoin.
   */
  codeParentEnMemoire: string | null;

  /** Voir `poseDemandeeParLeParent` dans `src/domain/parentGate.ts`. */
  poseDuCodeAutorisee: boolean;
  autoriserLaPoseDuCode: () => void;
  consommerLAutorisationDeCode: () => void;
  setUsagePersonnel: (valeur: boolean) => Promise<void>;
  setDeclareALEnfant: (valeur: boolean) => Promise<void>;
  /**
   * Demander la permission, ET déclarer l'appareil joignable dans la foulée.
   *
   * Les deux gestes étaient séparés, et c'est ce qui manquait : le bouton des
   * réglages accordait la permission mais ne posait aucun jeton. L'appareil
   * restait injoignable jusqu'au prochain lancement de Mino — donc jusqu'au
   * lendemain, dans le meilleur des cas.
   */
  activerNotifications: () => Promise<boolean>;
  /**
   * Dire au reste de la famille dans quel état est le bouclier ICI.
   *
   * Jamais attendu par l'appelant : c'est un rapport, pas une action.
   */
  reportShield: () => Promise<void>;
  /**
   * Ouvrir l'écran si une plage libre court en ce moment.
   *
   * Appelé au lancement et à chaque retour au premier plan : une plage
   * commence à une heure, pas à un geste, et personne ne relance Mino pour
   * qu'elle s'applique. Silencieux et jamais attendu — c'est un réglage, pas
   * une action.
   */
  appliquerPlageLibre: () => Promise<void>;

  selectChild: (childId: ID | null) => void;
  unlockParent: (pin: string) => Promise<AuthResult>;
  lockParent: () => void;

  addChild: (input: actions.CreateChildInput) => Promise<ID>;
  editChild: (
    childId: ID,
    patch: {
      firstName?: string;
      age?: number;
      avatarKey?: AvatarKey;
      requireApproval?: boolean;
      companionEnabled?: boolean;
    },
  ) => Promise<void>;
  deleteChild: (childId: ID) => Promise<void>;

  addMission: (input: {
    title: string;
    icon: string;
    minutes: number;
    repeat: RepeatRule;
    childIds: ID[];
    /** La mission se compte d'elle-même. Voir `Mission.autoApprove`. */
    autoApprove?: boolean;
  }) => Promise<ID>;
  editMission: (
    missionId: ID,
    patch: {
      title?: string;
      icon?: string;
      minutes?: number;
      repeat?: RepeatRule;
      autoApprove?: boolean;
      childIds?: ID[];
    },
  ) => Promise<void>;
  archiveMission: (missionId: ID) => Promise<void>;

  /**
   * Renvoie ce qui s'est réellement passé, pas ce qui était prévu.
   *
   * `counted` dit si les minutes sont arrivées tout de suite. L'écran s'appuyait
   * jusqu'ici sur `mission.autoApprove`, c'est-à-dire sur le réglage — et le
   * jour où le réglage et le résultat ont divergé (abonnement terminé, la
   * mission redevient ordinaire), il a félicité un enfant pour « +0 MINO »,
   * confettis compris.
   */
  completeMission: (childId: ID, missionId: ID) => Promise<{ id: ID; counted: boolean }>;
  approveCompletion: (completionId: ID) => Promise<void>;
  rejectCompletion: (completionId: ID) => Promise<void>;
  /** Un identifiant, ou tous ceux d'une même célébration. */
  markCelebrated: (completionId: ID | ID[]) => Promise<void>;

  /**
   * Ouvrir une fenêtre pendant laquelle l'écran ne coûte rien : mercredi
   * après-midi, vacances, anniversaire. Rien n'est écrit au grand livre.
   */
  addFreeWindow: (input: actions.FreeWindowInput) => Promise<ID>;
  /** Suspendre sans perdre : les vacances reviennent. */
  toggleFreeWindow: (windowId: ID) => Promise<void>;
  removeFreeWindow: (windowId: ID) => Promise<void>;

  addDevice: (input: { label: string; kind: DeviceKind }) => Promise<ID>;
  removeDevice: (deviceId: ID) => Promise<void>;

  startSession: (childId: ID, minutes: number, deviceId?: ID) => Promise<ID>;
  approveSession: (sessionId: ID) => Promise<void>;
  refuseSession: (sessionId: ID) => Promise<void>;
  endSession: (sessionId: ID, status?: 'finished' | 'stopped') => Promise<void>;
  adjustBalance: (childId: ID, delta: number, reason: string) => Promise<void>;
  grantBonus: (childId: ID, minutes: number, reason: string) => Promise<void>;

  loadBilling: () => Promise<void>;
  choosePlan: (plan: Plan) => Promise<CheckoutOutcome>;
  restorePurchases: () => Promise<CheckoutOutcome>;
  /**
   * Récupérer le mois offert d'un parrainage, là où il faut le demander.
   *
   * Chez Stripe il arrive tout seul. Chez Apple, l'offre promotionnelle doit
   * être acceptée par l'abonné — d'où un geste, et donc une action.
   */
  recupererMoisOffert: () => Promise<CheckoutOutcome>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  /** Remplacer la formule sur l'abonnement en cours, sans en ouvrir un second. */
  changePlan: (plan: Plan) => Promise<void>;
  redeemReferral: (code: string) => Promise<{ ok: boolean; reason?: string }>;
}

/**
 * Documents written before the PIN moved out of the family carry it on the
 * parent row. Left alone, those installs answer "wrong code" to every code
 * there is and the parent area becomes unreachable for good — so the PIN is
 * moved into the auth service on the first launch, and erased from the
 * document, which is the whole point of having moved it.
 */
async function migrateLegacyPin(
  data: FamilyData | null,
  repository: MinoRepository,
): Promise<FamilyData | null> {
  if (!data) return data;

  const legacy = data.parents.find((p) => typeof (p as { pin?: string }).pin === 'string');
  if (!legacy) return data;

  const pin = (legacy as { pin?: string }).pin!;
  const cleaned: FamilyData = {
    ...data,
    parents: data.parents.map(({ ...parent }) => {
      delete (parent as { pin?: string }).pin;
      return parent;
    }),
  };

  // Only drop it from the document once it is safely somewhere else.
  const stored = await getAuthService().setParentPin(pin);
  if (!stored.ok) return data;

  await repository.persist(cleaned, { kind: 'family.updated' }).catch(() => undefined);
  return cleaned;
}

export const useMinoStore = create<MinoState>((set, get) => {
  /**
   * The live link to the family, when the backend offers one.
   *
   * `writing` and `missed` exist for one race: a remote reload landing between
   * a local action and the write that saves it would replace what the parent
   * just did with the state from before they did it. So a reload arriving
   * mid-write is not dropped — it is remembered and replayed once the write has
   * settled.
   */
  let unwatch: (() => void) | null = null;
  let writing = 0;
  let missed = false;

  function watch(data: FamilyData | null) {
    unwatch?.();
    unwatch = null;

    const repository = get().repository;
    const familyId = data?.family.id;
    if (!familyId || !repository.subscribe) return;

    unwatch = repository.subscribe(familyId, (fresh) => {
      if (writing > 0) {
        missed = true;
        return;
      }
      set({ data: fresh });
      /**
       * Une plage libre réglée à l'instant doit s'appliquer ICI, maintenant.
       *
       * Le parent pose « mercredi 14 h – 16 h » sur son téléphone ; la tablette
       * de l'enfant reçoit la nouvelle et recharge la famille. Sans cette
       * ligne, elle connaîtrait la plage sans jamais lever le bouclier — le
       * réglage serait enregistré partout et sans effet nulle part, ce qui est
       * la pire des deux moitiés.
       */
      void get().appliquerPlageLibre();
    });
  }

  /** Publishes the family after a write, so `set` and `watch` never diverge. */
  function publish(data: FamilyData | null, rest: Partial<MinoState> = {}) {
    set({ data, ...rest } as Partial<MinoState>);
    watch(data);
  }

  /**
   * Redire au serveur à qui est cet appareil.
   *
   * La réponse — « il est à Raphaël », « il est partagé », « c'est mon
   * téléphone » — décide de qui reçoit les notifications de parents. Elle est
   * posée à l'inscription, mais elle se change ensuite dans les réglages, et
   * ce changement-là doit remonter : sinon le serveur continue d'écrire à un
   * appareil que le parent vient justement de réserver à son enfant.
   *
   * `void` et jamais attendu : c'est une déclaration, pas une action. Elle ne
   * doit ni ralentir l'écran ni le faire échouer.
   */
  function redireLeGenreDeLAppareil() {
    const famille = get().data;
    if (famille) void poserJetonPush(famille.family.id).catch(() => undefined);
  }

  /**
   * Ce que l'abonnement autorise encore.
   *
   * Posé ici et pas dans les écrans : le store est le seul chemin d'écriture,
   * donc le seul endroit où un verrou ne peut pas être contourné en appelant
   * la fonction d'à côté. Voir `domain/access` pour ce qui est verrouillé, et
   * surtout pour ce qui ne l'est jamais.
   */
  function requireAccess(action: GatedAction) {
    if (isLocked(get().subscription, action)) {
      throw new actions.DomainError(LOCKED_MESSAGE);
    }
  }

  /**
   * La base a-t-elle refusé le geste, ou le réseau a-t-il manqué ?
   *
   * PostgREST rend `42501` — privilège insuffisant — quand une politique
   * refuse l'écriture. C'est le cas de l'espace parent ouvert sur la tablette
   * d'un enfant : les politiques y demandent un vrai parent. Confondre ce
   * refus avec une panne de réseau envoie le parent réessayer indéfiniment
   * quelque chose qui ne marchera jamais.
   */
  function refusDeDroits(error: unknown): boolean {
    const e = error as { code?: unknown; message?: unknown } | null;
    if (e?.code === '42501') return true;
    return typeof e?.message === 'string' && /row-level security/i.test(e.message);
  }

  /** Runs a pure domain transition, persists it, publishes it. */
  async function commit<T>(
    kind: ChangeEvent['kind'],
    run: (data: FamilyData) => { data: FamilyData; result?: T; upsert?: Partial<FamilyData>; deleteChildId?: ID },
    // Le code à quatre chiffres, quand un parent agit depuis la tablette de
    // son enfant. Voir `ChangeEvent.codeParent`.
    options?: { codeParent?: string },
  ): Promise<T | undefined> {
    const current = get().data;
    if (!current) throw new actions.DomainError('Aucune famille chargée.');

    const outcome = run(current);
    set({ data: outcome.data, lastError: null });

    writing += 1;
    try {
      await get().repository.persist(outcome.data, {
        kind,
        upsert: outcome.upsert,
        deleteChildId: outcome.deleteChildId,
        codeParent: options?.codeParent,
      });
    } catch (error) {
      // Le serveur n'a pas pris l'écriture : on remet exactement l'état
      // d'avant. Sans cela l'enfant voit son compteur monter de quinze
      // minutes qui n'existent nulle part, et qui disparaîtront à la première
      // lecture réussie — c'est la dispute que tout ce produit existe pour
      // éviter. Mieux vaut ne rien promettre que promettre puis reprendre.
      set({
        data: current,
        lastError:
          error instanceof actions.DomainError
            ? error.message
            : refusDeDroits(error)
              ? // Un refus de droits ne se répare pas en réessayant, et le
                // message de réseau y envoyait pourtant : le parent appuyait
                // dix fois sur un mur permanent. Le cas connu est l'espace
                // parent ouvert sur la tablette de l'enfant, où la base
                // n'accepte de ce geste-là que la confirmation d'une mission,
                // passée par `valider-mission`.
                'Cette action demande le téléphone d’un parent. Depuis cet appareil, vous pouvez confirmer une mission, pas la modifier.'
              : 'Impossible de joindre Mino. Rien n’a été enregistré — réessayez dans un instant.',
      });
      throw error;
    } finally {
      writing -= 1;
    }

    // Something changed elsewhere while this was being written: pick it up now
    // rather than leave the two devices disagreeing until the next launch.
    if (writing === 0 && missed) {
      missed = false;
      const fresh = await get().repository.load().catch(() => null);
      if (fresh) set({ data: fresh });
    }

    return outcome.result;
  }

  /**
   * The one place a notification leaves from.
   *
   * Preferences and quiet hours are checked here, once, rather than at each
   * call site — a rule enforced in seven places is a rule that holds in six.
   * And it never throws: a notification that fails to schedule must not take
   * down the action that earned it.
   */
  async function announce(payload: notify.NotificationPayload | null) {
    if (!payload) return;

    /**
     * **Jamais à celui qui vient d'agir.**
     *
     * Cette branche est l'ancienne livraison, écrite quand rien ne partait vers
     * les autres appareils : elle affichait la notification ici, c'est-à-dire à
     * la seule personne déjà au courant. Depuis que le serveur pousse aux
     * autres — et qu'il exclut explicitement l'appareil appelant —, elle ne
     * produit plus qu'un doublon.
     *
     * Sur une tablette partagée, le doublon devient absurde : le parent
     * confirme une mission depuis le profil de son enfant, et l'appareil qu'il
     * tient en main lui annonce dans la seconde que « Raphaël a terminé une
     * mission ». C'est exactement ce qui apprend à couper les notifications, et
     * c'est alors la vraie demande qu'on ratera.
     *
     * On la garde comme filet, et seulement comme filet : quand aucun envoi
     * distant n'est possible — pas de session, pas de dépôt distant, donc pas
     * de jeton — elle reste le seul moyen que la famille apprenne quoi que ce
     * soit.
     */
    const distantPossible = get().repository.name !== 'local';
    if (!distantPossible && notify.shouldDeliver(payload, get().notifications)) {
      await getNotificationService()
        .schedule(payload)
        .catch(() => null);
    }

    /**
     * Et sur les AUTRES appareils de la famille — ce qui manquait entièrement.
     *
     * Tout partait localement, c'est-à-dire à la seule personne déjà au
     * courant : l'appareil qui vient d'agir. Un enfant terminait une mission à
     * 19 h et le parent l'apprenait en rouvrant Mino ; le parent validait à
     * 21 h et l'enfant le découvrait le lendemain. Or un enfant qui attend
     * jusqu'au lendemain cesse de relier l'effort à la récompense — la seule
     * chose que ce produit existe pour relier.
     *
     * Hors du `if` ci-dessus, à dessein : les préférences lues là sont celles
     * de CE téléphone, et elles n'ont pas à décider du silence de quelqu'un
     * d'autre. Un parent qui a coupé ses notifications ne doit pas priver son
     * enfant des siennes.
     *
     * Et jamais bloquant : une notification perdue ne doit pas faire échouer ce
     * qui l'a provoquée. La mission est validée, les minos sont crédités.
     */
    void pousserAuxAutres(payload).catch(() => undefined);
  }

  return {
    status: 'loading',
    repository: createRepository(),
    data: null,
    activeChildId: null,
    parentUnlocked: false,
    lastError: null,
    offline: false,
    subscription: null,
    referrals: [],
    device: NO_DEVICE_PROFILE,
    notifications: notify.DEFAULT_PREFERENCES,

    clearError() {
      set({ lastError: null });
    },

    setNotificationPreferences(patch) {
      set({ notifications: { ...get().notifications, ...patch } });
    },

    async bootstrap() {
      // Lu avant de publier : l'écran d'entrée décide où aller dès le premier
      // rendu, et un profil qui arrive une frame trop tard fait clignoter
      // « Qui utilise Mino ? » avant de l'escamoter.
      const device = await readDeviceProfile();

      // Le réseau tombe pour les raisons les plus banales : un ascenseur, un
      // sous-sol, une voiture. Laisser la promesse rejeter laissait
      // l'application sur son écran de démarrage, pour toujours et sans un
      // mot — `app/_layout.tsx` attend `status === 'ready'` pour l'escamoter.
      let data: FamilyData | null = null;
      let offline = false;
      try {
        data = await migrateLegacyPin(await get().repository.load(), get().repository);
      } catch {
        offline = true;
      }

      publish(data, { status: 'ready', device, offline });
      // L'appareil se déclare joignable dès qu'on sait de quelle famille il
      // est. Silencieux et sans effet s'il n'y a pas de permission.
      if (data) void poserJetonPush(data.family.id).catch(() => undefined);
      if (data) await get().loadBilling();
      if (data) void get().reportShield();
      // Une plage libre en cours doit ouvrir l'écran MAINTENANT, sans attendre
      // que l'enfant tente une séance qu'on lui refusera.
      if (data) void get().appliquerPlageLibre();
    },

    /**
     * Dire au reste de la famille dans quel état est le bouclier ICI.
     *
     * Appelé au lancement, et à chaque fois que l'écran de blocage touche à
     * l'autorisation. C'est ce qui ferme le mode de panne le plus grave du
     * produit : un adolescent retire à Mino l'accès aux statistiques d'usage,
     * le bouclier cesse d'exister, et le parent — qui lit l'autorisation de
     * SON téléphone, où tout va bien — n'apprend rien. Un bouclier mort dont
     * le parent ignore la mort produit la confiance sans la protection.
     *
     * `void` et jamais `await` chez l'appelant : c'est un rapport, pas une
     * action. Il ne doit ni ralentir un lancement ni faire échouer un écran.
     */
    async reportShield() {
      const report = get().repository.reportShield;
      if (!report) return;
      try {
        const natif = await getScreenTimeService().authorization();
        /**
         * Le choix du parent l'emporte sur ce que dit le système, et lui seul.
         *
         * Sans cette ligne, un appareil dont le parent a explicitement voulu le
         * compteur seul remontait « blocage pas encore réglé », en jaune, dans
         * la liste des appareils — c'est-à-dire qu'on lui reprochait sa propre
         * décision, tous les jours, sans moyen de la faire taire. Et le compteur
         * d'appareils « à regarder » ne retombait jamais à zéro, ce qui finit
         * par le rendre inutile pour ceux qui, eux, ont un vrai problème.
         *
         * Dans l'autre sens, on n'écrase rien : si le bouclier est bel et bien
         * accordé, c'est cela qu'on rapporte, quoi qu'ait coché le parent.
         */
        /**
         * Le téléphone d'un parent n'a rien à régler, et le dire coûtait cher.
         *
         * **Le défaut, trouvé en suivant le parcours du second parent.** Son
         * téléphone s'appaire comme n'importe quel appareil, et il remontait
         * donc son état de bouclier : « pas encore réglé », puisqu'aucune
         * autorisation n'y a jamais été demandée — et il n'y en a aucune à
         * demander, personne ne joue sur le téléphone de son père. Le tableau
         * de bord de l'autre parent affichait un avertissement jaune
         * permanent, avec une consigne qui reviendrait à mettre le téléphone
         * d'un adulte derrière le bouclier.
         *
         * Et ce n'est pas qu'inesthétique : un avertissement qui ne peut pas
         * s'éteindre apprend à ignorer les autres, y compris celui de la
         * tablette où le blocage manque vraiment.
         *
         * `compteur-seul` plutôt qu'un silence : l'appareil doit continuer à se
         * signaler vivant — `seenAt` est ce qui distingue « éteint depuis trois
         * jours » de « jamais installé ».
         */
        const status =
          natif === 'approved'
            ? natif
            : get().device.usagePersonnel
              ? 'telephone-parent'
              : get().device.compteurSeul
                ? 'compteur-seul'
                : natif;
        await report.call(get().repository, {
          status,
          // Le nom que le propriétaire a donné à son téléphone (« iPhone de
          // Malo »). Absent sur certaines configurations : l'écran parent se
          // rabat alors sur le prénom de l'enfant, qui est de toute façon
          // l'identifiant utile.
          label: Constants.deviceName ?? undefined,
          childId: get().device.lockedChildId,
        });
      } catch {
        // Le silence est lui-même une information, lue côté parent
        // dans `seenAt` : il n'y a rien à rattraper ici.
      }
    },

    /** Réessayer après une coupure, sans redémarrer l'application. */
    async retry() {
      set({ status: 'loading', lastError: null });
      await get().bootstrap();
    },

    async startDemo() {
      const data = buildDemoFamily();
      publish(data, { status: 'ready', activeChildId: null, parentUnlocked: false });
      await get().repository.persist(data, { kind: 'bootstrap' });
      // Le code de la démo vit où vivent tous les codes — dans le service
      // d'authentification, jamais dans le document familial. Et après
      // l'écriture de la famille : `set_parent_pin` exige maintenant une ligne
      // dans `parents`, faute de quoi la tablette d'un enfant se choisirait son
      // propre code parent. Même raison que dans `createAccount`.
      await getAuthService().setParentPin(DEMO_PARENT_PIN);
      await get().loadBilling();
    },

    /**
     * Fonder la famille avant que le parent ne se présente.
     *
     * C'est le premier écran du nouveau parcours : on demande le prénom de
     * l'enfant, et rien d'autre. Pour l'écrire il faut pourtant une identité —
     * chaque ligne que la base accepte est cadrée par elle — d'où la session
     * anonyme, la même que celle des tablettes d'enfants.
     *
     * **Ce que cela achète.** Le parent voit sa famille exister, puis son
     * enfant, puis sa première mission, avant qu'on lui demande une adresse.
     * L'ordre inverse — quatre champs et une case à cocher devant quelqu'un
     * qui n'a encore rien vu — est l'endroit du parcours où l'on perdait le
     * plus de monde.
     *
     * Le consentement est recueilli **ici**, et pas plus tard : il précède la
     * création du profil de l'enfant, c'est ce que le dossier déposé chez
     * Apple affirme, et c'est la date qui vaut preuve.
     *
     * Idempotent : une famille déjà là n'est pas remplacée. Rouvrir
     * l'application au milieu de l'inscription ne doit pas effacer l'enfant
     * qu'on vient de créer.
     */
    async fonderFamille({ consentAt }: { consentAt: string }) {
      if (get().data) return { ok: true as const };
      try {
        await getAuthService().signInAsDevice();
        const data = buildEmptyFamily({ familyName: 'Ma famille', consentAt });
        publish(data, { status: 'ready', activeChildId: null, parentUnlocked: true });
        await get().repository.persist(data, { kind: 'bootstrap' });
        await get().loadBilling();
        return { ok: true as const };
      } catch (e) {
        // Sans famille, l'écran suivant n'a rien où écrire l'enfant. Le dire
        // ici, une fois, plutôt que de laisser échouer trois écrans plus loin.
        publish(null, { status: 'ready' });

        /**
         * L'identité périmée, dite en français.
         *
         * C'est ici qu'elle frappe : au tout premier écran, celui du prénom de
         * l'enfant. Un jeton encore valide désignant un compte supprimé passe
         * les politiques RLS — `auth.uid()` lit le jeton, il ne vérifie rien —
         * puis Postgres refuse : « insert or update on table "parents"
         * violates foreign key constraint parents_user_id_fkey ». C'est cette
         * phrase-là qu'un parent voyait en appuyant sur « Continuer ».
         *
         * `signInAsDevice` referme le chemin en amont, en demandant au serveur
         * si la session vaut encore quelque chose au lieu de croire ce qui est
         * stocké. Ceci reste le filet, et il dit la seule chose utile.
         */
        const dit = (e as { message?: string } | null)?.message ?? '';
        if (/parents_user_id_fkey|foreign key constraint/i.test(dit)) {
          await getAuthService().signOut().catch(() => undefined);
          return {
            ok: false as const,
            reason:
              'Votre session n’était plus valable. Touchez à nouveau « Continuer » — rien n’a été enregistré.',
          };
        }

        return {
          ok: false as const,
          reason:
            dit || 'Impossible de créer votre famille. Vérifiez votre connexion et réessayez.',
        };
      }
    },

    async createAccount({ parentName, email, password, pin, familyName, consentAt }) {
      /**
       * Un compte sans famille n'est pas un cas tordu : c'est l'état de tout
       * parent qui confirme son adresse plus tard, ou qui referme
       * l'application entre les deux écrans. Il se connecte, n'a rien à
       * ouvrir, et le seul bouton qu'on lui propose l'envoie ici.
       *
       * Le renvoyer vers `signUp` était une impasse fermée à double tour : son
       * adresse est prise, et une adresse prise reçoit exprès la même réponse
       * évasive que n'importe quelle autre — il ne pouvait donc même pas
       * apprendre pourquoi. On saute l'inscription et on ne crée que ce qui
       * manque.
       */
      /**
       * Trois états, et les confondre coûte une famille.
       *
       * `kind === 'parent'` — il est déjà identifié : rien à créer côté compte.
       *
       * `kind === 'device'` **avec une session ouverte** — c'est le fondateur
       * du nouveau parcours : il a créé sa famille et son premier enfant sur
       * une session anonyme, et vient donner son adresse. Il faut l'habiller,
       * pas le réinscrire. `signUp` ouvrirait ici un SECOND utilisateur et
       * abandonnerait le premier, avec la famille et l'enfant dessus — le
       * parent se retrouverait devant une application vide, sans que rien ne
       * dise où est passé ce qu'il venait de faire.
       *
       * `kind === 'none'` — personne : c'est une inscription ordinaire.
       *
       * Le code d'avant ne distinguait que « parent » et « le reste », parce
       * qu'au moment où il a été écrit, « le reste » ne pouvait être qu'une
       * absence de session.
       */
      /**
       * **La question n'est pas « est-il parent », c'est « a-t-il de quoi se
       * reconnecter ».** Et les confondre a coûté un compte inutilisable.
       *
       * `session()` interroge `auth_is_parent()`, qui répond « oui » dès qu'une
       * ligne `parents` existe pour cet utilisateur. Or `fonderFamille` en crée
       * une, sur une session **anonyme**, deux écrans plus tôt. Au moment où le
       * parent tape enfin son adresse et son mot de passe, il est donc déjà
       * « parent » — et tout ce bloc était sauté. `linkEmail` n'était jamais
       * appelé : ni adresse, ni mot de passe posés sur le compte.
       *
       * Vu de la famille, tout marche — jusqu'à la déconnexion, ou au
       * changement de navigateur. Là il n'y a plus rien : aucune adresse pour
       * se reconnaître, aucun mot de passe à taper, et la famille reste
       * attachée à un utilisateur anonyme que personne ne peut plus rouvrir.
       * Aucun e-mail de confirmation ne partait non plus, pour la même raison.
       *
       * On regarde donc l'adresse, qui est ce dont on a besoin, plutôt que le
       * rôle, qui n'en dit rien.
       */
      const ouverte = await getAuthService().session();
      if (!ouverte.email) {
        if (!password) return { ok: false, reason: 'Choisissez un mot de passe.' };
        const auth = getAuthService();
        const compte =
          ouverte.kind !== 'none'
            ? // Une session est ouverte — anonyme, ou déjà porteuse de la
              // famille. On l'habille : `signUp` en ouvrirait un second et
              // abandonnerait le premier, avec la famille et l'enfant dessus.
              await auth.linkEmail({ email, password })
            : // Sans identité, il n'y a rien à quoi rattacher une famille :
              // chaque ligne que le serveur écrira est cadrée par elle.
              await auth.signUp({ email, password });
        if (!compte.ok) return compte;
      }

      const nom = familyName?.trim() || `Famille de ${parentName}`;
      // L'adresse du compte ouvert fait foi sur celle qui a été tapée : c'est
      // elle que la base rattachera aux lignes de cette famille. Elle est
      // absente tant que la confirmation n'a pas eu lieu — auquel cas celle
      // que le parent vient de taper est la seule que nous ayons.
      // `||` et non `??` : voir `decrire()` dans `SupabaseAuthService`. Une
      // session anonyme rend une adresse vide, que `??` laisse passer devant
      // celle que le parent vient de taper.
      const adresse = ouverte.email?.trim() || email;

      /**
       * La famille existe déjà : on la complète, on ne la refait pas.
       *
       * C'est le cas du nouveau parcours — elle a été fondée au premier écran,
       * elle porte déjà l'enfant et sa première mission. La reconstruire ici
       * les effacerait, et c'est exactement ce que le parent croirait avoir
       * perdu.
       */
      const existante = get().data;
      const data: FamilyData = existante
        ? {
            ...existante,
            family: { ...existante.family, name: nom },
            parents: existante.parents.map((p, i) =>
              i === 0
                ? { ...p, displayName: parentName, email: adresse, consentAt: p.consentAt ?? consentAt }
                : p,
            ),
          }
        : buildEmptyFamily({ parentName, email: adresse, familyName: nom, consentAt });

      publish(data, { status: 'ready', activeChildId: null, parentUnlocked: true });

      /**
       * Créer, ou compléter — et l'écrire dans le bon mode.
       *
       * `bootstrap` fait des `insert` francs, et c'est délibéré : sur une
       * famille qu'on vient d'inventer, un `upsert` déclenche la politique de
       * mise à jour, laquelle exige d'appartenir déjà à cette famille. Personne
       * n'appartient à une famille qui n'existe pas encore.
       *
       * Mais ici, quand elle a été fondée deux écrans plus tôt, ces mêmes
       * `insert` retombent sur des lignes déjà présentes : « duplicate key
       * value violates unique constraint families_pkey ». C'est la panne qu'a
       * révélée le premier vrai parcours — invisible aux tests, qui n'écrivent
       * pas dans Postgres.
       *
       * À ce stade le parent appartient bien à sa famille : la fusion est
       * permise, et c'est elle qu'il faut.
       */
      try {
        await get().repository.persist(
          data,
          existante
            ? { kind: 'family.updated', upsert: { family: data.family, parents: data.parents } }
            : { kind: 'bootstrap' },
        );
      } catch (erreur) {
        /**
         * Traduire l'identité périmée, au lieu de montrer du SQL à un parent.
         *
         * `parents.user_id` prend pour valeur par défaut `auth.uid()`, c'est-à-
         * dire l'identifiant écrit dans le jeton — que Postgres ne vérifie pas.
         * Un jeton encore valide désignant un compte supprimé passe donc les
         * politiques RLS et échoue sur la clé étrangère, en anglais et en
         * jargon, au milieu de l'inscription.
         *
         * `signInAsDevice` referme désormais ce chemin en amont. Ceci reste le
         * filet : la panne est rare, elle est irrattrapable sur place, et la
         * seule chose utile à dire est comment repartir.
         */
        const dit = erreur instanceof Error ? erreur.message : '';
        if (/parents_user_id_fkey|foreign key constraint/i.test(dit)) {
          await getAuthService().signOut().catch(() => undefined);
          publish(null, { status: 'ready', activeChildId: null, parentUnlocked: false });
          return {
            ok: false,
            reason:
              'Votre session n’était plus valable. Fermez Mino, rouvrez-le, et recommencez — rien n’a été enregistré.',
          };
        }
        throw erreur;
      }
      /**
       * Le code parent APRÈS l'écriture de la famille, et pas avant.
       *
       * **L'ordre n'est plus cosmétique depuis que le code appartient à la
       * famille** — voir `supabase/code-parent-famille.sql`. `set_parent_pin`
       * refuse désormais un appelant qui n'a pas de ligne dans `parents` : sans
       * cela, la tablette d'un enfant se choisirait son propre code parent.
       *
       * Cet appel se faisait juste après la création du compte, donc avant
       * `persist`. Sur le parcours ordinaire cela passait — la famille avait
       * été fondée deux écrans plus tôt — mais sur celui où elle se crée ici
       * même (`buildEmptyFamily`), la ligne parent n'existait pas encore et
       * l'inscription échouait à la dernière étape, sur un code refusé sans
       * raison visible.
       *
       * Déplacé ici, la ligne est écrite dans les deux cas.
       *
       * Pas de code à poser quand il y en a déjà un : le redemander à quelqu'un
       * qui vient de le choisir n'apporte rien, et lui laisse croire que le
       * premier n'a pas été retenu.
       */
      if (pin) {
        const pinSet = await getAuthService().setParentPin(pin);
        if (!pinSet.ok) return pinSet;
      }

      await get().loadBilling();

      /**
       * La bienvenue part d'ici, et d'ici seulement.
       *
       * C'est le premier instant du parcours où l'on connaît une adresse — aux
       * deux écrans précédents, le parent n'en avait pas donné. L'envoyer plus
       * tôt reviendrait à écrire à personne.
       *
       * `void` et jamais `await` : un e-mail qui ne part pas ne doit pas
       * retenir un parent devant un bouton qui tourne. Sa famille existe, elle
       * est enregistrée, c'est ce qui compte — et la fonction refuse d'elle-même
       * d'écrire deux fois à la même famille.
       */
      void envoyerCourrier('bienvenue').catch(() => undefined);
      return { ok: true };
    },

    async signIn(input) {
      const result = await getAuthService().signIn(input);
      if (!result.ok) return result;
      const data = await get().repository.load();
      publish(data, { status: 'ready', activeChildId: null, parentUnlocked: true });
      if (data) void poserJetonPush(data.family.id).catch(() => undefined);
      if (data) await get().loadBilling();
      return { ok: true };
    },

    /**
     * Se déconnecter, c'est aussi oublier la famille — pas seulement le droit
     * de la voir.
     *
     * L'ancienne version ne remettait que `parentUnlocked` à faux et laissait
     * `data` en mémoire. Sur un appareil partagé, le parent suivant se
     * connectait et voyait, le temps du chargement, les enfants du précédent.
     * Une frontière de compte qui tient une demi-seconde ne tient pas.
     */
    async signOut() {
      // Avant la déconnexion, tant qu'on a encore le droit d'écrire : un
      // téléphone revendu ne doit plus recevoir de notifications portant le
      // prénom d'un enfant.
      await retirerJetonPush().catch(() => undefined);
      await getAuthService().signOut();
      publish(null, {
        activeChildId: null,
        parentUnlocked: false,
        status: 'ready',
        subscription: null,
        referrals: [],
      });
    },

    /**
     * Partir pour de bon.
     *
     * Deux effacements, et il en faut deux : le serveur d'abord — c'est lui
     * qui détient les enfants, les missions et le grand livre — puis
     * l'appareil, sans quoi Mino rouvrirait sur une famille qui n'existe plus
     * nulle part et échouerait à chaque écriture sans savoir dire pourquoi.
     *
     * Si le serveur refuse, on ne vide rien. Un compte à moitié supprimé est
     * plus difficile à rattraper qu'un compte pas supprimé du tout.
     */
    async deleteAccount() {
      const result = await getAuthService().deleteAccount();
      if (!result.ok) return result;
      await get().resetAll();
      return { ok: true };
    },

    async joinFamily(input) {
      const data = await get().repository.joinFamily(input);
      if (!data) return false;
      // Cet appareil est celui d'un enfant, et l'application doit pouvoir le
      // savoir : c'est ce qui distingue « aucun code parent n'est défini, à
      // vous d'en choisir un » de « demande à un parent ».
      await getAuthService().signInAsDevice().catch(() => undefined);
      // The child's device never lands in the parent area, whatever it holds.
      publish(data, { status: 'ready', activeChildId: null, parentUnlocked: false });
      await get().loadBilling();
      return true;
    },

    async resetAll() {
      await get().repository.clear();
      // Un appareil réservé à un enfant qui n'existe plus rouvrirait sur le
      // vide : le réglage part avec les données qu'il désignait.
      await writeDeviceProfile({ lockedChildId: null, lastChildId: null }).catch(() => undefined);
      publish(null, {
        activeChildId: null,
        parentUnlocked: false,
        status: 'ready',
        subscription: null,
        referrals: [],
        device: NO_DEVICE_PROFILE,
      });
    },

    selectChild(childId) {
      /**
       * Tendre l'appareil à un enfant referme l'espace parent.
       *
       * **Le défaut, trouvé sur un vrai iPhone.** `parentUnlocked` passe à vrai
       * à la fin de l'inscription — le parent vient de créer sa famille, il est
       * évidemment là — et plus rien ne le remettait à faux avant le
       * redémarrage de l'application. Sur la tablette partagée du salon, c'est
       * exactement le scénario : le parent finit l'installation, choisit le
       * profil de son enfant, lui tend la tablette, et l'enfant touche « Espace
       * parent ». Il entre. Pas de code demandé, rien.
       *
       * Il pouvait alors s'accorder des minutes, confirmer ses propres
       * missions, supprimer le blocage. C'est-à-dire tout le produit.
       *
       * La règle qui manquait tient en une ligne : l'espace parent n'est ouvert
       * que tant que le parent s'en sert. Dès qu'un profil d'enfant devient
       * actif, il se referme — et se rouvrira par le code, comme il se doit.
       */
      set({ activeChildId: childId, ...(childId ? { parentUnlocked: false } : {}) });
      // Se souvenir, pour que l'enfant ne repasse pas par « Qui utilise Mino ? »
      // à chaque lancement. Un appareil qui oublie qui s'en sert est un appareil
      // qui demande la même chose tous les jours.
      if (childId) {
        writeDeviceProfile({ lastChildId: childId })
          .then((device) => set({ device }))
          .catch(() => undefined);
      }
      // Un enfant qui ouvre son profil pendant une plage libre doit trouver
      // son écran ouvert, pas un refus poli.
      if (childId) void get().appliquerPlageLibre();
    },

    resumeChildId() {
      const data = get().data;
      if (!data) return null;
      return profileToOpen(get().device, data.children);
    },

    async lockDeviceTo(childId) {
      // Réserver l'appareil, c'est aussi le rouvrir dessus : les deux réglages
      // se contrediraient sinon au prochain lancement.
      const device = await writeDeviceProfile({
        lockedChildId: childId,
        ...(childId ? { lastChildId: childId } : {}),
      });
      set({ device });
      // La réponse vient de changer, et elle décide à qui le serveur écrit :
      // il faut la lui redire. Voir `poserJetonPush`.
      redireLeGenreDeLAppareil();
    },

    /**
     * La réponse à « à qui est cet appareil ? », d'où qu'elle vienne.
     *
     * Les trois champs s'écrivent ensemble ou pas du tout : écrits séparément,
     * ils se contredisent — c'est ce qui rendait la réponse incorrigible
     * depuis les réglages, qui n'en touchaient qu'un seul. Voir
     * `etatsPourChoix`.
     */
    /**
     * Le parent est là, et il vient de le prouver par un geste.
     *
     * En mémoire seulement, jamais dans AsyncStorage : ce signal ne doit pas
     * survivre à la fermeture de l'application. Voir `parentGate`.
     */
    poseDuCodeAutorisee: false,

    autoriserLaPoseDuCode() {
      set({ poseDuCodeAutorisee: true });
    },

    consommerLAutorisationDeCode() {
      if (get().poseDuCodeAutorisee) set({ poseDuCodeAutorisee: false });
    },

    async ajouterParent({ prenom, code }) {
      // Le code n'accompagne le geste que depuis un appareil : le titulaire du
      // compte est déjà parent aux yeux de la base.
      const cree = await ajouterParentDistant({
        prenom,
        code: code ?? get().codeParentEnMemoire ?? undefined,
      });
      /**
       * On pose la ligne ici plutôt que de tout relire.
       *
       * `retry()` repasse par `status: 'loading'`, ce qui escamote l'écran en
       * cours — et cet ajout se fait justement au milieu de l'appairage d'un
       * téléphone, à l'étape qui demande « à qui est cet appareil ». Le
       * serveur a déjà écrit la ligne et vient de nous la rendre : il n'y a
       * rien à deviner.
       */
      const famille = get().data;
      if (famille) {
        publish({
          ...famille,
          parents: [
            ...famille.parents,
            {
              id: cree.id,
              familyId: famille.family.id,
              displayName: cree.prenom,
              // Ni compte, ni adresse : c'est ce qui distingue un profil d'un
              // titulaire, et `delete_my_account` en dépend.
              email: null,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      return cree.id;
    },

    async rattacherParent(id, code) {
      await rattacherParentDistant({ id, code });
      await get().declarerUsage({ kind: 'parent', parentId: id });
    },

    async retirerParent(id) {
      await retirerParentDistant({ id, code: get().codeParentEnMemoire ?? undefined });
      // Si c'était le parent de CET appareil, la ligne n'existe plus : on
      // efface la référence plutôt que de laisser pointer vers un vide.
      if (get().device.parentId === id) {
        await get().declarerUsage({ kind: 'parent', parentId: null });
      }
      const famille = get().data;
      if (famille) {
        publish({ ...famille, parents: famille.parents.filter((p) => p.id !== id) });
      }
    },

    async declarerUsage(choix) {
      /**
       * Redire « c'est mon téléphone » n'efface pas DE QUI il est.
       *
       * Le chip « À moi » des réglages, et celui de l'inscription, envoient
       * `{ kind: 'parent' }` sans plus de précision — ils n'ont pas à connaître
       * le second parent. Sans cette ligne, le père qui rouvre ses réglages et
       * confirme ce qui était déjà coché perdait son prénom et se faisait
       * saluer de celui de sa femme, sans avoir rien changé.
       *
       * `undefined` veut dire « ne touche pas », `null` veut dire « oublie » —
       * et c'est `retirerParent` qui s'en sert pour le second.
       */
      const complet = choixComplete(choix, get().device.parentId);
      const etats = etatsPourChoix(complet);
      const device = await writeDeviceProfile({
        ...etats,
        // Réserver l'appareil, c'est aussi le rouvrir dessus : les deux
        // réglages se contrediraient sinon au prochain lancement.
        ...(complet.kind === 'enfant' ? { lastChildId: complet.childId } : {}),
      });
      set({ device });
      // La réponse décide à qui le serveur écrit : il faut la lui redire.
      redireLeGenreDeLAppareil();
    },

    async setUsagePersonnel(valeur) {
      set({ device: await writeDeviceProfile({ usagePersonnel: valeur }) });
      redireLeGenreDeLAppareil();
    },

    /**
     * « Un enfant se sert de cet appareil », dit par le parent à l'inscription.
     *
     * Ce que l'écran du code parent lit pour refuser à un enfant de CHOISIR le
     * code sur la tablette du salon. Il lui faut un signal positif : l'absence
     * d'`usagePersonnel` vaut aussi bien « partagé » que « la question n'a
     * jamais été posée », et confondre les deux verrouillerait tous les
     * appareils déjà installés hors de leur propre espace parent.
     */
    async setDeclareALEnfant(valeur) {
      set({ device: await writeDeviceProfile({ declareALEnfant: valeur }) });
    },

    async activerNotifications() {
      const accorde = await getNotificationService()
        .requestPermission()
        .catch(() => false);
      // Le jeton ne peut être demandé qu'une fois la permission accordée — et
      // il doit l'être tout de suite. Sans cette ligne, le parent autorise les
      // notifications et n'en reçoit aucune jusqu'au prochain lancement.
      if (accorde) redireLeGenreDeLAppareil();
      return accorde;
    },

    async setCompteurSeul(valeur) {
      const device = await writeDeviceProfile({ compteurSeul: valeur });
      set({ device });
      // Le reste de la famille doit le savoir : sans cela, le tableau des
      // appareils continuerait d'afficher « bouclier absent » en rouge sur un
      // appareil dont le parent a explicitement dit qu'il n'en voulait pas.
      void get().reportShield();
    },

    /**
     * Asynchronous now, and deliberately so: the PIN is checked by the auth
     * service, which rate-limits it. Four digits is ten thousand guesses, and a
     * comparison done here would be a comparison a child's device could skip.
     */
    codeParentEnMemoire: null,

    async unlockParent(pin) {
      const result = await getAuthService().verifyParentPin(pin);
      if (!result.ok) return result;

      /**
       * On ne retient le code que là où il sert.
       *
       * Sur le téléphone d'un parent, l'écriture passe déjà : garder quatre
       * chiffres n'y apporterait rien et serait une mauvaise habitude. Sur la
       * tablette de son enfant, c'est la seule preuve que le serveur accepte,
       * et il la redemande à chaque geste.
       */
      const session = await getAuthService()
        .session()
        .catch(() => ({ kind: 'none' as const }));

      set({
        parentUnlocked: true,
        activeChildId: null,
        codeParentEnMemoire: session.kind === 'device' ? pin : null,
      });
      return result;
    },

    lockParent() {
      // Le code part avec le verrou : c'est le moment exact où la tablette
      // peut changer de mains.
      set({ parentUnlocked: false, codeParentEnMemoire: null });
    },

    async addChild(input) {
      requireAccess('child.write');
      const id = await commit<ID>('child.created', (data) => {
        const out = actions.createChild(data, input);
        return { data: out.data, result: out.child.id, upsert: { children: [out.child] } };
      });
      return id!;
    },

    async editChild(childId, patch) {
      requireAccess('child.write');
      await commit('child.updated', (data) => {
        const next = actions.updateChild(data, childId, patch);
        const child = next.children.find((c) => c.id === childId);
        return { data: next, upsert: child ? { children: [child] } : undefined };
      });
    },

    async deleteChild(childId) {
      await commit('child.removed', (data) => ({
        data: actions.removeChild(data, childId),
        deleteChildId: childId,
      }));
      if (get().activeChildId === childId) set({ activeChildId: null });
    },

    async addMission(input) {
      requireAccess('mission.write');
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      const id = await commit<ID>('mission.created', (data) => {
        const out = actions.createMission(data, { ...input, createdBy: parentId });
        const assignments = out.data.assignments.filter((a) => a.missionId === out.mission.id);
        return {
          data: out.data,
          result: out.mission.id,
          upsert: { missions: [out.mission], assignments },
        };
      });
      return id!;
    },

    async editMission(missionId, patch) {
      requireAccess('mission.write');
      await commit('mission.updated', (data) => {
        const next = actions.updateMission(data, missionId, patch);
        const mission = next.missions.find((m) => m.id === missionId);
        return {
          data: next,
          upsert: {
            missions: mission ? [mission] : [],
            // Les affectations partent avec la mission : changer les enfants
            // concernés en désactive et en crée, et une modification qui ne
            // remonterait qu'à moitié laisserait l'autre téléphone afficher la
            // mission à un enfant qui ne l'a plus.
            ...(patch.childIds
              ? { assignments: next.assignments.filter((a) => a.missionId === missionId) }
              : {}),
          },
        };
      });
    },

    async archiveMission(missionId) {
      requireAccess('mission.write');
      await commit('mission.archived', (data) => {
        const next = actions.archiveMission(data, missionId);
        const mission = next.missions.find((m) => m.id === missionId);
        return {
          data: next,
          upsert: {
            missions: mission ? [mission] : [],
            assignments: next.assignments.filter((a) => a.missionId === missionId),
          },
        };
      });
    },

    async completeMission(childId, missionId) {
      // Volontairement sans `requireAccess` : un enfant déclare toujours ce
      // qu'il a fait. Seul le crédit immédiat s'arrête — la mission attend
      // alors une confirmation, comme n'importe quelle autre.
      const autoApproveAllowed = !isLocked(get().subscription, 'confirm');
      const out = await commit<{ id: ID; counted: boolean }>('completion.created', (data) => {
        const next = actions.completeMission(data, { childId, missionId, autoApproveAllowed });
        return {
          data: next.data,
          result: { id: next.completion.id, counted: !!next.transaction },
          upsert: {
            completions: [next.completion],
            // La transaction part avec la complétion : les deux écritures
            // décrivent le même événement et ne doivent pas pouvoir se séparer.
            ...(next.transaction ? { transactions: [next.transaction] } : {}),
          },
        };
      });

      const data = get().data;
      const child = notify.childOf(data, childId);
      const mission = data?.missions.find((m) => m.id === missionId);

      // Deux notifications différentes pour deux situations différentes : l'une
      // appelle une décision, l'autre informe. Les confondre apprend au parent
      // à ne plus les ouvrir.
      if (child && mission) {
        await announce(
          out?.counted
            ? notify.missionCountedItself(child, mission)
            : notify.missionCompleted(child, mission),
        );
      }
      return { id: out!.id, counted: !!out?.counted };
    },

    async approveCompletion(completionId) {
      requireAccess('confirm');
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      await commit(
        'completion.approved',
        (data) => {
          const out = actions.approveCompletion(data, { completionId, parentId });
          return {
            data: out.data,
            upsert: { completions: [out.completion], transactions: [out.transaction] },
          };
        },
        { codeParent: get().codeParentEnMemoire ?? undefined },
      );

      const data = get().data;
      const completion = data?.completions.find((c) => c.id === completionId);
      const child = notify.childOf(data, completion?.childId);
      if (child && completion) {
        await announce(notify.completionApproved(child, completion.minutesAwarded));
      }
    },

    async rejectCompletion(completionId) {
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      await commit(
        'completion.rejected',
        (data) => {
          const out = actions.rejectCompletion(data, { completionId, parentId });
          return { data: out.data, upsert: { completions: [out.completion] } };
        },
        { codeParent: get().codeParentEnMemoire ?? undefined },
      );

      const data = get().data;
      const completion = data?.completions.find((c) => c.id === completionId);
      const child = notify.childOf(data, completion?.childId);
      const mission = data?.missions.find((m) => m.id === completion?.missionId);
      if (child && mission) await announce(notify.completionRejected(child, mission));
    },

    async markCelebrated(completionId) {
      const ids = Array.isArray(completionId) ? completionId : [completionId];
      if (ids.length === 0) return;
      await commit('completion.celebrated', (data) => {
        const next = actions.markCelebrated(data, ids);
        return {
          data: next,
          upsert: { completions: next.completions.filter((c) => ids.includes(c.id)) },
        };
      });
    },

    async addFreeWindow(input) {
      const id = await commit<ID>('freeWindow.created', (data) => {
        const out = actions.createFreeWindow(data, input);
        return { data: out.data, result: out.window.id, upsert: { freeWindows: [out.window] } };
      });
      return id!;
    },

    async toggleFreeWindow(windowId) {
      await commit('freeWindow.updated', (data) => {
        const next = actions.toggleFreeWindow(data, windowId);
        const window = next.freeWindows.find((f) => f.id === windowId);
        return { data: next, upsert: window ? { freeWindows: [window] } : undefined };
      });
    },

    async removeFreeWindow(windowId) {
      await commit('freeWindow.removed', (data) => ({
        data: actions.removeFreeWindow(data, windowId),
        // Suppression franche : contrairement à un appareil, une plage passée
        // n'est désignée par aucune session ni aucune transaction.
        deleteFreeWindowId: windowId,
      }));
    },

    async addDevice(input) {
      const id = await commit<ID>('family.updated', (data) => {
        const out = actions.addDevice(data, input);
        return { data: out.data, result: out.device.id, upsert: { devices: [out.device] } };
      });
      return id!;
    },

    async removeDevice(deviceId) {
      await commit('family.updated', (data) => {
        const next = actions.removeDevice(data, deviceId);
        const device = next.devices.find((d) => d.id === deviceId);
        return { data: next, upsert: device ? { devices: [device] } : undefined };
      });
    },

    async startSession(childId, minutes, deviceId) {
      const id = await commit<ID>('session.started', (data) => {
        const out = actions.startSession(data, { childId, minutes, deviceId });
        return { data: out.data, result: out.session.id, upsert: { sessions: [out.session] } };
      });

      const data = get().data;
      const session = data?.sessions.find((s) => s.id === id);
      const child = notify.childOf(data, childId);
      if (!child || !session) return id!;

      if (session.status === 'requested') {
        await announce(notify.sessionRequested(child, minutes, data?.devices, deviceId));
      } else {
        await announce(notify.sessionEndingSoon(child, session.endsAt));
      }
      return id!;
    },

    async approveSession(sessionId) {
      requireAccess('other-screen');
      await commit('session.started', (data) => {
        const out = actions.approveSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });

      const data = get().data;
      const session = data?.sessions.find((s) => s.id === sessionId);
      const child = notify.childOf(data, session?.childId);
      if (child && session) await announce(notify.sessionEndingSoon(child, session.endsAt));
    },

    async refuseSession(sessionId) {
      await commit('session.ended', (data) => {
        const out = actions.refuseSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });
    },

    async endSession(sessionId, status) {
      // The session is over, so the five-minute warning must not still be in
      // the queue — a child who stopped early does not get buzzed about it.
      await getNotificationService()
        .cancelKind('session.endingSoon')
        .catch(() => undefined);
      await commit('session.ended', (data) => {
        const out = actions.endSession(data, { sessionId, status });
        return {
          data: out.data,
          upsert: {
            sessions: [out.session],
            transactions: out.transaction ? [out.transaction] : [],
          },
        };
      });
    },

    async adjustBalance(childId, delta, reason) {
      requireAccess('grant');
      await commit('balance.adjusted', (data) => {
        const next = actions.adjustBalance(data, { childId, delta, reason });
        return { data: next, upsert: { transactions: next.transactions.slice(-1) } };
      });
    },

    async grantBonus(childId, minutes, reason) {
      requireAccess('grant');
      await commit('balance.adjusted', (data) => {
        const next = actions.grantBonus(data, { childId, minutes, reason });
        return { data: next, upsert: { transactions: next.transactions.slice(-1) } };
      });

      const child = notify.childOf(get().data, childId);
      if (child) await announce(notify.bonusGranted(child, minutes, reason));
    },

    /* ------------------------------------------------------------ billing */

    async appliquerPlageLibre() {
      const etat = get();
      const data = etat.data;
      if (!data) return;

      /**
       * De quel enfant parle-t-on sur CET appareil ?
       *
       * Le profil ouvert d'abord, l'enfant à qui l'appareil est réservé
       * ensuite. Sur la tablette du salon sans personne dessus, `null` : une
       * plage qui vise toute la famille s'applique quand même, et
       * `openWindowAt` sait le dire.
       */
      const childId = etat.activeChildId ?? etat.device.lockedChildId ?? null;

      // Sur le téléphone d'un parent, il n'y a rien à ouvrir : aucun bouclier
      // n'y a jamais été posé.
      if (etat.device.usagePersonnel) return;

      const maintenant = new Date();
      const ouverte = openWindowAt(data.freeWindows ?? [], childId, maintenant);
      if (!ouverte) return;

      // L'échéance se calcule en minutes restantes plutôt qu'en reconstruisant
      // une heure : le fuseau et le passage à l'heure d'été ne s'invitent pas
      // dans une soustraction de minutes.
      const reste = minutesRestantes(ouverte, maintenant);
      if (reste <= 0) return;

      await getScreenTimeService()
        .ouvrirPlageLibre(new Date(maintenant.getTime() + reste * 60_000))
        .catch(() => undefined);
    },

    async loadBilling() {
      const familyId = get().data?.family.id;
      if (!familyId) return;
      const billing = getBillingService();
      /**
       * Une lecture ratée n'est pas un abonnement terminé.
       *
       * **Le défaut, et il tombait au pire moment.** Les deux appels étaient
       * rattrapés par `.catch(() => null)`, puis écrits tels quels : une seule
       * réponse manquée — un ascenseur, un Wi-Fi d'hôtel, une coupure d'une
       * seconde — effaçait l'abonnement connu. L'écran annonçait alors
       * « Abonnement terminé » et proposait de racheter, à une famille qui
       * paie. Et le moment le plus probable pour que cette lecture manque est
       * précisément le premier lancement sur un téléphone neuf, c'est-à-dire
       * quand le parent a le plus besoin de voir que tout l'a suivi.
       *
       * Billing ne doit jamais bloquer l'application — un fournisseur de
       * paiement en panne n'est pas une raison pour qu'un enfant perde ses
       * missions — mais « ne pas bloquer » n'a jamais voulu dire « affirmer le
       * contraire ». On garde ce qu'on savait, et on se tait.
       *
       * `ECHEC` et non `null` : un abonnement réellement absent est une
       * réponse, et elle doit s'écrire. Les confondre était toute l'erreur.
       */
      const ECHEC = Symbol('lecture impossible');
      const [subscription, referrals] = await Promise.all([
        billing.getSubscription(familyId).catch(() => ECHEC),
        billing.listReferrals(familyId).catch(() => ECHEC),
      ]);
      set({
        ...(subscription === ECHEC ? {} : { subscription: subscription as Subscription | null }),
        ...(referrals === ECHEC ? {} : { referrals: referrals as Referral[] }),
      });
    },

    async choosePlan(plan) {
      const familyId = get().data?.family.id;
      if (!familyId) throw new Error('Aucune famille.');
      const result = await getBillingService().startCheckout({ familyId, plan });
      await get().loadBilling();
      return result;
    },

    /**
     * Retrouver un abonnement déjà payé, sur un nouveau téléphone.
     *
     * Sur le web il n'y a rien à restaurer — l'abonnement suit le compte. Sur
     * les boutiques il suit l'appareil tant qu'on ne le réclame pas, et Apple
     * refuse à la revue toute application qui vend sans offrir ce bouton.
     */
    async restorePurchases() {
      const familyId = get().data?.family.id;
      if (!familyId) return { kind: 'failed' as const, reason: 'Aucune famille.' };

      const billing = getBillingService();
      if (!billing.restore) {
        return { kind: 'failed' as const, reason: 'Rien à restaurer sur cette version.' };
      }

      const result = await billing.restore(familyId);
      await get().loadBilling();
      return result;
    },

    async recupererMoisOffert() {
      const familyId = get().data?.family.id;
      if (!familyId) return { kind: 'failed' as const, reason: 'Aucune famille.' };

      const billing = getBillingService();
      if (!billing.redeemReferralMonth) {
        // Sur le web et dans la démo, il n'y a rien à demander : le mois est
        // donné par le serveur, ou il n'y a pas de boutique du tout.
        return { kind: 'failed' as const, reason: 'Rien à récupérer ici.' };
      }

      const result = await billing.redeemReferralMonth(familyId);
      await get().loadBilling();
      return result;
    },

    async cancelSubscription() {
      const familyId = get().data?.family.id;
      const cancel = getBillingService().cancel;
      // Absent sur les boutiques : là-bas, la résiliation se fait dans les
      // réglages du téléphone, et l'écran y renvoie au lieu d'appeler ceci.
      if (!familyId || !cancel) return;
      set({ subscription: await cancel.call(getBillingService(), familyId) });
    },

    async resumeSubscription() {
      const familyId = get().data?.family.id;
      const resume = getBillingService().resume;
      if (!familyId || !resume) return;
      set({ subscription: await resume.call(getBillingService(), familyId) });
    },

    /**
     * Changer de formule, et jamais en acheter une seconde.
     *
     * `choosePlan` ouvre un paiement : il crée un abonnement. Celui-ci
     * remplace la formule sur l'abonnement qui court déjà. Confondre les deux
     * fait prélever la famille deux fois — c'est la raison d'être de cette
     * action, et la raison pour laquelle l'écran ne doit jamais retomber sur
     * `choosePlan` quand un abonnement existe.
     *
     * Absent sur les boutiques, comme `cancel` : Apple et Google gèrent le
     * changement dans les réglages du téléphone.
     */
    async changePlan(plan) {
      const familyId = get().data?.family.id;
      const service = getBillingService();
      if (!familyId || !service.changePlan) return;
      set({ subscription: await service.changePlan({ familyId, plan }) });
    },

    async redeemReferral(code) {
      const familyId = get().data?.family.id;
      if (!familyId) return { ok: false, reason: 'Aucune famille.' };
      const result = await getBillingService().redeemReferralCode({ familyId, code });
      if (result.subscription) set({ subscription: result.subscription });
      return { ok: result.ok, reason: result.reason };
    },
  };
});
