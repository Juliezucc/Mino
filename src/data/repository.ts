import { FamilyData, ID } from '@/domain/types';

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
  | 'mission.archived'
  | 'completion.created'
  | 'completion.approved'
  | 'completion.rejected'
  | 'completion.celebrated'
  | 'session.started'
  | 'session.ended'
  | 'balance.adjusted';

export interface ChangeEvent {
  kind: ChangeKind;
  /** Rows created or modified by the action. */
  upsert?: Partial<FamilyData>;
  /** Child removed by the action (cascades on the backend). */
  deleteChildId?: ID;
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
}
