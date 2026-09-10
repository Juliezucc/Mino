/**
 * Ce que l'écran du code parent doit proposer, et à qui.
 *
 * Trois situations, et une seule d'entre elles autorise à **choisir** le code.
 *
 * Le défaut que cette règle corrige : sur la tablette d'un enfant — celle qui a
 * rejoint la famille avec le code — il n'existe aucun code parent, puisque le
 * code appartient au compte du parent. L'écran en concluait « aucun code n'est
 * défini » et invitait poliment l'enfant à en choisir un. Quatre chiffres, et
 * l'espace parent s'ouvrait sur son propre appareil.
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
}): ParentGate {
  if (input.hasPin) return 'enter';
  return input.onChildDevice || input.declareALEnfant ? 'ask-a-parent' : 'create';
}
