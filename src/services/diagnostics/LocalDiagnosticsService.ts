import AsyncStorage from '@react-native-async-storage/async-storage';

import { BugReport, referenceOf } from '@/domain/diagnostics';

import { DiagnosticsResult, DiagnosticsService } from './DiagnosticsService';

const KEY = 'mino.reports';
/** Au-delà, l'appareil garde des rapports que personne ne lira jamais. */
const MAX_KEPT = 30;

/**
 * La file d'attente, et le mode sans serveur.
 *
 * Elle sert deux fois : seule, quand l'application tourne sans backend ; et
 * derrière le service distant, pour retenir ce qui n'a pas pu partir. Le second
 * usage est le plus important — un plantage se produit souvent quand le réseau
 * est mauvais, et un rapport perdu à ce moment-là est précisément celui qu'on
 * voulait recevoir.
 */
export class LocalDiagnosticsService implements DiagnosticsService {
  readonly name = 'local';
  readonly remote = false;

  async send(report: BugReport): Promise<DiagnosticsResult> {
    await this.keep(report);
    return { ok: true, reference: referenceOf(report) };
  }

  async flush(): Promise<number> {
    return (await this.pending()).length;
  }

  /** Ajoute un rapport à la file, en écartant les plus anciens. */
  async keep(report: BugReport): Promise<void> {
    const kept = await this.pending();
    const next = [report, ...kept].slice(0, MAX_KEPT);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }

  async pending(): Promise<BugReport[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Une file d'attente illisible ne doit pas empêcher l'application de
      // démarrer : c'est le genre de panne qui se propage.
      return [];
    }
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
  }
}
