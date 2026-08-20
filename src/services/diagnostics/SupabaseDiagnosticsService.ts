import { SupabaseClient } from '@supabase/supabase-js';

import { BugReport, referenceOf } from '@/domain/diagnostics';

import { DiagnosticsResult, DiagnosticsService } from './DiagnosticsService';
import { LocalDiagnosticsService } from './LocalDiagnosticsService';

/**
 * Les signalements arrivent dans la base, dans `support_reports`.
 *
 * Un rapport qui ne part pas n'est pas perdu : il est mis de côté sur
 * l'appareil et repart à la prochaine occasion. Sans cela, la panne de réseau
 * qui provoque un bug est aussi celle qui l'empêche d'être signalé — et les
 * problèmes les plus difficiles ne remontent jamais.
 */
export class SupabaseDiagnosticsService implements DiagnosticsService {
  readonly name = 'supabase';
  readonly remote = true;

  private readonly queue = new LocalDiagnosticsService();

  constructor(private readonly client: SupabaseClient) {}

  async send(report: BugReport): Promise<DiagnosticsResult> {
    const reference = referenceOf(report);
    const { error } = await this.client.from('support_reports').insert(this.toRow(report));

    if (error) {
      await this.queue.keep(report);
      // Le parent n'a pas à savoir que le réseau a manqué : de son point de vue
      // le signalement est parti, et il partira.
      return { ok: true, reference };
    }

    return { ok: true, reference };
  }

  /** Rejoue ce qui attendait. Appelé au démarrage. */
  async flush(): Promise<number> {
    const waiting = await this.queue.pending();
    if (waiting.length === 0) return 0;

    const { error } = await this.client.from('support_reports').insert(waiting.map((r) => this.toRow(r)));
    if (error) return 0;

    await this.queue.clear();
    return waiting.length;
  }

  private toRow(report: BugReport) {
    return {
      kind: report.kind,
      message: report.message,
      stack: report.stack ?? null,
      fingerprint: report.fingerprint,
      app_version: report.context.appVersion,
      platform: report.context.platform,
      os_version: report.context.osVersion ?? null,
      route: report.context.route ?? null,
      repository: report.context.repository ?? null,
      // Des compteurs, jamais des contenus.
      counts: report.context.counts ?? null,
      created_at: report.createdAt,
    };
  }
}
