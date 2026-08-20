/**
 * Mino domain model.
 *
 * Golden rule: the minutes balance is NEVER stored as a mutable counter.
 * It is always derived from the ScreenTimeTransaction ledger, so history and
 * balance can never disagree.
 */

export type ID = string;
/** ISO-8601 string. Stored as text so the model stays JSON/Postgres friendly. */
export type ISODate = string;

export interface Family {
  id: ID;
  name: string;
  /** Short human code used by a child device to join the family. */
  code: string;
  /**
   * Referral code, shared with other families. Deliberately not `code`: one is
   * handed to strangers, the other lets a device into the family.
   */
  referralCode: string;
  createdAt: ISODate;
}

export interface Parent {
  id: ID;
  familyId: ID;
  displayName: string;
  email: string;
  /** 4-digit PIN guarding the parent area. Never a child-readable field. */
  pin: string;
  createdAt: ISODate;
}

export type AvatarKey = 'fox' | 'cat' | 'panda' | 'rabbit' | 'bear' | 'owl';

export interface Child {
  id: ID;
  familyId: ID;
  firstName: string;
  age: number;
  avatarKey: AvatarKey;
  /** Optional 4-digit PIN. Children never have an email account. */
  pin?: string;
  createdAt: ISODate;
}

export type RepeatKind = 'never' | 'daily' | 'weekdays';
/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RepeatRule {
  kind: RepeatKind;
  days?: Weekday[];
}

export interface Mission {
  id: ID;
  familyId: ID;
  title: string;
  /** Emoji shown on the card — icon + text, never text alone. */
  icon: string;
  minutes: number;
  repeat: RepeatRule;
  createdBy: ID;
  archived: boolean;
  createdAt: ISODate;
}

export interface MissionAssignment {
  id: ID;
  missionId: ID;
  childId: ID;
  active: boolean;
  createdAt: ISODate;
}

export type CompletionStatus = 'pending' | 'approved' | 'rejected';

export interface MissionCompletion {
  id: ID;
  familyId: ID;
  assignmentId: ID;
  missionId: ID;
  childId: ID;
  status: CompletionStatus;
  /** Snapshot of the reward at completion time, so later edits don't rewrite history. */
  minutesRequested: number;
  minutesAwarded: number;
  completedAt: ISODate;
  reviewedAt?: ISODate;
  reviewedBy?: ID;
  /** Set when the child has seen the celebration for an approved completion. */
  celebratedAt?: ISODate;
}

export type TransactionKind =
  | 'mission_reward'
  | 'screen_time_used'
  | 'parent_adjustment'
  | 'initial_balance';

export interface ScreenTimeTransaction {
  id: ID;
  familyId: ID;
  childId: ID;
  /** Signed minutes: positive = earned, negative = consumed. */
  delta: number;
  kind: TransactionKind;
  reason: string;
  /** Completion id for mission rewards, session id for consumption. */
  refId?: ID;
  createdAt: ISODate;
}

/** Derived, never persisted as source of truth. */
export interface ScreenTimeBalance {
  childId: ID;
  minutes: number;
  earnedToday: number;
  usedToday: number;
  updatedAt: ISODate;
}

export type SessionStatus = 'running' | 'finished' | 'stopped';

/** A "use my time" session. Consumption is billed to the ledger when it ends. */
export interface ScreenTimeSession {
  id: ID;
  familyId: ID;
  childId: ID;
  requestedMinutes: number;
  startedAt: ISODate;
  endsAt: ISODate;
  status: SessionStatus;
  endedAt?: ISODate;
  consumedMinutes?: number;
}

/** The whole family dataset. One document = one family, which maps 1:1 to RLS scoping. */
export interface FamilyData {
  family: Family;
  parents: Parent[];
  children: Child[];
  missions: Mission[];
  assignments: MissionAssignment[];
  completions: MissionCompletion[];
  transactions: ScreenTimeTransaction[];
  sessions: ScreenTimeSession[];
}
