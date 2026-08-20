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
  /** Realtime push from the backend, when the implementation supports it. */
  subscribe?(onRemoteChange: (data: FamilyData) => void): () => void;

  /**
   * Attaches this device to a family, from the child's side.
   *
   * Two secrets, not one: the family code AND the parent's e-mail. The code is
   * four characters and gets read aloud across a kitchen; on its own it is
   * guessable, and guessing it would drop a stranger inside a family with
   * children in it. Requiring the e-mail as well makes that attack pointless.
   *
   * Returns null when the pair does not match — deliberately without saying
   * which half was wrong.
   */
  joinFamily(input: { code: string; parentEmail: string }): Promise<FamilyData | null>;
}
