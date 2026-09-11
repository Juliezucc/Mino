import { FamilyData, ID, ISODate } from '@/domain/types';
import { ScreenTimeAuthorization } from '@/services/screenTime';

/**
 * What just changed. Local storage ignores it and rewrites the document;
 * a remote backend uses it to write only the touched rows.
 */
export type ChangeKind =
  | 'bootstrap'
  | 'family.updated'
  | 'child.created'
  | 'child.updated'
  | 'child.removed'
  | 'mission.created'
  | 'mission.updated'
  | 'mission.archived'
  | 'completion.created'
  | 'completion.approved'
  | 'completion.rejected'
  | 'completion.celebrated'
  | 'freeWindow.created'
  | 'freeWindow.updated'
  | 'freeWindow.removed'
  | 'session.started'
  | 'session.ended'
  | 'balance.adjusted';

export interface ChangeEvent {
  kind: ChangeKind;
  /** Rows created or modified by the action. */
  upsert?: Partial<FamilyData>;
  /** Child removed by the action (cascades on the backend). */
  deleteChildId?: ID;
  /**
   * Plage libre supprimée. Une suppression franche et non un `enabled: false` :
   * suspendre et supprimer sont deux gestes différents, et le parent qui range
   * sa liste doit pouvoir faire le second.
   */
  deleteFreeWindowId?: ID;
  /**
   * Le code à quatre chiffres, quand un parent agit depuis la tablette de son
   * enfant — et uniquement dans ce cas.
   *
   * **Ce n'est pas un secret qui traîne, c'est une preuve de présence.** Sur
   * une session d'appareil, la base refuse toute écriture de parent : les
   * politiques demandent `auth_is_parent()`, qui ne lit que la table
   * `parents`. Le parent debout à côté de son enfant ne pouvait donc rien
   * confirmer, et lisait « Impossible de joindre Mino » pour un mur permanent.
   *
   * Le code accompagne donc le geste, est vérifié par le serveur à chaque
   * appel, et n'est jamais écrit nulle part : il vit en mémoire tant que
   * l'espace parent est ouvert, et disparaît au verrouillage comme au
   * redémarrage. Sur le téléphone d'un parent, il est absent — ce chemin ne
   * change pas.
   */
  codeParent?: string;
}

/**
 * The only contract the app knows about. Swapping AsyncStorage for Supabase is
 * a one-line change in `createRepository()` — no screen or store is aware.
 */
export interface MinoRepository {
  readonly name: string;
  load(): Promise<FamilyData | null>;
  persist(data: FamilyData, change: ChangeEvent): Promise<void>;
  clear(): Promise<void>;
  /**
   * Realtime push from the backend, when the implementation supports it.
   *
   * The family id is passed in rather than discovered: a subscription that has
   * to load the document before it can listen pays for the document twice, once
   * at every launch of every device.
   */
  subscribe?(familyId: ID, onRemoteChange: (data: FamilyData) => void): () => void;

  /**
   * Attaches this device to a family, from the child's side.
   *
   * The family code is all a child is asked for: at eight years old, every
   * extra field is a wall. Proving that an adult is present happens later and
   * elsewhere — the system's own screen-time authorisation asks for the
   * parent's account, and it does it far better than a form could.
   *
   * The code therefore carries the whole weight of the pairing, which is why it
   * is six characters and why the backend rate-limits attempts.
   */
  joinFamily(input: { code: string }): Promise<FamilyData | null>;

  /**
   * Ce que cet appareil-ci dit de son bouclier, pour que le parent le sache.
   *
   * Sans cela, le produit avait un mode de panne silencieux et c'était le pire
   * de tous : un adolescent retire à Mino l'accès aux statistiques d'usage —
   * deux touches dans les réglages Android — le bouclier cesse d'exister, et
   * le parent n'apprend rien. Son écran de blocage lit l'autorisation de SON
   * téléphone, où tout va bien. Un bouclier mort dont le parent ignore la mort
   * produit la confiance sans la protection.
   *
   * Facultatif : le dépôt local n'a personne à qui rendre compte.
   */
  reportShield?(input: {
    /**
     * L'état du système, ou l'une des deux réponses qu'il ne sait pas donner.
     *
     * `compteur-seul` : la décision explicite d'un parent qui ne veut pas de
     * verrou sur cet appareil-là.
     *
     * `telephone-parent` : aucun enfant ne joue ici, il n'y a donc rien à
     * verrouiller. Sans cet état, le téléphone du second parent remontait
     * « blocage pas encore réglé » à perpétuité, avec une consigne qui
     * reviendrait à mettre le téléphone d'un adulte derrière le bouclier — et
     * un avertissement qui ne peut pas s'éteindre apprend à ignorer les
     * autres.
     *
     * Ni l'un ni l'autre n'est un état qu'iOS ou Android sait rendre : ce sont
     * des réponses, et elles priment sur l'absence d'autorisation qu'elles
     * expliquent. Voir `DeviceProfile`.
     */
    status: ScreenTimeAuthorization | 'compteur-seul' | 'telephone-parent';
    label?: string;
    childId?: ID | null;
  }): Promise<void>;

  /**
   * L'état des appareils appairés, vu du côté du parent.
   *
   * `seenAt` compte autant que `status` : un appareil qui cesse complètement de
   * donner de ses nouvelles — Mino désinstallé, téléphone éteint depuis trois
   * jours — ne dira jamais « denied ». C'est le silence qu'il faut savoir lire.
   */
  pairedDevices?(): Promise<PairedDevice[]>;
}

export interface PairedDevice {
  id: ID;
  label: string | null;
  childId: ID | null;
  status: ScreenTimeAuthorization | null;
  seenAt: ISODate | null;
  joinedAt: ISODate;
}
