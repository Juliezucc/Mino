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
    const { data, error } = await this.client
      .from('support_reports')
      .insert(this.toRow(report))
      .select('id')
      .maybeSingle();

    if (error) {
      await this.queue.keep(report);
      // Le parent n'a pas à savoir que le réseau a manqué : de son point de vue
      // le signalement est parti, et il partira.
      return { ok: true, reference };
    }

    await this.prevenir(data?.id);
    return { ok: true, reference };
  }

  /**
   * Nous faire suivre le signalement par e-mail.
   *
   * **Sans cela, un signalement n'atteint personne.** La ligne partait dans
   * `support_reports`, sous une vue nommée « ce qu'il faut regarder le
   * matin » — et rien ne prévenait quiconque. Un parent bloqué à 21 h écrivait,
   * lisait « chaque signalement est lu », et attendait que quelqu'un pense à
   * ouvrir un tableau de bord. Les jours où personne n'y pense, la promesse est
   * fausse.
   *
   * On n'envoie que l'IDENTIFIANT : le serveur relit la ligne et compose
   * l'e-mail lui-même. Faire voyager le texte ici ferait de cette route un
   * relais d'envoi ouvert à toute session authentifiée.
   *
   * Jamais attendu, jamais fatal : la ligne est écrite, elle ne se perd pas.
   * Un acheminement qui manque est notre problème, pas celui du parent qui
   * vient de nous écrire.
   */
  private async prevenir(id: unknown): Promise<void> {
    if (typeof id !== 'number') return;
    await this.client.functions
      .invoke('courrier/signalement', { body: { id } })
      .catch(() => undefined);
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
      // Le seul champ que le parent donne POUR qu'on s'en serve.
      reply_to: report.replyTo?.trim() || null,
      created_at: report.createdAt,
    };
  }
}
