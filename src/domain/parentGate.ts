/**
 * Ce que l'écran du code parent doit proposer, et à qui.
 *
 * Trois situations, et une seule d'entre elles autorise à **choisir** le code.
 *
 * Le défaut que cette règle corrige : sur la tablette d'un enfant — celle qui a
 * rejoint la famille avec le code — l'écran concluait « aucun code n'est
 * défini » et invitait poliment l'enfant à en choisir un. Quatre chiffres, et
 * l'espace parent s'ouvrait sur son propre appareil.
 *
 * Depuis `supabase/code-parent-famille.sql`, le code appartient à la FAMILLE et
 * non au compte : la tablette de l'enfant voit donc qu'il existe, et le parent
 * peut ouvrir son espace depuis elle — ce que l'écran promettait déjà. Ce qui
 * ne change pas, et que la base refuse désormais elle aussi : cette tablette
 * peut VÉRIFIER le code, jamais le CHOISIR.
 *
 * Trouvé en conduisant le parcours du deuxième appareil jusqu'au bout, pas en
 * relisant l'écran : côté téléphone du parent, il se comporte parfaitement.
 */
export type ParentGate =
  /** Un code existe : il n'y a qu'à l'entrer. */
  | 'enter'
  /** Le téléphone d'un parent, et aucun code encore choisi. */
  | 'create'
  /** L'appareil d'un enfant, et aucun code : ce n'est pas à lui de le choisir. */
  | 'ask-a-parent';

export function parentGate(input: {
  hasPin: boolean;
  /** La session est celle d'un appareil arrivé par code famille, pas d'un parent. */
  onChildDevice: boolean;
  /**
   * Le parent a déclaré cet appareil comme étant celui de son enfant, ou
   * partagé à la maison — voir `/onboarding/appareil`.
   *
   * **Ce que cela ferme, et c'était grand ouvert.** `onChildDevice` ne
   * reconnaît qu'une tablette arrivée par le code famille, où la session est
   * celle d'un appareil. Or la tablette du salon est très souvent **la session
   * du parent lui-même** : c'est là qu'il s'est inscrit, puis il la partage.
   * Pour cette règle, elle passait donc pour le téléphone d'un parent, et
   * l'enfant qui touchait « Espace parent » se voyait offrir de choisir le
   * code. Quatre chiffres, et il entrait — le même défaut que celui décrit
   * plus haut, par une autre porte.
   *
   * Le parent, lui, n'est jamais bloqué : on lui fait poser son code au moment
   * exact où il déclare l'appareil partagé, donc `hasPin` est vrai avant que
   * l'enfant n'y touche.
   */
  declareALEnfant?: boolean;
  /**
   * Le parent vient de demander LUI-MÊME à poser son code, par un geste qu'un
   * enfant ne fait pas : répondre à « à qui est cet appareil ? », toucher le
   * bandeau de son tableau de bord, ou se connecter avec son mot de passe.
   *
   * **Sans ce signal, la règle enfermait le parent dehors.** Elle ne sait dire
   * qu'à QUI est l'appareil, jamais QUI est devant l'écran — si bien qu'un
   * parent présent et un enfant seul recevaient la même réponse dès que
   * l'appareil était déclaré partagé. En pleine inscription, l'application
   * disait donc au parent, debout devant elle, d'aller demander à un parent :
   * `declarerUsage` écrit le drapeau, et l'écran du code le relit une seconde
   * plus tard. Pire, les familles déjà dans cet état n'avaient plus aucune
   * issue : le tableau de bord y renvoie à chaque lancement.
   *
   * **À usage unique, et jamais persisté.** Il est armé au geste, consommé à
   * l'arrivée sur l'écran, et ne survit pas au redémarrage — sans quoi il
   * rouvrirait la porte à l'enfant à qui l'on tend la tablette une minute
   * plus tard. `parentUnlocked` ne pouvait pas jouer ce rôle : il reste vrai
   * après l'inscription, c'est-à-dire pendant que la tablette change de mains.
   */
  poseDemandeeParLeParent?: boolean;
}): ParentGate {
  if (input.hasPin) return 'enter';
  // Un appareil arrivé par le code famille ne peut pas poser de code, et
  // aucun signal ne lève cela : la base elle-même le refuse — `set_parent_pin`
  // exige `auth_is_parent()`, voir `supabase/code-parent-famille.sql`.
  if (input.onChildDevice) return 'ask-a-parent';
  if (input.declareALEnfant && !input.poseDemandeeParLeParent) return 'ask-a-parent';
  return 'create';
}

/**
 * L'inscription demande-t-elle un code parent ?
 *
 * **Oui, toujours, et cette fonction existe pour que ça cesse d'être une
 * condition d'écran.** La règle vivait dans `app/onboarding/account.tsx` sous
 * la forme `Boolean(compteOuvert) && !codeDejaPose`, c'est-à-dire l'inverse de
 * ce qu'elle devait dire : seul un parent déjà inscrit et sans famille se
 * voyait demander un code. Une inscription ordinaire n'en posait aucun, et
 * l'espace parent restait ouvert à l'enfant sur la tablette qu'on venait de
 * lui confier.
 *
 * L'argument contraire — deux secrets à inventer sur le même écran — pesait
 * moins que la règle, et surtout il ne valait que pour l'application : le
 * tunnel du site pose la question, lui. Une règle qui dépend de la porte
 * d'entrée n'est pas une règle.
 *
 * La seule exception qui tienne : ne pas le redemander à qui vient de le
 * choisir. Le redemander laisserait croire que le premier n'a pas été retenu.
 */
export function demandeLeCodeALInscription(input: { codeDejaPose: boolean }): boolean {
  return !input.codeDejaPose;
}

/**
 * Un code à quatre chiffres qu'on devine du premier coup.
 *
 * **La règle vivait dans un seul écran, et l'autre porte l'ignorait.**
 * L'inscription refusait `0000` et `1234` ; l'écran du code, lui, appelait
 * `setParentPin` sans rien vérifier — or c'est par là que passent désormais
 * tous les rattrapages : le bandeau du tableau de bord, la connexion par mot
 * de passe, le changement d'appareil dans les réglages. La porte la plus
 * empruntée était donc la seule sans serrure.
 *
 * Ce que ça coûte : quatre chiffres, dix mille combinaisons, cinq essais par
 * cinq minutes. Un enfant qui tape `1234` puis la date de son anniversaire
 * n'a pas besoin des dix mille.
 *
 * La liste reste courte à dessein. Refuser trop de codes, c'est renvoyer un
 * parent à l'invention alors qu'il tient déjà son téléphone — et ce qu'il
 * invente sous la contrainte, il l'oublie.
 */
export function codeTropFacile(pin: string): boolean {
  return /^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0000';
}

/**
 * Faut-il refermer l'espace parent quand l'application passe en arrière-plan ?
 *
 * **Rien ne le refermait, jamais.** Aucun écouteur d'état d'application dans
 * tout le dépôt : un espace parent ouvert le restait des heures, écran éteint,
 * tablette posée sur la table. Le seul verrou était un booléen en mémoire,
 * remis à faux par deux gestes délibérés — passer par le sélecteur de profils,
 * ou toucher « Verrouiller » au fond des réglages. Personne ne fait ni l'un ni
 * l'autre avant de tendre une tablette à un enfant.
 *
 * **Mais pas partout.** Sur le téléphone du parent, refermer à chaque
 * bascule ferait retaper quatre chiffres vingt fois par jour — et quatre
 * chiffres qu'on retape vingt fois par jour finissent par être `1234`, ou par
 * être tapés devant l'enfant. Le remède serait pire que le mal.
 *
 * La ligne est donc la même que partout ailleurs : ce que le parent a déclaré
 * de cet appareil. Sur le sien, on ne referme pas. Sur celui d'un enfant ou
 * sur la tablette partagée, la mise en arrière-plan est exactement l'instant
 * où elle change de mains.
 */
export function refermerEnArrierePlan(usage: 'enfant' | 'partage' | 'parent'): boolean {
  return usage !== 'parent';
}
