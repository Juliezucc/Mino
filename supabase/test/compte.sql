/**
 * Quitter, et que ce soit vrai.
 *
 * `delete_my_account()` est la fonction la plus irréversible du dépôt : rien
 * de ce qu'elle touche ne revient. Elle mérite donc les deux méfiances
 * opposées, et elles ne se contentent pas l'une de l'autre :
 *
 *   - qu'elle efface VRAIMENT — une suppression qui laisse derrière elle les
 *     enfants, les missions et le grand livre est pire que rien, parce que la
 *     famille est alors rattachée à personne, lisible par personne, et donc
 *     indestructible ;
 *
 *   - qu'elle n'efface QUE ça — un parent qui s'en va n'emporte pas la
 *     famille d'un autre, et un appareil enfant n'a rien à supprimer du tout.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Compte : partir pour de bon, et pas plus loin'

-- ------------------------------------------------- une famille à un parent

do $$ begin
  delete from families where id in ('fam-part', 'fam-deux');
  delete from auth.users where id in (
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '77777777-7777-7777-7777-777777777777',
    '88888888-8888-8888-8888-888888888888');

  insert into auth.users (id, email, is_anonymous) values
    ('55555555-5555-5555-5555-555555555555', 'part@mino.app', false),
    -- L'appareil de l'enfant : une session anonyme, et le rôle
    -- `authenticated` comme tout le monde chez Supabase.
    ('88888888-8888-8888-8888-888888888888', null, true);
  insert into families (id, name, code, referral_code) values
    ('fam-part', 'Martin', 'QUITTE1', 'PARRAINQ');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-part', 'fam-part', '55555555-5555-5555-5555-555555555555', 'Sophie', 'part@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-part', 'fam-part', 'Jules', 7, 'renard');
  insert into missions (id, family_id, title, icon, minutes, created_by) values
    ('mis-part', 'fam-part', 'Mettre la table', '🍽️', 10, 'par-part');
  insert into mission_assignments (id, mission_id, child_id) values
    ('asg-part', 'mis-part', 'enf-part');
  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason) values
    ('tx-part', 'fam-part', 'enf-part', 30, 'mission_reward', 'Mission');
  insert into family_devices (id, family_id, user_id) values
    ('dev-part', 'fam-part', '88888888-8888-8888-8888-888888888888');
end $$;

do $$
declare v_effacees int;
begin
  set local role authenticated;
  set local mino.uid = '55555555-5555-5555-5555-555555555555';

  v_effacees := delete_my_account();
  perform assert(v_effacees = 1, 'le dernier parent emporte sa famille');
end $$;

-- Retour en propriétaire pour constater : la RLS masquerait ce qu'on cherche.
do $$ begin
  perform assert(
    not exists (select 1 from families where id = 'fam-part'),
    'la famille a disparu');
  perform assert(
    not exists (select 1 from children where id = 'enf-part'),
    'l''enfant avec elle');
  perform assert(
    not exists (select 1 from missions where id = 'mis-part'),
    'les missions avec elle');
  perform assert(
    not exists (select 1 from mission_assignments where id = 'asg-part'),
    'ce qui lui était confié avec elle');
  perform assert(
    not exists (select 1 from screen_time_transactions where id = 'tx-part'),
    'le grand livre avec elle');
  perform assert(
    not exists (select 1 from parents where id = 'par-part'),
    'la fiche du parent avec elle');
  perform assert(
    not exists (select 1 from family_devices where id = 'dev-part'),
    'et l''appareil appairé ne reste pas accroché à une famille morte');
  perform assert(
    not exists (select 1 from auth.users where id = '55555555-5555-5555-5555-555555555555'),
    'l''identité elle-même est supprimée, pas seulement ses données');
end $$;

-- --------------------------------------------- une famille à deux parents

do $$ begin
  insert into auth.users (id, email) values
    ('66666666-6666-6666-6666-666666666666', 'reste@mino.app'),
    ('77777777-7777-7777-7777-777777777777', 'sen-va@mino.app');
  insert into families (id, name, code, referral_code) values
    ('fam-deux', 'Bernard', 'QUITTE2', 'PARRAINR');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-reste', 'fam-deux', '66666666-6666-6666-6666-666666666666', 'Anne', 'reste@mino.app'),
    ('par-va', 'fam-deux', '77777777-7777-7777-7777-777777777777', 'Marc', 'sen-va@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-deux', 'fam-deux', 'Chloé', 9, 'chat');
end $$;

do $$
declare v_effacees int;
begin
  set local role authenticated;
  set local mino.uid = '77777777-7777-7777-7777-777777777777';

  v_effacees := delete_my_account();
  perform assert(v_effacees = 0, 'partir d''une famille où quelqu''un reste n''efface aucune famille');
end $$;

do $$ begin
  perform assert(
    exists (select 1 from families where id = 'fam-deux'),
    'la famille reste à celui qui reste');
  perform assert(
    exists (select 1 from children where id = 'enf-deux'),
    -- Le point important de tout ce fichier : un parent qui s'en va n'a pas le
    -- pouvoir d'effacer l'enfant de l'autre.
    'L''ENFANT DE L''AUTRE PARENT EST INTACT');
  perform assert(
    exists (select 1 from parents where id = 'par-reste'),
    'et l''autre parent aussi');
  perform assert(
    not exists (select 1 from parents where id = 'par-va'),
    'seul le partant est parti');
  perform assert(
    not exists (select 1 from auth.users where id = '77777777-7777-7777-7777-777777777777'),
    'son identité avec lui');
end $$;

-- --------------------------------------------------- ce qu'un enfant ne peut pas

/**
 * L'appareil d'un enfant porte le rôle `authenticated` : chez Supabase une
 * session anonyme n'est pas un rôle à part. Sans le garde-fou explicite de la
 * fonction, l'appel aurait glissé — la boucle n'aurait trouvé aucune famille,
 * et le `delete from auth.users` final aurait tout de même emporté l'identité
 * de l'appareil, qui se serait désappairé tout seul.
 */
do $$
declare v_refuse boolean := false;
begin
  set local role authenticated;
  set local mino.uid = '88888888-8888-8888-8888-888888888888';

  begin
    perform delete_my_account();
  exception when others then
    v_refuse := true;
  end;

  perform assert(v_refuse, 'un appareil enfant ne peut pas supprimer de compte');
end $$;

do $$ begin
  perform assert(
    exists (select 1 from auth.users where id = '88888888-8888-8888-8888-888888888888'),
    'et il ne se désappaire pas lui-même en essayant');
end $$;

-- ------------------------------------------------------- sans aucune session

do $$
declare v_refuse boolean := false;
begin
  set local role authenticated;
  set local mino.uid = '';

  begin
    perform delete_my_account();
  exception when others then
    v_refuse := true;
  end;

  perform assert(v_refuse, 'sans session, il n''y a rien à supprimer');
end $$;

do $$ begin
  delete from families where id = 'fam-deux';
  delete from auth.users where id in (
    '66666666-6666-6666-6666-666666666666',
    '88888888-8888-8888-8888-888888888888');
end $$;
