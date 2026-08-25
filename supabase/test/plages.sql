/**
 * Les plages libres, et la frontière qui les rend acceptables.
 *
 * Une plage libre est du temps d'écran gratuit. C'est exactement pour cela
 * qu'elle est utile — le mercredi après-midi, les vacances — et exactement
 * pour cela qu'elle est dangereuse : laisser l'appareil d'un enfant en écrire
 * une reviendrait à lui laisser s'accorder l'accès permanent en une ligne,
 * « tous les jours de 00 h 00 à 23 h 59 », et le produit entier cesserait de
 * vouloir dire quelque chose.
 *
 * L'enfant doit donc LIRE et jamais ÉCRIRE. C'est la même frontière que pour
 * les missions, et le premier test ci-dessous est le seul qui compte vraiment.
 *
 * Le reste tient les bords : ce que la base refuse d'enregistrer, pour que la
 * règle ne dépende pas du seul écran de saisie. Une règle qui n'existe que
 * dans le client n'est pas une règle.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Plages libres : lire oui, écrire non'

do $$ begin
  delete from families where id in ('fam-plage', 'fam-tiers');
  delete from auth.users where id in (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000003');

  insert into auth.users (id, email, is_anonymous) values
    ('bbbbbbbb-0000-0000-0000-000000000001', 'plage@mino.app', false),
    ('bbbbbbbb-0000-0000-0000-000000000002', null, true),
    ('bbbbbbbb-0000-0000-0000-000000000003', 'tiers@mino.app', false);
  insert into families (id, name, code, referral_code) values
    ('fam-plage', 'Leroy', 'PLAGE01', 'PARRAINP'),
    ('fam-tiers', 'Inconnu', 'PLAGE02', 'PARRAINT');
  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-plage', 'fam-plage', 'bbbbbbbb-0000-0000-0000-000000000001', 'Fanny', 'plage@mino.app'),
    ('par-tiers', 'fam-tiers', 'bbbbbbbb-0000-0000-0000-000000000003', 'Autre', 'tiers@mino.app');
  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-plage', 'fam-plage', 'Timéo', 9, 'renard');
  insert into family_devices (id, family_id, user_id) values
    ('dev-plage', 'fam-plage', 'bbbbbbbb-0000-0000-0000-000000000002');
end $$;

-- ------------------------------------------------------ le parent écrit

do $$ begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000001';

  insert into free_windows (id, family_id, label, days, start_minute, end_minute)
  values ('fw-merc', 'fam-plage', 'Mercredi après-midi', array[3]::smallint[], 840, 960);

  perform assert(
    (select count(*) from free_windows where family_id = 'fam-plage') = 1,
    'un parent ouvre une plage pour sa famille');
end $$;

-- --------------------------------------------- l'enfant lit, et rien de plus

do $$ begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000002';

  -- La lecture est nécessaire : c'est ainsi que la tablette sait que l'écran
  -- est ouvert, et qu'elle évite de faire dépenser des minutes pour un temps
  -- déjà acquis.
  perform assert(
    (select count(*) from free_windows where id = 'fw-merc') = 1,
    'l''appareil de l''enfant voit la plage que son parent a ouverte');
end $$;

do $$
declare v_refuse boolean := false;
begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000002';

  begin
    insert into free_windows (id, family_id, label, days, start_minute, end_minute)
    values ('fw-triche', 'fam-plage', 'Toujours', array[0,1,2,3,4,5,6]::smallint[], 0, 1439);
  exception when others then
    v_refuse := true;
  end;

  -- LE TEST QUI COMPTE. Sans cette frontière, un enfant s'accorde l'accès
  -- permanent en une ligne, et Mino ne veut plus rien dire.
  perform assert(v_refuse, 'UN ENFANT NE S''OUVRE PAS SA PROPRE PLAGE LIBRE');
end $$;

do $$
declare v_touchees int;
begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000002';

  -- Ni en élargissant celle du parent. Une politique manquante ne lève pas
  -- d'erreur sur un UPDATE : elle n'atteint simplement aucune ligne. Il faut
  -- donc compter, pas attendre une exception.
  update free_windows set end_minute = 1439 where id = 'fw-merc';
  get diagnostics v_touchees = row_count;

  perform assert(v_touchees = 0, 'ni en repoussant l''heure de fin de celle du parent');
end $$;

do $$
declare v_touchees int;
begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000002';

  delete from free_windows where id = 'fw-merc';
  get diagnostics v_touchees = row_count;

  perform assert(v_touchees = 0, 'ni en la supprimant');
end $$;

-- ----------------------------------------------- la famille d'à côté

do $$ begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000003';

  perform assert(
    (select count(*) from free_windows where id = 'fw-merc') = 0,
    'une autre famille ne voit pas les plages de celle-ci');
end $$;

-- ------------------------------------ ce que la base refuse d'enregistrer

do $$
declare v_refuse boolean;
begin
  set local role authenticated;
  set local mino.uid = 'bbbbbbbb-0000-0000-0000-000000000001';

  -- Traverser minuit : 22 h → 7 h n'est pas une permission, c'est un
  -- couvre-feu, et un couvre-feu est la fonctionnalité inverse.
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, days, start_minute, end_minute)
    values ('fw-nuit', 'fam-plage', 'La nuit', array[5]::smallint[], 1320, 420);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'une plage ne traverse pas minuit');

  -- Ni jours ni date : elle ne s'ouvrirait jamais.
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, days, start_minute, end_minute)
    values ('fw-vide', 'fam-plage', 'Jamais', '{}'::smallint[], 600, 700);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'une plage sans jour ni date est refusée');

  -- Jours ET date : le parent ne saurait plus laquelle des deux s'applique.
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, days, on_date, start_minute, end_minute)
    values ('fw-deux', 'fam-plage', 'Les deux', array[3]::smallint[], current_date, 600, 700);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'une plage n''est pas à la fois répétée et ponctuelle');

  -- Une liste d'enfants vide n'ouvre à personne : c'est `null` qu'il faut
  -- écrire pour dire « toute la fratrie ».
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, child_ids, days, start_minute, end_minute)
    values ('fw-personne', 'fam-plage', 'Personne', '{}'::text[], array[3]::smallint[], 600, 700);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'une liste d''enfants vide est refusée');

  -- Un jour de semaine qui n'existe pas.
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, days, start_minute, end_minute)
    values ('fw-jour9', 'fam-plage', 'Jour 9', array[9]::smallint[], 600, 700);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'un jour de semaine hors de 0-6 est refusé');

  -- Un nom vide : une liste de réglages sans noms ne se relit pas.
  v_refuse := false;
  begin
    insert into free_windows (id, family_id, label, days, start_minute, end_minute)
    values ('fw-anonyme', 'fam-plage', '   ', array[3]::smallint[], 600, 700);
  exception when check_violation then v_refuse := true; end;
  perform assert(v_refuse, 'une plage sans nom est refusée');
end $$;

-- ------------------------------------------------ la plage suit sa famille

do $$ begin
  delete from families where id = 'fam-plage';

  perform assert(
    not exists (select 1 from free_windows where id = 'fw-merc'),
    'supprimer la famille emporte ses plages');

  delete from families where id = 'fam-tiers';
  delete from auth.users where id in (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000003');
end $$;
