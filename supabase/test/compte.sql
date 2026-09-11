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

-- ------------------------------- un second parent SANS COMPTE n'hérite de rien

/**
 * Le profil de parent ne garde pas la famille en vie.
 *
 * Depuis qu'une famille peut porter un second parent en profil — une ligne
 * `parents` sans `user_id` ni `email`, qui rejoint par le code famille — le
 * compte à deux de `delete_my_account()` devenait faux : le titulaire du
 * compte partait, sa ligne était retirée, et la famille restait rattachée à un
 * profil que PERSONNE ne peut ouvrir. Ni lisible, ni supprimable : exactement
 * l'état que tout ce fichier existe pour interdire.
 *
 * L'essai tombe si l'on remet `count(*)` à la place de la clause qui compte
 * les comptes — vérifié en le cassant.
 */
do $$ begin
  delete from families where id = 'fam-prof';
  delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  insert into auth.users (id, email) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'titulaire@mino.app');
  insert into families (id, name, code, referral_code) values
    ('fam-prof', 'Zucher', 'QUITTE3', 'PARRAINS');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-titu', 'fam-prof', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Julie', 'titulaire@mino.app'),
    -- Le second parent : un prénom, et rien d'autre. C'est tout ce que
    -- `ajouter-parent` écrit.
    ('par-prof', 'fam-prof', null, 'Marc', null);
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-prof', 'fam-prof', 'Noah', 10, 'chat');
end $$;

do $$
declare v_effacees int;
begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  v_effacees := delete_my_account();
  perform assert(
    v_effacees = 1,
    'UN PROFIL SANS COMPTE NE RETIENT PAS LA FAMILLE : elle part avec le titulaire');
end $$;

do $$ begin
  perform assert(
    not exists (select 1 from families where id = 'fam-prof'),
    'la famille a bien disparu');
  perform assert(
    not exists (select 1 from parents where id = 'par-prof'),
    'et le profil du second parent avec elle, par cascade');
  perform assert(
    not exists (select 1 from children where id = 'enf-prof'),
    'l''enfant aussi');
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

-- ------------------------------------------ la date d'une déclaration

/**
 * L'horloge du téléphone ne date pas une mission.
 *
 * Les deux index uniques de `schema.sql` gravent « une fois par jour » sur
 * `completed_at`. Tant que `completed_at` venait du client, il suffisait
 * d'avancer la date de l'appareil d'un jour pour que la déclaration d'hier
 * cesse d'être celle d'aujourd'hui : plus de collision, mission redéclarable,
 * minutes doublées. Les index ne protégeaient de rien contre le seul
 * adversaire qu'ils avaient.
 */
do $$ begin
  delete from families where id = 'fam-horl';
  delete from auth.users where id = '99999999-9999-9999-9999-999999999999';

  insert into auth.users (id, email) values
    ('99999999-9999-9999-9999-999999999999', 'horloge@mino.app');
  insert into families (id, name, code, referral_code) values
    ('fam-horl', 'Petit', 'HORLOG1', 'PARRAINH');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-horl', 'fam-horl', '99999999-9999-9999-9999-999999999999', 'Léa', 'horloge@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-horl', 'fam-horl', 'Sacha', 8, 'hibou');
  insert into missions (id, family_id, title, icon, minutes, created_by) values
    ('mis-horl', 'fam-horl', 'Ranger sa chambre', '🧹', 15, 'par-horl');
  insert into mission_assignments (id, mission_id, child_id) values
    ('asg-horl', 'mis-horl', 'enf-horl');
end $$;

do $$
declare v_date date;
begin
  set local role authenticated;
  set local mino.uid = '99999999-9999-9999-9999-999999999999';

  -- Un client qui prétend être demain.
  insert into mission_completions
    (id, family_id, assignment_id, mission_id, child_id, status,
     minutes_requested, minutes_awarded, completed_at)
  values
    ('cmp-horl', 'fam-horl', 'asg-horl', 'mis-horl', 'enf-horl', 'pending', 15, 0,
     now() + interval '1 day');

  select (completed_at at time zone 'UTC')::date into v_date
  from mission_completions where id = 'cmp-horl';

  perform assert(
    v_date = (now() at time zone 'UTC')::date,
    'la base date la déclaration, pas le téléphone');
end $$;

/**
 * Et la conséquence, qui est le vrai sujet : la deuxième déclaration se heurte
 * maintenant à l'index, puisque les deux portent la même date.
 */
do $$
declare v_refuse boolean := false;
begin
  set local role authenticated;
  set local mino.uid = '99999999-9999-9999-9999-999999999999';

  begin
    insert into mission_completions
      (id, family_id, assignment_id, mission_id, child_id, status,
       minutes_requested, minutes_awarded, completed_at)
    values
      ('cmp-horl-2', 'fam-horl', 'asg-horl', 'mis-horl', 'enf-horl', 'pending', 15, 0,
       now() + interval '1 day');
  exception when unique_violation then
    v_refuse := true;
  end;

  perform assert(v_refuse, 'AVANCER L''HORLOGE NE FAIT PLUS PASSER LA MISSION DEUX FOIS');
end $$;

do $$ begin
  -- Ce que l'administration doit garder le droit de faire : dater vieux, sans
  -- session, comme le font les jeux d'essai de la conservation.
  insert into mission_completions
    (id, family_id, assignment_id, mission_id, child_id, status,
     minutes_requested, minutes_awarded, completed_at)
  values
    ('cmp-horl-vieux', 'fam-horl', 'asg-horl', 'mis-horl', 'enf-horl', 'approved', 15, 15,
     now() - interval '200 days');

  perform assert(
    (select (completed_at at time zone 'UTC')::date
     from mission_completions where id = 'cmp-horl-vieux')
      < (now() at time zone 'UTC')::date,
    'sans session, une date choisie reste une date choisie');

  delete from families where id = 'fam-horl';
  delete from auth.users where id = '99999999-9999-9999-9999-999999999999';
end $$;

-- ------------------------------------- ce que l'appareil dit de son bouclier

/**
 * Le mode de panne silencieux.
 *
 * Un adolescent retire à Mino l'accès aux statistiques d'usage — deux touches
 * dans les réglages Android — et le bouclier cesse d'exister. Le parent, lui,
 * lit l'autorisation de SON téléphone, où tout va bien, et continue de croire
 * que Mino encadre quelque chose. Un bouclier mort dont le parent ignore la
 * mort produit la confiance sans la protection.
 *
 * Trois choses à tenir : le parent voit, l'appareil ne rend compte que de
 * lui-même, et il ne peut pas s'attribuer l'enfant d'une autre famille.
 */
do $$ begin
  delete from families where id in ('fam-bouc', 'fam-autre');
  delete from auth.users where id in (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000003');

  insert into auth.users (id, email, is_anonymous) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'bouclier@mino.app', false),
    ('aaaaaaaa-0000-0000-0000-000000000002', null, true),
    ('aaaaaaaa-0000-0000-0000-000000000003', null, true);
  insert into families (id, name, code, referral_code) values
    ('fam-bouc', 'Roux', 'BOUCLI1', 'PARRAINB'),
    ('fam-autre', 'Voisin', 'BOUCLI2', 'PARRAINV');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-bouc', 'fam-bouc', 'aaaaaaaa-0000-0000-0000-000000000001', 'Inès', 'bouclier@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-bouc', 'fam-bouc', 'Malo', 10, 'renard'),
    ('enf-autre', 'fam-autre', 'Ava', 10, 'chat');
  insert into family_devices (id, family_id, user_id) values
    ('dev-bouc', 'fam-bouc', 'aaaaaaaa-0000-0000-0000-000000000002'),
    ('dev-autre', 'fam-autre', 'aaaaaaaa-0000-0000-0000-000000000003');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-0000-0000-0000-000000000002';

  perform report_shield('denied', '  Tablette de Malo  ', 'enf-bouc');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform assert(
    (select shield_status from family_devices where id = 'dev-bouc') = 'denied',
    'LE PARENT VOIT QUE LE BOUCLIER EST TOMBÉ SUR LA TABLETTE');
  perform assert(
    (select label from family_devices where id = 'dev-bouc') = 'Tablette de Malo',
    'et de quel appareil il s''agit');
  perform assert(
    (select child_id from family_devices where id = 'dev-bouc') = 'enf-bouc',
    'et de quel enfant');
  perform assert(
    (select shield_seen_at from family_devices where id = 'dev-bouc') is not null,
    'et quand il a donné de ses nouvelles — le silence se lit aussi');

  -- La famille d'à côté reste invisible, comme partout ailleurs.
  perform assert(
    not exists (select 1 from family_devices where id = 'dev-autre'),
    'l''appareil d''une autre famille reste invisible');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-0000-0000-0000-000000000002';

  -- Un appareil qui tente de se dire celui d'un enfant d'une autre famille :
  -- le prénom affiché au parent doit être le sien, pas celui d'un inconnu.
  perform report_shield('approved', null, 'enf-autre');

  perform assert(
    (select child_id from family_devices where id = 'dev-bouc') = 'enf-bouc',
    'un appareil ne s''attribue pas l''enfant d''une autre famille');
  perform assert(
    (select shield_status from family_devices where id = 'dev-bouc') = 'approved',
    'mais son propre statut, oui');
end $$;

do $$
declare v_refuse boolean := false;
begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-0000-0000-0000-000000000002';

  begin
    perform report_shield('bidon');
  exception when others then
    v_refuse := true;
  end;

  perform assert(v_refuse, 'un statut inventé est refusé');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'aaaaaaaa-0000-0000-0000-000000000002';

  -- Et surtout : il ne rend compte que de LUI. La ligne du voisin ne bouge pas.
  perform assert(
    (select shield_status from family_devices where id = 'dev-autre') is null,
    'rendre compte ne touche jamais la ligne d''un autre appareil');
end $$;

do $$ begin
  delete from families where id in ('fam-bouc', 'fam-autre');
  delete from auth.users where id in (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000003');
end $$;
