/**
 * L'ordre d'application des fichiers SQL, écrit une seule fois.
 *
 * `scripts/test-sql.mjs` les rejoue dans cet ordre sur une base jetable et
 * `scripts/db-push.mjs` les applique dans ce même ordre sur la vraie. Deux
 * listes auraient fini par diverger, et la divergence se serait vue en
 * production, pas au test.
 *
 * L'ordre n'est pas décoratif : `schema.sql` crée les tables et les fonctions
 * (`auth_family_ids`, `auth_is_parent`) dont tous les autres dépendent.
 */
export const SQL_FILES = [
  ['schema.sql', 'tables, RLS, fonctions'],
  ['scale.sql', 'index, temps réel, purges'],
  ['support.sql', 'signalements'],
  ['analytics.sql', 'journal de facturation et vues'],
  ['essai.sql', 'les 30 jours d’essai, à la création de la famille'],
  ['store.sql', 'achats App Store et Play Store'],
  ['companion.sql', 'budget et conversations de Mino'],
  ['retention.sql', 'ce qu’on garde, et combien de temps'],
  ['compte.sql', 'quitter : suppression du compte'],
  ['notifications.sql', 'jetons de notification'],
  ['courrier.sql', 'ce que Mino a déjà écrit à chaque famille'],
];
