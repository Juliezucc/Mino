import { SpeechService, SpeechStatus } from './SpeechService';

/**
 * La dictée dans un navigateur.
 *
 * Elle existe pour que l'application soit essayable sans rien installer, et
 * **elle annonce ce qu'elle est** : `onDevice` vaut faux, parce qu'un
 * navigateur transcrit en passant par le service de son éditeur. L'écran le dit
 * en toutes lettres à cet endroit-là.
 *
 * Sur le téléphone d'un enfant, ce service n'est jamais celui qui tourne : la
 * version installée utilise la reconnaissance du système, sur l'appareil.
 */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function engine(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechService implements SpeechService {
  readonly name = 'web';
  readonly available = engine() !== null;
  // Le navigateur transcrit chez son éditeur : jamais sur l'appareil.
  readonly onDevice = false;

  private recognition: Recognition | null = null;

  async requestPermission(): Promise<boolean> {
    // Le navigateur demande lui-même au premier `start()`. Rien à faire ici :
    // solliciter le micro avant que l'enfant n'ait appuyé serait une demande
    // d'autorisation sans raison visible, et donc un refus probable.
    return this.available;
  }

  async start(handlers: {
    onText: (text: string, final: boolean) => void;
    onStatus: (status: SpeechStatus) => void;
  }): Promise<void> {
    const Engine = engine();
    if (!Engine) {
      handlers.onStatus('error');
      return;
    }

    const recognition = new Engine();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const results = (event as { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> })
        .results;
      let text = '';
      let final = false;
      for (let i = 0; i < results.length; i += 1) {
        text += results[i][0].transcript;
        if (results[i].isFinal) final = true;
      }
      handlers.onText(text.trim(), final);
    };

    recognition.onerror = (event) => {
      const code = (event as { error?: string }).error;
      // « Je n'ai pas le droit » et « ça n'a pas marché » appellent deux
      // réponses différentes : la première ne se réessaie pas.
      handlers.onStatus(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : 'error');
    };

    recognition.onend = () => handlers.onStatus('idle');

    this.recognition = recognition;
    handlers.onStatus('listening');
    recognition.start();
  }

  async stop(): Promise<void> {
    this.recognition?.stop();
    this.recognition = null;
  }
}
