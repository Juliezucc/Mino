/** The eight expressions the brand guide defines for Mino. */
export type MascotExpression =
  | 'happy'
  | 'proud'
  | 'motivated'
  | 'surprised'
  | 'delighted'
  | 'worried'
  | 'sad'
  | 'sleepy';

/** Product situations, mapped to an expression by `expressionForSituation`. */
export type MascotSituation =
  | 'idle'
  | 'mission-done'
  | 'waiting-validation'
  | 'minutes-earned'
  | 'almost-out-of-time'
  | 'out-of-time'
  | 'bravo'
  | 'goodnight';

export function expressionForSituation(situation: MascotSituation): MascotExpression {
  switch (situation) {
    case 'mission-done':
      return 'proud';
    case 'waiting-validation':
      return 'motivated';
    case 'minutes-earned':
      return 'delighted';
    case 'almost-out-of-time':
      return 'worried';
    case 'out-of-time':
      return 'sad';
    case 'bravo':
      return 'proud';
    case 'goodnight':
      return 'sleepy';
    default:
      return 'happy';
  }
}
