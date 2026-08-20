/**
 * Dicter au lieu d'écrire.
 *
 * Un enfant de huit ans écrit lentement, et l'attente entre deux phrases suffit
 * à faire abandonner la conversation. Parler change complètement l'usage.
 *
 * Mais la voix d'un enfant n'est pas du texte, et la confondre avec du texte
 * serait l'erreur de conception la plus coûteuse de tout le produit. D'où une
 * règle unique, tenue ici et pas dans un commentaire :
 *
 * **AUCUN SON NE QUITTE JAMAIS L'APPAREIL, ET AUCUN SON N'EST CONSERVÉ.**
 *
 * La transcription se fait sur le téléphone. Seul le texte obtenu part —
 * exactement comme s'il avait été tapé. Envoyer l'enregistrement d'une voix
 * d'enfant à un service tiers ferait basculer Mino dans une tout autre
 * catégorie : donnée proche du biométrique, dossier autrement plus lourd
 * auprès d'Apple, et une politique de confidentialité impossible à tenir.
 *
 * Conséquence assumée : là où l'appareil ne sait pas transcrire seul, **la
 * dictée n'est pas proposée du tout**. L'enfant se sert alors du microphone de
 * son clavier, qui relève des conditions d'Apple ou de Google et non des
 * nôtres — c'est d'ailleurs ce qui fonctionne déjà aujourd'hui.
 */

export type SpeechStatus =
  /** Rien en cours. */
  | 'idle'
  /** Le micro écoute. */
  | 'listening'
  /** Autorisation refusée : à dire, pas à retenter en boucle. */
  | 'denied'
  | 'error';

export interface SpeechService {
  readonly name: string;
  /** Faux : aucun bouton micro n'est affiché, et le clavier reste la voie. */
  readonly available: boolean;
  /**
   * Vrai quand la transcription a lieu sur l'appareil.
   *
   * Sur téléphone et tablette, c'est la seule valeur acceptable — voir la règle
   * ci-dessus. Un navigateur, lui, passe par le service de son éditeur : la
   * dictée y reste possible pour essayer l'application, et l'écran le dit.
   */
  readonly onDevice: boolean;

  /**
   * Demande l'autorisation, au premier appui et jamais au démarrage.
   *
   * Trois réponses et non deux, parce qu'elles appellent trois phrases
   * différentes : « refusé » se règle dans les réglages du téléphone,
   * « impossible ici » ne se règle nulle part — c'est le cas de l'aperçu web,
   * où le cadre interdit le micro — et dire à un enfant d'aller demander à ses
   * parents quelque chose qu'aucun parent ne pourra changer est la pire des
   * deux erreurs.
   */
  requestPermission(): Promise<'granted' | 'denied' | 'blocked'>;

  /**
   * Écoute jusqu'à `stop()`, en rappelant le texte à mesure.
   * `final` distingue une transcription achevée d'une hypothèse en cours.
   */
  start(handlers: {
    onText: (text: string, final: boolean) => void;
    onStatus: (status: SpeechStatus) => void;
  }): Promise<void>;

  stop(): Promise<void>;
}
