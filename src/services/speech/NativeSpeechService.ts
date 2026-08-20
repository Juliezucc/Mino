import { SpeechService, SpeechStatus } from './SpeechService';
import { NativeSpeech } from './native';

const LOCALE = 'fr-FR';

/**
 * La dictée sur le téléphone de l'enfant.
 *
 * Elle ne s'active que si l'appareil sait transcrire **sans réseau**. C'est
 * vérifié une fois au démarrage, et le résultat commande l'affichage du bouton :
 * quand la réponse est non, il n'y a pas de bouton, pas de repli, pas de « juste
 * pour cette fois ». La voix d'un enfant ne part pas sur un serveur.
 */
export class NativeSpeechService implements SpeechService {
  readonly name = 'native';
  readonly available: boolean;
  readonly onDevice: boolean;

  private constructor(
    private readonly native: NativeSpeech,
    onDevice: boolean,
  ) {
    this.onDevice = onDevice;
    // Disponible et sur l'appareil sont ici la même chose, et c'est voulu :
    // faire de la seconde une option ouvrirait la porte au repli en ligne.
    this.available = onDevice;
  }

  /**
   * Asynchrone parce que la réponse l'est : savoir si le français est
   * transcriptible hors ligne demande d'interroger le système, et sur Android
   * cela dépend d'un pack de langue que l'utilisateur a pu ne jamais installer.
   */
  static async create(native: NativeSpeech): Promise<NativeSpeechService> {
    const onDevice = await native.isOnDeviceAvailable(LOCALE).catch(() => false);
    return new NativeSpeechService(native, onDevice);
  }

  requestPermission(): Promise<boolean> {
    return this.native.requestPermission().catch(() => false);
  }

  start(handlers: {
    onText: (text: string, final: boolean) => void;
    onStatus: (status: SpeechStatus) => void;
  }): Promise<void> {
    return this.native.start({ locale: LOCALE, ...handlers });
  }

  stop(): Promise<void> {
    return this.native.stop().catch(() => undefined);
  }
}
