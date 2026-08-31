/**
 * Créer une famille : la première écriture de toutes, et la seule qui parte
 * de rien.
 *
 * Elle n'avait aucun test, et elle n'a jamais fonctionné une seule fois contre
 * Supabase. Le dépôt écrivait toutes ses tables avec `upsert`, ce qui produit
 * un `INSERT ... ON CONFLICT DO UPDATE` — et PostgreSQL applique alors à la
 * ligne NEUVE la clause de la politique de MISE À JOUR, laquelle exige partout
 * d'appartenir déjà à la famille. Une famille qu'on vient d'inventer
 * n'appartient à personne. La base répondait « new row violates row-level
 * security policy for table "families" », un parent lisait cela au bout de
 * cinq écrans, et rien ne pouvait le débloquer.
 *
 * Ce que ce fichier fixe, et qui ne se devine dans aucune relecture :
 *
 *   - l'insertion simple passe là où la fusion échoue — la différence est
 *     entière, et c'est elle qu'il faut protéger ;
 *   - l'ordre est contraint par la RLS elle-même, pas seulement par les clés
 *     étrangères : `parents` doit être écrite AVANT tout ce qui exige
 *     d'appartenir à la famille, puisque c'est cette ligne-là qui rattache le
 *     compte.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Créer une famille : la première écriture, celle qui part de rien'

do $$ begin
  delete from families where id = 'fam-neuve';
  delete from auth.users where id = 'dddddddd-0000-0000-0000-000000000001';

  insert into auth.users (id, email, is_anonymous)
  values ('dddddddd-0000-0000-0000-000000000001', 'neuve@mino.app', false);
end $$;

-- ------------------------------------------------- la fusion ne peut pas passer

do $$ begin
  set local role authenticated;
  set local mino.uid = 'dddddddd-0000-0000-0000-000000000001';

  /**
   * Le cœur de l'affaire. `families_insert` dit pourtant `with check (true)` :
   * lue seule, elle autorise tout. Mais la fusion convoque aussi
   * `families_update`, dont la clause — faute d'un `with check` explicite,
   * c'est son `using` qui en tient lieu — exige `id = any(mes familles)`.
   * Zéro famille, donc refus.
   */
  perform assert(
    refuses($q$insert into families (id, name, code, referral_code)
              values ('fam-neuve', 'Zucherman', 'NEUVE01', 'PARRNEUV')
              on conflict (id) do update set name = excluded.name$q$),
    'fusionner une famille neuve est refusé — c''est là que tout se cassait');
end $$;

-- --------------------------------------------------- l'insertion simple passe

do $$ begin
  set local role authenticated;
  set local mino.uid = 'dddddddd-0000-0000-0000-000000000001';

  insert into families (id, name, code, referral_code)
  values ('fam-neuve', 'Zucherman', 'NEUVE01', 'PARRNEUV');

  perform assert(true, 'insérer la même famille passe');

  -- Et pourtant elle ne la voit pas encore : aucune ligne ne l'y rattache.
  -- C'est exactement pour cela que `parents` doit partir seule, et ensuite.
  perform assert(
    (select count(*) from families) = 0,
    'sans ligne parent, la famille créée reste invisible à son créateur');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'dddddddd-0000-0000-0000-000000000001';

  insert into parents (id, family_id, display_name, email, consent_at)
  values ('par-neuve', 'fam-neuve', 'Lynda', 'neuve@mino.app', now());

  perform assert(
    (select count(*) from families where id = 'fam-neuve') = 1,
    'la ligne parent écrite, la famille devient visible');
end $$;

-- ------------------------------------- et seulement alors, ce qui en dépend

do $$ begin
  set local role authenticated;
  set local mino.uid = 'dddddddd-0000-0000-0000-000000000001';

  insert into children (id, family_id, first_name, age, avatar_key)
  values ('enf-neuve', 'fam-neuve', 'Jules', 7, 'fox');

  insert into missions (id, family_id, title, icon, minutes, created_by)
  values ('mis-neuve', 'fam-neuve', 'Ranger sa chambre', '🧸', 15, 'par-neuve');

  insert into mission_assignments (id, mission_id, child_id)
  values ('aff-neuve', 'mis-neuve', 'enf-neuve');

  insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
  values ('tr-neuve', 'fam-neuve', 'enf-neuve', 15, 'mission_reward', 'Ranger sa chambre');

  perform assert(
    (select count(*) from children) = 1
      and (select count(*) from missions) = 1
      and (select count(*) from mission_assignments) = 1,
    'enfant, mission et affectation s''écrivent une fois le parent en place');

  perform assert(
    (select coalesce(sum(delta), 0) from screen_time_transactions
      where child_id = 'enf-neuve') = 15,
    'et les quinze premières minutes sont au grand livre');
end $$;

-- --------------------------------------- la fusion redevient possible ensuite

do $$ begin
  set local role authenticated;
  set local mino.uid = 'dddddddd-0000-0000-0000-000000000001';

  /**
   * Une fois le compte rattaché, `upsert` refonctionne — et le dépôt s'en sert
   * pour toutes les écritures suivantes, qui doivent pouvoir corriger une
   * ligne existante sans savoir si elle existe. Ce n'est donc que la PREMIÈRE
   * écriture qui devait changer de manière, pas toutes.
   */
  insert into children (id, family_id, first_name, age, avatar_key)
  values ('enf-neuve', 'fam-neuve', 'Jules', 8, 'fox')
  on conflict (id) do update set age = excluded.age;

  perform assert(
    (select age from children where id = 'enf-neuve') = 8,
    'la fusion redevient possible une fois le compte rattaché');
end $$;

do $$ begin
  delete from families where id = 'fam-neuve';
  delete from auth.users where id = 'dddddddd-0000-0000-0000-000000000001';
end $$;
