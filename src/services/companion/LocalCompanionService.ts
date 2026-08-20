import {
  ALERT_REPLY,
  CLOSED,
  DAILY_EXCHANGES,
  FAREWELL,
  normalise,
  phaseOf,
  triage,
} from '@/domain/companion';
import { ID } from '@/domain/types';

import { CompanionReply, CompanionService } from './CompanionService';

/**
 * Mino sans modèle.
 *
 * Ce n'est pas une maquette jetable : c'est ce qui tourne dans l'aperçu web,
 * dans la démo, et le jour où le service de modèle est indisponible. Un enfant
 * qui vient parler à Mino ne doit jamais tomber sur une erreur — au pire sur un
 * Mino moins bavard.
 *
 * Les réponses sont écrites à la main et choisies sur ce que l'enfant vient de
 * dire. C'est grossier, et c'est assumé : mieux vaut une phrase juste et un peu
 * bête qu'une phrase brillante qui n'arrive pas.
 */
export class LocalCompanionService implements CompanionService {
  readonly name = 'local';
  readonly capability = 'none' as const;

  private used = new Map<ID, { day: string; count: number }>();

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private countOf(childId: ID): number {
    const entry = this.used.get(childId);
    if (!entry || entry.day !== this.today()) return 0;
    return entry.count;
  }

  async remaining(childId: ID): Promise<number> {
    return Math.max(0, DAILY_EXCHANGES - this.countOf(childId));
  }

  async say({ childId, message, context }: Parameters<CompanionService['say']>[0]) {
    const safety = triage(message);

    // Une alerte ne consomme pas d'échange et ne passe par aucun modèle : la
    // réponse est écrite, et elle est la même pour tout le monde.
    if (safety === 'alert') {
      return { text: ALERT_REPLY, safety, left: await this.remaining(childId), closed: false };
    }

    const before = this.countOf(childId);
    if (before >= DAILY_EXCHANGES) {
      return { text: CLOSED, safety, left: 0, closed: true };
    }

    const count = before + 1;
    this.used.set(childId, { day: this.today(), count });
    const phase = phaseOf(count);

    const text =
      phase === 'closing' || phase === 'done'
        ? FAREWELL
        : this.reply({ message, safety, nudge: phase === 'nudging', context });

    return {
      text,
      safety,
      left: Math.max(0, DAILY_EXCHANGES - count),
      closed: count >= DAILY_EXCHANGES,
    };
  }

  /** Des réponses écrites, choisies sur ce qui vient d'être dit. */
  private reply(input: {
    message: string;
    safety: 'none' | 'tender';
    nudge: boolean;
    context: Parameters<CompanionService['say']>[0]['context'];
  }): string {
    const { message, safety, nudge, context } = input;
    // Même normalisation que le tri : un clavier de téléphone écrit « j'ai ».
    // Sans elle, « j'ai rangé ma chambre ! » tapé sur un vrai téléphone ne
    // déclenche pas la seule réponse qui donne son intérêt au personnage.
    const said = normalise(message).toLowerCase();
    const challenge = context.challenges[0];

    if (safety === 'tender') {
      return `Je t’écoute, ${context.firstName}. Ça arrive, les journées comme ça 💛 Tu veux en parler à quelqu’un de ta maison ? Souvent ça aide plus que ça n’en a l’air.`;
    }

    // « J'ai rangé ma chambre ! » — le moment où Mino doit connaître son monde.
    const finished = context.missionsWaiting[0] ?? context.missionsTodo[0];
    if (/j'?ai (fait|fini|rang|termin)/i.test(said) && finished) {
      return `Trop bien 😮 « ${finished} », c’était justement une de tes missions aujourd’hui ! Tes parents vont pouvoir valider.`;
    }

    if (nudge && challenge) {
      return `Dis, on se lance un défi sans écran ? ${challenge}`;
    }

    if (/ennuie|rien à faire|rien a faire/i.test(said) && challenge) {
      return `Alors j’ai ce qu’il te faut ! ${challenge}`;
    }

    if (/\?$/.test(message.trim())) {
      return `Bonne question ! Je n’ai pas toutes les réponses, moi 😄 Raconte-moi plutôt ta journée.`;
    }

    return `Ah ouais ? Raconte-moi 👀`;
  }
}
