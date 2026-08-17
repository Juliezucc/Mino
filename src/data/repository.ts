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
}
