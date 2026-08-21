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

export function parentGate(input: { hasPin: boolean; onChildDevice: boolean }): ParentGate {
  if (input.hasPin) return 'enter';
  return input.onChildDevice ? 'ask-a-parent' : 'create';
}
