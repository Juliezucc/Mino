import { SpeechStatus } from './SpeechService';

/**
 * Le contrat avec la reconnaissance vocale du système.
 *
 * Même procédé que pour le blocage d'écran et l'achat natif : une interface
 * ici, une implémentation native derrière, et rien du reste de l'application
 * qui sache laquelle.
 *
 * L'implémentation attendue est `expo-speech-recognition`, avec deux réglages
 * qui ne sont pas négociables :
 *
 *   • iOS  — `requiresOnDeviceRecognition: true`. Sans lui, SFSpeechRecognizer
 *     envoie l'audio aux serveurs d'Apple. C'est parfaitement légal, et ce
 *     n'est pas ce que nous voulons faire de la voix d'un enfant.
 *   • Android — `EXTRA_PREFER_OFFLINE`. Il faut vérifier que le pack de langue
 *     français est bien installé : sinon la reconnaissance repart en ligne
 *     sans rien dire.
 *
 * Si l'un des deux n'est pas satisfait, `onDevice` doit renvoyer faux, et le
 * bouton micro disparaît. Un réglage de confidentialité qui échoue en silence
 * est pire que pas de réglage du tout.
 */
export interface NativeSpeech {
  /** Faux si la langue n'est pas transcriptible hors ligne sur cet appareil. */
  isOnDeviceAvailable(locale: string): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  start(input: {
    locale: string;
    onText: (text: string, final: boolean) => void;
    onStatus: (status: SpeechStatus) => void;
  }): Promise<void>;
  stop(): Promise<void>;
}

let native: NativeSpeech | null = null;

export function setNativeSpeech(speech: NativeSpeech | null) {
  native = speech;
}

export function getNativeSpeech(): NativeSpeech | null {
  return native;
}
