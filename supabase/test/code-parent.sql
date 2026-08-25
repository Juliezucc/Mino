/**
 * Le code parent : quatre chiffres, et tout l'espace parent derrière.
 *
 * Ces quatre fonctions n'avaient aucun test côté base — ni ici, ni dans Jest,
 * qui n'éprouve que la doublure locale. Le manque a coûté une panne complète
 * en production : `set_parent_pin` fixait son `search_path` à `public` seul,
 * `crypt()` vit dans `extensions` chez Supabase, et la création de famille
 * échouait à la dernière étape sur « Impossible d'enregistrer le code ». Sur un
 * PostgreSQL nu, où pgcrypto s'installe dans `public`, tout marchait.
 *
 * Le premier test ci-dessous est donc, littéralement, celui qui manquait.
 *
 * Les trois autres méfiances tiennent au fait que ce code est court et qu'un
 * enfant est assis à côté :
 *
 *   - dix mille combinaisons tombent en quelques secondes à qui peut essayer
 *     sans limite — d'où le verrou, et d'où le fait qu'il porte sur le COMPTE
 *     et non sur l'appareil ;
 *   - l'empreinte ne doit être lisible par personne, pas même par le parent :
 *     `parent_secrets` est la table sans aucune politique, et c'est voulu ;
 *   - le code d'un compte ne vaut jamais pour un autre.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Code parent : quatre chiffres, et le verrou qui les rend suffisants'

do $$ begin
  delete from auth.users where id in (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002');

  insert into auth.users (id, email, is_anonymous) values
    ('cccccccc-0000-0000-0000-000000000001', 'code@mino.app', false),
    ('cccccccc-0000-0000-0000-000000000002', 'autre@mino.app', false);
end $$;

-- ------------------------------------------------------- poser, puis ouvrir

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  /**
   * Celui-ci est le test qui manquait.
   *
   * `set_parent_pin` rend `false` sans rien dire quand l'appel est invalide,
   * mais quand `crypt()` est introuvable elle lève — et l'application traduit
   * n'importe quelle levée par « Impossible d'enregistrer le code ». Un parent
   * arrivait donc au bout de l'inscription, avec un compte créé et confirmé,
   * pour buter sur la toute dernière étape sans aucun moyen d'en sortir.
   */
  perform assert(set_parent_pin('4821'), 'le code s''enregistre');
  perform assert(has_parent_pin(), 'et la base sait qu''il existe');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  perform assert(verify_parent_pin('4821'), 'le bon code ouvre');
  perform assert(not verify_parent_pin('4822'), 'un autre code n''ouvre pas');
end $$;

-- ------------------------------------------------ ce que personne ne peut lire

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  /**
   * `parent_secrets` a la RLS active et AUCUNE politique. Ce n'est pas un
   * oubli : c'est la seule façon de dire « personne », et il faut que ce soit
   * vrai même pour le propriétaire du secret. L'empreinte ne sort jamais de la
   * base — seules les fonctions `security definer` la touchent.
   */
  perform assert(
    (select count(*) from parent_secrets) = 0,
    'le parent lui-même ne peut pas lire son empreinte');
end $$;

-- ------------------------------------------------------- ce qui est refusé

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  perform assert(not set_parent_pin('123'), 'trois chiffres sont refusés');
  perform assert(not set_parent_pin('12a4'), 'une lettre est refusée');
  -- Et le refus ne détruit pas ce qui existait : un code valable reste valable.
  perform assert(verify_parent_pin('4821'), 'un refus n''efface pas le code en place');
end $$;

do $$ begin
  set local role anon;
  set local mino.uid = '';

  perform assert(not set_parent_pin('4821'), 'sans session, aucun code ne s''enregistre');
  perform assert(not verify_parent_pin('4821'), 'et aucun ne se vérifie');
end $$;

-- ---------------------------------------------------------------- le verrou

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  for i in 1..5 loop
    perform verify_parent_pin('0000');
  end loop;

  /**
   * Cinq essais ratés et le compte se ferme cinq minutes. Le verrou porte sur
   * le COMPTE, pas sur l'appareil : verrouiller la seule tablette qu'un enfant
   * tient dans les mains est un verrou qu'il contourne en prenant l'autre.
   *
   * Conséquence assumée : le bon code est refusé lui aussi pendant ce temps.
   */
  perform assert(
    not verify_parent_pin('4821'),
    'après cinq essais ratés, même le bon code est refusé');
  perform assert(
    parent_pin_locked_seconds() > 0,
    'et l''écran peut dire combien de temps il reste');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  -- Reposer le code lève le verrou : c'est la sortie du parent qui a oublié.
  -- Elle n'aide personne d'autre — il faut déjà être connecté à son compte.
  perform assert(set_parent_pin('7315'), 'reposer le code lève le verrou');
  perform assert(parent_pin_locked_seconds() = 0, 'le compteur retombe à zéro');
  perform assert(verify_parent_pin('7315'), 'et le nouveau code ouvre');
  perform assert(not verify_parent_pin('4821'), 'l''ancien, non');
end $$;

-- ------------------------------------------------- un compte n'est pas l'autre

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000002';

  perform assert(not has_parent_pin(), 'un autre compte n''hérite d''aucun code');
  perform assert(
    not verify_parent_pin('7315'),
    'et le code du voisin n''ouvre pas chez lui');

  perform assert(set_parent_pin('9042'), 'il pose le sien');
  perform assert(verify_parent_pin('9042'), 'qui ouvre chez lui');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  -- Et le sien à lui n'a pas bougé pour autant.
  perform assert(verify_parent_pin('7315'), 'sans rien changer chez le premier');
  perform assert(not verify_parent_pin('9042'), 'qui ne connaît pas celui du voisin');
end $$;

do $$ begin
  delete from auth.users where id in (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002');
end $$;
