import { CompanionContext, SafetyLevel } from '@/domain/companion';
import { ID } from '@/domain/types';

/**
 * Qui fait parler Mino.
 *
 * La couture existe pour la même raison que les cinq autres : l'application
 * doit tourner entièrement sans elle. Sans clé d'API, sans réseau, dans
 * l'aperçu web ou dans la démo, Mino répond quand même — moins finement, mais
 * il répond, et rien de l'expérience ne s'effondre.
 *
 * Deux règles franchissent cette frontière sans négociation :
 *
 * — **la clé d'API n'est jamais dans l'application.** Elle vit dans une
 *   fonction serveur. Une clé embarquée dans un binaire mobile est une clé
 *   publique, et celle-ci se facture à l'usage.
 *
 * — **le budget quotidien n'est pas compté ici.** Il est tenu par la base, où
 *   l'appareil de l'enfant ne peut pas le remettre à zéro. Le compte affiché
 *   dans l'écran est un affichage, pas une autorisation.
 */

export interface CompanionTurn {
  role: 'child' | 'mino';
  text: string;
}

export interface CompanionReply {
  text: string;
  /** Ce que le tri a vu dans le message de l'enfant, pour que l'écran s'adapte. */
  safety: SafetyLevel;
  /** Échanges restants après celui-ci, tels que le serveur les compte. */
  left: number;
  /** Vrai quand le budget du jour vient d'être épuisé. */
  closed: boolean;
}

export interface CompanionService {
  readonly name: string;
  /**
   * `none` : Mino répond depuis une liste écrite à la main, sans modèle.
   * L'écran le dit franchement plutôt que de laisser croire à une IA.
   */
  readonly capability: 'none' | 'model';

  /** Combien d'échanges il reste aujourd'hui, d'après le serveur. */
  remaining(childId: ID): Promise<number>;

  say(input: {
    childId: ID;
    message: string;
    context: CompanionContext;
    history: CompanionTurn[];
  }): Promise<CompanionReply>;
}
