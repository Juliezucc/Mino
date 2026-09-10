import { NO_DEVICE_PROFILE, readDeviceProfile } from '@/data/deviceProfile';
import { getSupabaseClient } from '@/data/supabaseRepository';
import { NotificationPayload, usageDeLAppareil } from '@/domain/notifications';

import { getNotificationService } from './index';

/**
 * Ce qui permet à l'autre bout de la boucle d'entendre.
 *
 * `domain/notifications.ts` savait déjà quoi dire, à qui, et quand se taire.
 * Mais tout partait **localement**, sur l'appareil qui venait d'agir —
 * c'est-à-dire à la seule personne déjà au courant. Le parent apprenait qu'une
 * mission attendait en rouvrant Mino ; l'enfant apprenait ses minos le
 * lendemain matin.
 *
 * Deux fonctions, et rien d'autre : poser son jeton, et demander au serveur
 * d'écrire aux autres.
 */

/** Le jeton n'est demandé qu'une fois par lancement : il ne change pas en route. */
let pose: string | null = null;

/**
 * Le genre d'appareil déjà déclaré, lui, change en cours de route.
 *
 * Un parent qui réserve la tablette à son fils, ou qui répond « c'est mon
 * téléphone à moi », modifie à qui le serveur doit écrire. Sans cette
 * mémoire-ci, le garde-fou sur le jeton — qui n'a pas bougé, lui — faisait
 * ressortir la fonction avant l'écriture, et la nouvelle réponse restait dans
 * le téléphone pour toujours.
 */
let genrePose: string | null = null;

/**
 * Déclarer cet appareil comme joignable.
 *
 * Appelée au démarrage et après chaque ouverture de session — un jeton
 * d'appareil change après une réinstallation, une restauration de sauvegarde,
 * parfois une mise à jour du système. On le réécrit donc plutôt que de le
 * supposer stable.
 *
 * Silencieuse de bout en bout, et c'est voulu : sur le web, dans Expo Go, ou
 * quand le parent a refusé les notifications, il n'y a rien à faire et rien à
 * dire. Un échec ici ne doit jamais empêcher Mino de s'ouvrir.
 */
export async function poserJetonPush(familyId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const service = getNotificationService();
  if (!service.available) return;

  // On ne demande RIEN à l'utilisateur ici. La permission se demande dans un
  // écran, à un moment choisi, avec une explication — pas au démarrage par
  // surprise. Sans permission accordée, il n'y a simplement pas de jeton.
  if ((await service.permission().catch(() => 'denied')) !== 'granted') return;

  const jeton = await service.pushToken().catch(() => null);
  if (!jeton) return;

  /**
   * Ce que le parent a répondu à « à qui est cet appareil ? ».
   *
   * Il vivait dans le téléphone et n'en sortait jamais, si bien que le serveur
   * envoyait « Raphaël a terminé sa mission » sur la tablette que Raphaël
   * tient. Voir `recoitLesNotificationsParent`.
   */
  const genre = usageDeLAppareil(await readDeviceProfile().catch(() => NO_DEVICE_PROFILE));

  // Le jeton n'a pas bougé ET la réponse non plus : il n'y a rien à réécrire.
  if (jeton === pose && genre === genrePose) return;

  const { data } = await client.auth.getUser();
  if (!data.user) return;

  const { error } = await client.from('push_tokens').upsert({
    user_id: data.user.id,
    family_id: familyId,
    token: jeton,
    usage: genre,
    updated_at: new Date().toISOString(),
  });

  if (!error) {
    pose = jeton;
    genrePose = genre;
  }
}

/**
 * Oublier cet appareil.
 *
 * Se déconnecter, c'est cesser de recevoir. Sans cela, un téléphone revendu ou
 * prêté continuerait d'être prévenu des missions d'une famille qui n'est plus
 * la sienne — et ces notifications-là portent le prénom d'un enfant.
 */
export async function retirerJetonPush(): Promise<void> {
  pose = null;
  genrePose = null;
  const client = getSupabaseClient();
  if (!client) return;
  const { data } = await client.auth.getUser();
  if (!data.user) return;
  await client.from('push_tokens').delete().eq('user_id', data.user.id);
}

/**
 * Faire porter l'annonce aux autres appareils de la famille.
 *
 * Le serveur décide **seul** à qui elle va : il lit la famille dans le jeton
 * d'authentification, jamais dans ce qu'on lui envoie. Ce qui part d'ici n'est
 * qu'un texte et un public souhaité.
 *
 * **Une limite connue, écrite ici pour qu'elle ne se découvre pas en
 * production.** Les préférences de notification sont locales à chaque
 * appareil : celui qui envoie ne peut pas savoir si l'autre a demandé le
 * silence. Une notification poussée s'affiche donc même si son destinataire
 * avait coupé les siennes dans Mino — il lui reste les réglages du système, qui
 * eux font autorité. Les rendre communes demanderait de les ranger côté
 * serveur, et ce n'est pas fait.
 */
export async function pousserAuxAutres(payload: NotificationPayload): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client.functions.invoke('notify', {
    body: {
      audience: payload.audience,
      childId: payload.childId ?? null,
      title: payload.title,
      body: payload.body,
      route: payload.route ?? null,
    },
  });
}
