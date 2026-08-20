import {
  ALERT_REPLY,
  CLOSED,
  DAILY_EXCHANGES,
  FAREWELL,
  matchMission,
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
    // Même normalisation que le tri — un clavier de téléphone écrit « j'ai » —
    // plus les accents retirés. Un enfant de sept ans écrit « ca va » aussi
    // souvent que « ça va », et une reconnaissance qui dépend d'une cédille
    // n'en reconnaît que la moitié.
    const said = normalise(message)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const challenge = context.challenges[0];

    if (safety === 'tender') {
      return `Je t’écoute, ${context.firstName}. Ça arrive, les journées comme ça 💛 Tu veux en parler à quelqu’un de ta maison ? Souvent ça aide plus que ça n’en a l’air.`;
    }

    // « J'ai rangé ma chambre ! » — le moment où Mino doit connaître son monde.
    //
    // Et où il doit surtout ne pas se tromper de mission : nommer la première
    // de la liste plutôt que celle dont l'enfant parle donne un personnage qui
    // n'écoute pas, ce qui est pire que de ne rien nommer du tout.
    if (/j'?ai (fait|fini|rang|termin|reussi)/i.test(said)) {
      const mission = matchMission(said, [...context.missionsWaiting, ...context.missionsTodo]);
      if (mission) {
        return `Trop bien 😮 « ${mission} », c’était justement une de tes missions aujourd’hui ! Tes parents vont pouvoir valider.`;
      }
      // Rien qui corresponde : on félicite sans inventer.
      return `Bravo ! 👏 Ce n’était pas dans tes missions du jour, mais ça compte quand même 💙`;
    }

    if (nudge && challenge) {
      return `Dis, on se lance un défi sans écran ? ${challenge}`;
    }

    if (/ennuie|rien a faire|quoi faire|je fais quoi/i.test(said) && challenge) {
      return `Alors j’ai ce qu’il te faut ! ${challenge}`;
    }

    // Dire bonjour à quelqu'un qui dit bonjour. C'est la première chose qu'un
    // enfant tape, et y répondre « Ah ouais ? Raconte-moi » donne aussitôt
    // l'impression d'un personnage qui n'écoute pas.
    if (/^(coucou|salut|bonjour|hello|hey|yo)\b/i.test(said)) {
      return `Coucou ${context.firstName} ! 👋 Alors, cette journée ?`;
    }

    if (/\bca va\b|tu vas bien|comment (tu vas|ca va)/i.test(said)) {
      return `Moi ça va très bien, merci d’avoir demandé 😄 Et toi, c’était comment aujourd’hui ?`;
    }

    if (/\b(t'es|tu es|es-tu|c'est quoi)\b.*(robot|vrai|humain|reel|mino|qui)|qui (es-tu|t'es|tu es)/i.test(said)) {
      // Jamais d'ambiguïté là-dessus, même hors ligne.
      return `Je suis Mino, ton personnage ! Pas une vraie personne — mais je suis là quand même 💙`;
    }

    if (/mission|minos?\b|gagner|combien/i.test(said)) {
      const todo = context.missionsTodo[0];
      return todo
        ? `Il te reste « ${todo} » aujourd’hui. C’est tes parents qui valident, moi je ne fais qu’applaudir 👏`
        : `Tes missions, c’est dans l’onglet Missions ! Moi je ne donne pas de ${context.unit}, ça c’est tes parents 😄`;
    }

    // Faute de mieux : relancer, mais pas toujours avec la même phrase. Une
    // doublure qui répète mot pour mot se démasque au troisième message.
    const relances = [
      `Ah bon ? Raconte-moi 👀`,
      `Et alors, il s’est passé quoi ?`,
      `Ça m’intéresse, ça. Tu me racontes la suite ?`,
      challenge ? `Tiens, et si on faisait ça : ${challenge}` : `Dis-m’en plus !`,
    ];
    return relances[said.length % relances.length];
  }
}
