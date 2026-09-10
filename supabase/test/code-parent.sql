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
 * **Le code appartient maintenant à la FAMILLE, plus au compte** — voir
 * `supabase/code-parent-famille.sql`. Ce fichier était indexé par `user_id`, si
 * bien que la tablette d'un enfant, qui a son propre compte, ne pouvait
 * vérifier aucun code : l'écran lui promettait pourtant « ensuite, il marchera
 * ici ». Un parent debout à côté de son enfant devait aller chercher son propre
 * téléphone pour confirmer une mission — c'est-à-dire au moment exact où la
 * boucle du produit se joue.
 *
 * Ce qui doit tenir, et que chaque bloc ci-dessous éprouve :
 *
 *   - la tablette de l'enfant VÉRIFIE le code, elle ne le CHOISIT jamais.
 *     Sinon quatre chiffres de son invention lui ouvrent l'espace parent ;
 *   - le verrou porte sur la famille : cinq essais ratés ferment la porte pour
 *     tous ses appareils, sans quoi il suffit d'en prendre un autre ;
 *   - l'empreinte n'est lisible par personne, pas même par le parent ;
 *   - le code d'une famille ne vaut jamais pour une autre.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Code parent : quatre chiffres, et le verrou qui les rend suffisants'

do $$ begin
  delete from families where id in ('fam-code-1', 'fam-code-2');
  delete from auth.users where id in (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003');

  insert into auth.users (id, email, is_anonymous) values
    ('cccccccc-0000-0000-0000-000000000001', 'code@mino.app', false),
    -- La tablette de l'enfant : arrivée par le code famille, donc un compte à
    -- elle, et surtout aucune ligne dans `parents`.
    ('cccccccc-0000-0000-0000-000000000002', 'tablette@mino.app', true),
    ('cccccccc-0000-0000-0000-000000000003', 'voisin@mino.app', false);

  insert into families (id, name, code, referral_code) values
    ('fam-code-1', 'Martin', 'CODEFAM1', 'CODEPAR1'),
    ('fam-code-2', 'Voisins', 'CODEFAM2', 'CODEPAR2');

  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-code-1', 'fam-code-1', 'cccccccc-0000-0000-0000-000000000001', 'Julie', 'code@mino.app'),
    ('par-code-2', 'fam-code-2', 'cccccccc-0000-0000-0000-000000000003', 'Voisin', 'voisin@mino.app');

  insert into family_devices (id, family_id, user_id, joined_at) values
    ('fd-code-1', 'fam-code-1', 'cccccccc-0000-0000-0000-000000000002', now());
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

-- ------------------------------------- la tablette de l'enfant, la nouveauté

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000002';

  /**
   * La promesse que l'écran faisait déjà, et qu'il ne tenait pas.
   *
   * « Le code se choisit sur le téléphone de ton parent. Ensuite, il marchera
   * ici. » Il ne marchait pas, et il ne pouvait pas : `parent_secrets` était
   * indexée par compte, et cette tablette a le sien.
   */
  perform assert(has_parent_pin(), 'la tablette voit qu''un code existe');
  perform assert(verify_parent_pin('4821'), 'et le code du parent l''ouvre ICI');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000002';

  /**
   * Vérifier, oui. Choisir, jamais.
   *
   * C'est la ligne qui sépare « le parent ouvre son espace depuis la tablette
   * de son enfant » de « l'enfant s'ouvre l'espace parent en quatre chiffres de
   * son invention ». `parentGate` la tient déjà côté application, mais une
   * règle qui n'existe que dans le client n'est pas une règle.
   */
  perform assert(
    not set_parent_pin('0000'),
    'mais la tablette ne peut PAS choisir le code');
  perform assert(
    verify_parent_pin('4821'),
    'et sa tentative n''a rien écrasé');
end $$;

-- ------------------------------------------------ ce que personne ne peut lire

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  /**
   * `family_secrets` a la RLS active et AUCUNE politique. Ce n'est pas un
   * oubli : c'est la seule façon de dire « personne », et il faut que ce soit
   * vrai même pour le parent. L'empreinte ne sort jamais de la base — seules
   * les fonctions `security definer` la touchent.
   */
  perform assert(
    (select count(*) from family_secrets) = 0,
    'le parent lui-même ne peut pas lire l''empreinte');
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
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000002';

  -- Les cinq essais viennent de la tablette de l'enfant : c'est de là que
  -- viendra la vraie tentative, et c'est donc là qu'il faut compter.
  for i in 1..5 loop
    perform verify_parent_pin('0000');
  end loop;

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

  /**
   * Le verrou porte sur la FAMILLE, et c'est ce qui le rend utile.
   *
   * Compté par appareil, un enfant en ferait le tour en prenant la tablette
   * d'à côté — ou le téléphone posé sur la table. Conséquence assumée : le
   * parent est bloqué lui aussi pendant cinq minutes, sur tous ses appareils.
   */
  perform assert(
    not verify_parent_pin('4821'),
    'et le blocage suit la famille : le téléphone du parent est fermé aussi');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  -- Reposer le code lève le verrou : c'est la sortie du parent qui a oublié.
  -- Elle n'aide personne d'autre — il faut une ligne dans `parents` pour cela,
  -- et la tablette de l'enfant n'en a pas.
  perform assert(set_parent_pin('7315'), 'reposer le code lève le verrou');
  perform assert(parent_pin_locked_seconds() = 0, 'le compteur retombe à zéro');
  perform assert(verify_parent_pin('7315'), 'et le nouveau code ouvre');
  perform assert(not verify_parent_pin('4821'), 'l''ancien, non');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000002';

  -- Et la tablette de l'enfant suit, sans que personne n'ait rien à y faire.
  perform assert(verify_parent_pin('7315'), 'la tablette connaît le nouveau code');
end $$;

-- ------------------------------------------------ une famille n'est pas l'autre

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000003';

  perform assert(not has_parent_pin(), 'une autre famille n''hérite d''aucun code');
  perform assert(
    not verify_parent_pin('7315'),
    'et le code du voisin n''ouvre pas chez elle');

  perform assert(set_parent_pin('9042'), 'elle pose le sien');
  perform assert(verify_parent_pin('9042'), 'qui ouvre chez elle');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'cccccccc-0000-0000-0000-000000000001';

  -- Et celui de la première n'a pas bougé pour autant.
  perform assert(verify_parent_pin('7315'), 'sans rien changer chez la première');
  perform assert(not verify_parent_pin('9042'), 'qui ne connaît pas celui du voisin');
end $$;

do $$ begin
  delete from families where id in ('fam-code-1', 'fam-code-2');
  delete from auth.users where id in (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003');
end $$;
