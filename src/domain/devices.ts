import { ID, ISODate } from './types';

/**
 * The family's screens, declared by the parent.
 *
 * There is exactly one screen Mino can drive by itself: the device it is
 * running on. Every other screen in the house — a Switch, the living-room
 * television, the family desktop, a tablet without Mino — exposes nothing a
 * third-party app may control. None of them can be started or stopped from
 * here, and pretending otherwise would mean a counter that quietly lies.
 *
 * So a declared device is always a **supervised** screen: the child asks, a
 * parent starts the clock, both sides watch the same countdown. Saying that
 * plainly at the moment the parent declares the device is the whole point of
 * making them declare it.
 */

export type DeviceKind = 'console' | 'tv' | 'computer' | 'tablet' | 'other';

export interface Device {
  id: ID;
  familyId: ID;
  /** What the family calls it: "Switch du salon", "Télé de la cuisine". */
  label: string;
  kind: DeviceKind;
  createdAt: ISODate;
  archived?: boolean;
}

export interface DeviceKindInfo {
  kind: DeviceKind;
  label: string;
  icon: string;
}

export const DEVICE_KINDS: DeviceKindInfo[] = [
  { kind: 'console', label: 'Console', icon: '🎮' },
  { kind: 'tv', label: 'Télévision', icon: '📺' },
  { kind: 'computer', label: 'Ordinateur', icon: '💻' },
  { kind: 'tablet', label: 'Tablette', icon: '📱' },
  { kind: 'other', label: 'Autre écran', icon: '🕹️' },
];

export function kindInfo(kind: DeviceKind): DeviceKindInfo {
  return DEVICE_KINDS.find((k) => k.kind === kind) ?? DEVICE_KINDS[DEVICE_KINDS.length - 1];
}

export function deviceIcon(kind: DeviceKind): string {
  return kindInfo(kind).icon;
}

/** One tap to declare the screens most families actually own. */
export const DEVICE_SUGGESTIONS: { label: string; kind: DeviceKind }[] = [
  { label: 'Nintendo Switch', kind: 'console' },
  { label: 'PlayStation', kind: 'console' },
  { label: 'Xbox', kind: 'console' },
  { label: 'Télé du salon', kind: 'tv' },
  { label: 'Ordinateur familial', kind: 'computer' },
  { label: 'Tablette du salon', kind: 'tablet' },
];

export function activeDevices(devices: Device[] | undefined): Device[] {
  return (devices ?? []).filter((d) => !d.archived);
}

export function deviceById(devices: Device[] | undefined, id: ID | undefined): Device | undefined {
  if (!id) return undefined;
  return (devices ?? []).find((d) => d.id === id);
}

/**
 * How a screen is named in a sentence, for a session that may outlive the
 * device it was for. Falls back to the kind when the device has been removed.
 */
export function describeDevice(devices: Device[] | undefined, id: ID | undefined): string {
  const device = deviceById(devices, id);
  if (device) return device.label;
  return id ? 'un autre écran' : 'cet appareil';
}
