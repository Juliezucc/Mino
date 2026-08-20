import { Platform } from 'react-native';

import { SpeechService } from './SpeechService';
import { NativeSpeechService } from './NativeSpeechService';
import { NullSpeechService } from './NullSpeechService';
import { WebSpeechService } from './WebSpeechService';
import { getNativeSpeech } from './native';

export * from './SpeechService';
export * from './native';
export { NativeSpeechService, NullSpeechService, WebSpeechService };

let instance: SpeechService = new NullSpeechService();

/**
 * Sur un téléphone : la reconnaissance du système, et seulement si elle sait
 * travailler hors ligne. Dans un navigateur : celle du navigateur, annoncée
 * comme telle. Partout ailleurs : rien, et le clavier suffit.
 *
 * L'initialisation est asynchrone parce que la question « cet appareil
 * sait-il transcrire le français sans réseau ? » l'est. En attendant la
 * réponse, le service est muet — ce qui est le bon défaut : mieux vaut un
 * bouton qui apparaît une seconde plus tard qu'un bouton qui promet ce que
 * l'appareil ne sait pas faire.
 */
export async function initSpeechService(): Promise<SpeechService> {
  if (Platform.OS === 'web') {
    const web = new WebSpeechService();
    instance = web.available ? web : new NullSpeechService();
    return instance;
  }

  const native = getNativeSpeech();
  instance = native ? await NativeSpeechService.create(native) : new NullSpeechService();
  return instance;
}

export function getSpeechService(): SpeechService {
  return instance;
}

/** Test hook. */
export function setSpeechService(service: SpeechService) {
  instance = service;
}
