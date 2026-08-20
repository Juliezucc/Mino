import { BugReport } from '@/domain/diagnostics';

/**
 * Où partent les signalements.
 *
 * Le contrat est volontairement minuscule, parce que la seule chose qui compte
 * est qu'il n'y ait qu'un chemin. Un bug remonté par e-mail, un autre par la
 * boutique et un troisième par message : ce sont trois endroits à consulter et
 * trois occasions d'en perdre un.
 */

export interface DiagnosticsResult {
  ok: boolean;
  /** Référence à donner au parent : « votre signalement MINO-4F2A-1435 ». */
  reference?: string;
  reason?: string;
}

export interface DiagnosticsService {
  readonly name: string;
  /** Faux quand rien n'est envoyé nulle part : l'écran le dit alors franchement. */
  readonly remote: boolean;

  send(report: BugReport): Promise<DiagnosticsResult>;

  /**
   * Les signalements gardés sur l'appareil faute d'avoir pu partir.
   *
   * Un plantage arrive souvent quand la connexion est mauvaise — c'est parfois
   * la cause. Perdre le rapport à ce moment-là, c'est perdre exactement ceux
   * qu'on voulait recevoir.
   */
  flush(): Promise<number>;
}
