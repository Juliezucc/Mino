import { SpeechService } from './SpeechService';

/** Pas de dictée ici : l'écran n'affiche aucun bouton micro et n'en parle pas. */
export class NullSpeechService implements SpeechService {
  readonly name = 'none';
  readonly available = false;
  readonly onDevice = false;

  async requestPermission() {
    return false;
  }

  async start() {
    /* rien */
  }

  async stop() {
    /* rien */
  }
}
