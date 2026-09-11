import { ALERT_REPLY, triage } from '@/domain/companion';
import { ID } from '@/domain/types';

import { CompanionReply, CompanionService } from './CompanionService';
import { LocalCompanionService } from './LocalCompanionService';

/**
 * Mino avec un modèle, derrière une fonction serveur.
 *
 * L'appareil de l'enfant ne parle jamais au modèle : il parle à notre serveur,
 * qui tient la clé, compte les échanges et applique les règles. C'est la même
 * discipline que pour la facturation — ce qui peut être décidé côté client sera
 * décidé côté client par quelqu'un, un jour.
 *
 * Le tri de sécurité est fait **deux fois**, ici et sur le serveur. Ce n'est
 * pas de la redondance inutile : celui d'ici évite qu'une phrase grave parte
 * sur le réseau, celui du serveur reste la garantie, puisque le client peut
 * être modifié.
 */
export class EdgeCompanionService implements CompanionService {
  readonly name = 'edge';
  readonly capability = 'model' as const;

  /** Ce qui répond quand le serveur ne répond pas. */
  private readonly fallback = new LocalCompanionService();

  constructor(
    private readonly invoke: <T>(fn: string, body: unknown) => Promise<T | null>,
    /**
     * Le compteur se lit directement en base, pas par une fonction serveur :
     * c'est une lecture que RLS sait déjà protéger, et une fonction de plus
     * serait une fonction de plus à déployer pour rien.
     */
    private readonly readLeft: (childId: ID) => Promise<number | null>,
  ) {}

  async remaining(childId: ID): Promise<number> {
    const left = await this.readLeft(childId).catch(() => null);
    return left ?? (await this.fallback.remaining(childId));
  }

  async say(input: Parameters<CompanionService['say']>[0]): Promise<CompanionReply> {
    const safety = triage(input.message);

    /**
     * Ce qui touche à la sécurité de l'enfant ne quitte pas l'appareil et ne
     * passe par aucun modèle : la réponse est écrite, et elle est la même pour
     * tout le monde.
     *
     * **Mais le FAIT remonte, lui.** Rien n'était écrit nulle part : « Lire
     * leurs conversations » n'en portait aucune trace, et le parent d'un enfant
     * harcelé ne savait jamais rien. On prévient donc le serveur qu'une alerte
     * a eu lieu — sans un mot de ce que l'enfant a écrit. Ce que Mino a
     * répondu est une constante du dépôt, identique pour tous ; ce que l'enfant
     * a dit reste sur son téléphone.
     *
     * Jamais attendu, et sans conséquence s'il échoue : un enfant en danger
     * reçoit sa réponse et le 119 quoi qu'il arrive, réseau ou pas.
     */
    if (safety === 'alert') {
      void this.invoke('companion', { childId: input.childId, alerte: true }).catch(
        () => undefined,
      );
      return { text: ALERT_REPLY, safety, left: await this.remaining(input.childId), closed: false };
    }

    const data = await this.invoke<CompanionReply>('companion', {
      childId: input.childId,
      message: input.message,
      context: input.context,
      // Une fenêtre courte : au-delà, Mino ne devient pas meilleur, il devient
      // seulement plus cher — l'historique est refacturé à chaque phrase.
      history: input.history.slice(-6),
    }).catch(() => null);

    // Un modèle indisponible ne doit jamais laisser un enfant devant une
    // erreur. Mino devient moins bavard, c'est tout.
    if (!data) return this.fallback.say(input);

    return { ...data, safety };
  }
}
