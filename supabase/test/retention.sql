/**
 * Ce qu'on efface, et surtout ce qu'on n'efface pas.
 *
 * Une fonction qui supprime des lignes du grand livre mérite plus de méfiance
 * que tout le reste du dépôt : elle touche à la seule chose que l'application
 * promet, le compteur de minutes. Le premier test ci-dessous est donc le seul
 * qui compte vraiment — **le solde après doit être le solde avant**, à la
 * minute près, pour chaque enfant.
 *
 * Les autres tiennent les bords : ce qui attend un parent ne s'efface jamais,
 * deux passages valent un seul, et rien de tout cela n'est à la portée d'un
 * appareil.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Conservation : replier sans jamais changer un solde'

-- --------------------------------------------------------------- la famille

do $$
declare v_j int;
begin
  delete from families where id = 'fam-ret';
  delete from auth.users where id = '44444444-4444-4444-4444-444444444444';

  insert into auth.users (id, email) values
    ('44444444-4444-4444-4444-444444444444', 'retention@mino.app');
  insert into families (id, name, code, referral_code) values
    ('fam-ret', 'Durand', 'DURAND1', 'PARRAIN9');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-ret', 'fam-ret', '44444444-4444-4444-4444-444444444444', 'Claire', 'retention@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-a', 'fam-ret', 'Léa', 8, 'renard'),
    ('enf-b', 'fam-ret', 'Tom', 6, 'hibou'),
    -- Un enfant dont tout l'ancien s'annule : il ne doit pas recevoir de ligne
    -- d'ouverture à zéro.
    ('enf-c', 'fam-ret', 'Zoé', 9, 'chat');
  insert into missions (id, family_id, title, icon, minutes, created_by) values
    ('mis-ret', 'fam-ret', 'Ranger sa chambre', '🧹', 10, 'par-ret');
  insert into mission_assignments (id, mission_id, child_id) values
    ('asg-a', 'mis-ret', 'enf-a'),
    ('asg-b', 'mis-ret', 'enf-b');

  -- Deux ans de grand livre, réparti de part et d'autre de la fenêtre.
  for v_j in 1..24 loop
    insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, created_at)
    values
      ('vieux-a-' || v_j, 'fam-ret', 'enf-a', 10, 'mission_reward', 'Mission',
       now() - make_interval(days => 30 * v_j)),
      ('vieux-b-' || v_j, 'fam-ret', 'enf-b', -5, 'screen_time_used', 'Écran',
       now() - make_interval(days => 30 * v_j));
  end loop;

  -- Zoé : +60 puis −60, tous deux hors fenêtre.
  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, created_at)
  values
    ('vieux-c-1', 'fam-ret', 'enf-c', 60, 'parent_adjustment', 'Cadeau', now() - interval '300 days'),
    ('vieux-c-2', 'fam-ret', 'enf-c', -60, 'screen_time_used', 'Écran', now() - interval '299 days');

  -- Et de l'activité récente, qui doit rester intacte.
  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, created_at)
  values
    ('recent-a', 'fam-ret', 'enf-a', 25, 'mission_reward', 'Mission', now() - interval '2 days'),
    ('recent-b', 'fam-ret', 'enf-b', 15, 'bonus', 'Coup de main', now() - interval '1 day');

  -- Les missions faites : une ancienne validée, une ancienne JAMAIS RELUE.
  insert into mission_completions
    (id, family_id, assignment_id, mission_id, child_id, status,
     minutes_requested, minutes_awarded, completed_at)
  values
    ('cmp-vieille', 'fam-ret', 'asg-a', 'mis-ret', 'enf-a', 'approved', 10, 10,
     now() - interval '200 days'),
    ('cmp-oubliee', 'fam-ret', 'asg-b', 'mis-ret', 'enf-b', 'pending', 10, 0,
     now() - interval '200 days');

  -- Les sessions : une ancienne terminée, une ancienne restée « en cours ».
  insert into screen_time_sessions
    (id, family_id, child_id, requested_minutes, started_at, ends_at, status)
  values
    ('ses-finie', 'fam-ret', 'enf-a', 20, now() - interval '200 days',
     now() - interval '200 days' + interval '20 minutes', 'finished'),
    ('ses-encours', 'fam-ret', 'enf-b', 20, now() - interval '200 days',
     now() - interval '200 days' + interval '20 minutes', 'running');
end $$;

-- ----------------------------------------------------- le solde, avant/après

create temp table soldes_avant as
  select child_id, sum(delta)::int as minutes
  from screen_time_transactions where family_id = 'fam-ret' group by child_id;

do $$
declare v_efface int;
begin
  v_efface := compact_ledger(90);
  perform assert(v_efface > 0, 'le repli a bien effacé quelque chose');
end $$;

do $$ begin
  -- `coalesce` des deux côtés : un enfant qui n'a plus aucune ligne a un solde
  -- de zéro, pas un solde absent — c'est ce que rend `balanceOf` côté
  -- application, et c'est le cas de Zoé ci-dessus.
  perform assert(
    not exists (
      select 1
      from soldes_avant a
      full join (
        select child_id, sum(delta)::int as minutes
        from screen_time_transactions where family_id = 'fam-ret' group by child_id
      ) b on b.child_id = a.child_id
      where coalesce(a.minutes, 0) <> coalesce(b.minutes, 0)
    ),
    'LE SOLDE EST LE MÊME, pour chaque enfant, après le repli');

  perform assert(
    (select count(*) from screen_time_transactions
     where child_id = 'enf-a' and kind = 'initial_balance') = 1,
    'une seule ligne d''ouverture, et une seule');

  perform assert(
    (select count(*) from screen_time_transactions where child_id = 'enf-c') = 0,
    'un enfant dont l''ancien s''annule ne reçoit pas de ligne à zéro');

  perform assert(
    exists (select 1 from screen_time_transactions where id = 'recent-a')
    and exists (select 1 from screen_time_transactions where id = 'recent-b'),
    'ce qui est dans la fenêtre n''est pas touché');

  perform assert(
    not exists (select 1 from screen_time_transactions where id = 'vieux-a-24'),
    'ce qui est hors fenêtre a bien disparu');
end $$;

-- ------------------------------------------------------------ deux passages

do $$
declare v_avant int; v_apres int;
begin
  select sum(delta)::int into v_avant from screen_time_transactions where family_id = 'fam-ret';
  perform compact_ledger(90);
  perform compact_ledger(90);
  select sum(delta)::int into v_apres from screen_time_transactions where family_id = 'fam-ret';

  perform assert(v_avant = v_apres, 'rejouer le repli ne change plus rien');
  perform assert(
    (select count(*) from screen_time_transactions
     where family_id = 'fam-ret' and kind = 'initial_balance') = 2,
    'une ligne d''ouverture par enfant, pas une par passage');
end $$;

-- ---------------------------------------------- le ménage ne réveille personne

/**
 * Celui-ci a été écrit après coup, parce que le défaut était déjà là.
 *
 * `mino_broadcast` émet un message par ligne écrite, suppressions comprises.
 * Le repli en efface des millions : sans porte, la purge de trois heures du
 * matin aurait envoyé des millions de messages et réveillé les appareils de
 * toutes les familles — pour leur annoncer que leur historique d'il y a un an
 * venait d'être rangé.
 */
do $$
declare v_avant bigint; v_apres bigint;
begin
  select count(*) into v_avant from realtime.messages;
  perform compact_ledger(90);
  perform purge_history(90);
  select count(*) into v_apres from realtime.messages;
  perform assert(v_avant = v_apres, 'le ménage n''envoie pas un seul message');

  -- Et la porte se referme : une écriture ordinaire diffuse toujours.
  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
  values ('apres-menage', 'fam-ret', 'enf-a', 5, 'bonus', 'Coup de main');
  perform assert(
    (select count(*) from realtime.messages) = v_apres + 1,
    'une écriture ordinaire, juste après, diffuse normalement');
end $$;

-- ------------------------------------------- ce qui attend quelqu'un reste

do $$ begin
  perform purge_history(90);

  perform assert(
    exists (select 1 from mission_completions where id = 'cmp-oubliee'),
    'une mission déclarée et jamais relue survit, même vieille de six mois');
  perform assert(
    not exists (select 1 from mission_completions where id = 'cmp-vieille'),
    'une mission validée il y a six mois, elle, s''efface');

  perform assert(
    exists (select 1 from screen_time_sessions where id = 'ses-encours'),
    'une session restée en cours survit');
  perform assert(
    not exists (select 1 from screen_time_sessions where id = 'ses-finie'),
    'une session terminée il y a six mois s''efface');
end $$;

-- ------------------------------------------------------- hors de portée

set session role authenticated;
set session "mino.uid" = '44444444-4444-4444-4444-444444444444';

do $$ begin
  perform assert(refuses('select compact_ledger(90)'),
    'un parent ne peut pas replier le grand livre');
  perform assert(refuses('select purge_history(90)'),
    'ni effacer l''historique');
  perform assert(
    refuses($sql$delete from screen_time_transactions where id = 'recent-a'$sql$)
    or exists (select 1 from screen_time_transactions where id = 'recent-a'),
    'ni supprimer une ligne du grand livre à la main');
end $$;

reset role;

do $$ begin
  delete from families where id = 'fam-ret';
  delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
end $$;
