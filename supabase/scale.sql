-- =====================================================================
-- Mino — passage à l'échelle
--
-- À appliquer APRÈS schema.sql. Ce fichier ne crée aucune donnée : il
-- corrige trois choses qui tiennent à cent familles et tombent à dix mille.
--
--   1. Le temps réel. `postgres_changes` fait vérifier CHAQUE écriture de la
--      base contre CHAQUE client connecté, un par un, dans un seul processus.
--      Le coût est le produit des deux : à 10 000 familles il ne s'agit plus
--      d'un serveur lent mais d'un serveur qui ne suit plus du tout. On passe
--      donc à `broadcast` : la base envoie sur un canal privé par famille,
--      et un message ne traverse que les appareils de cette famille-là.
--
--   2. Les index. Les politiques RLS filtrent sur `family_id` ; les index
--      existants portaient sur `child_id`. Tant que les tables sont petites
--      personne ne le voit ; à quelques millions de lignes, chaque ouverture
--      de l'application devient un parcours de table complet.
--
--   3. La rétention. `join_attempts` ne grossissait que dans un sens.
--
-- Appliquer avec :  supabase db push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- ------------------------------------------------------------ 1. index

-- Ce que lit vraiment l'application : « tout ce qui appartient à ma famille,
-- le plus récent d'abord ». C'est cet accès-là qu'il faut indexer, et c'est
-- celui qui manquait.
create index if not exists idx_transactions_family
  on screen_time_transactions (family_id, created_at desc);

create index if not exists idx_completions_family_recent
  on mission_completions (family_id, completed_at desc);

create index if not exists idx_sessions_family
  on screen_time_sessions (family_id, started_at desc);

-- Une session en cours est cherchée par famille, pas seulement par enfant :
-- c'est la question que pose l'écran parent toutes les secondes.
create index if not exists idx_sessions_family_running
  on screen_time_sessions (family_id) where status in ('running', 'requested');

-- Les affectations n'ont pas de family_id : elles se rejoignent par l'enfant,
-- et la jointure part de la mission aussi souvent que de l'enfant.
create index if not exists idx_assignments_mission
  on mission_assignments (mission_id);

-- Et par l'enfant, sans condition. `idx_assignments_child` ne couvre que les
-- affectations actives ; la politique, elle, ne parle pas d'« active » — un
-- index partiel ne pouvait donc pas la servir.
create index if not exists idx_assignments_child_all
  on mission_assignments (child_id);

/**
 * La même leçon, deux fois de plus.
 *
 * Un index partiel ne sert une requête que si celle-ci répète sa condition.
 * `idx_missions_family` est posé `where archived = false` ; l'application, elle,
 * demande toutes les missions de sa famille, archivées comprises, et se
 * retrouvait donc à parcourir les cinquante mille missions de la plateforme —
 * 6 ms mesurées à 10 000 familles, soit le tiers d'une ouverture.
 *
 * `parents` n'avait aucun index sur `family_id` : seulement dix mille lignes,
 * mais lues à chaque ouverture, et le parcours coûtait plus que la lecture.
 */
create index if not exists idx_missions_family_all on missions (family_id);
create index if not exists idx_parents_family      on parents (family_id);

-- Les deux entrées du parrainage. `code` est cherché à chaque saisie.
create index if not exists idx_referrals_code on referrals (code);

-- ---------------------------------------------------- 2. temps réel

-- On sort les tables de la publication `postgres_changes`. Rien ne les
-- écoutait de façon sûre, et les y laisser signifie payer le coût du
-- mécanisme qu'on abandonne.
do $$
declare t text;
begin
  foreach t in array array[
    'mission_completions',
    'screen_time_transactions',
    'missions',
    'mission_assignments',
    'children',
    'screen_time_sessions'
  ] loop
    begin
      execute format('alter publication supabase_realtime drop table %I', t);
    exception when others then null; -- déjà retirée
    end;
  end loop;
end $$;

/**
 * Qui a le droit d'écouter le canal d'une famille.
 *
 * Un canal privé s'autorise par RLS sur `realtime.messages`, exactement comme
 * une table. Le nom du canal est `famille:<id>` : on en extrait l'identifiant
 * et on le passe par `auth_family_ids()`, la même fonction qui garde tout le
 * reste. Une famille ne peut donc pas s'abonner au canal d'une autre, même en
 * devinant son identifiant.
 */
drop policy if exists mino_family_channel_read on realtime.messages;
create policy mino_family_channel_read on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'famille:%'
    and substring(realtime.topic() from 9) = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

-- Aucune politique d'insertion : seule la base émet sur ces canaux, via le
-- déclencheur ci-dessous. Un appareil qui pourrait écrire sur le canal de sa
-- famille pourrait faire croire à une validation qui n'a pas eu lieu.
drop policy if exists mino_family_channel_write on realtime.messages;

/**
 * Le signal, et rien de plus.
 *
 * Le message ne transporte pas la ligne modifiée, seulement le nom de la table.
 * Deux raisons : rien de sensible ne transite par le canal, et une validation
 * de mission ne coûte que quelques dizaines d'octets au lieu d'une ligne
 * complète multipliée par le nombre d'appareils connectés.
 */
create or replace function mino_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_family text;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if tg_table_name = 'mission_assignments' then
    select c.family_id into v_family
    from children c
    where c.id = (to_jsonb(v_row) ->> 'child_id');
  else
    -- Passer par jsonb plutôt que par v_row.family_id : la même fonction sert
    -- six tables, et une seule d'entre elles n'a pas la colonne.
    v_family := to_jsonb(v_row) ->> 'family_id';
  end if;

  if v_family is null then
    return v_row;
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', lower(tg_op)),
    'change',
    'famille:' || v_family,
    true  -- canal privé : soumis à la politique ci-dessus
  );

  return v_row;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'children',
    'missions',
    'mission_assignments',
    'mission_completions',
    'screen_time_transactions',
    'screen_time_sessions',
    'devices'
  ] loop
    execute format('drop trigger if exists mino_broadcast on %I', t);
    execute format(
      'create trigger mino_broadcast after insert or update or delete on %I
         for each row execute function mino_broadcast_change()', t);
  end loop;
end $$;

-- --------------------------------------------------------- 3. rétention

/**
 * Les tentatives de rattachement ratées n'ont d'intérêt qu'une heure — c'est la
 * fenêtre que regarde `join_family`. Au-delà, ce n'est plus une protection,
 * c'est une table qui grossit.
 */
create or replace function purge_join_attempts()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from join_attempts where attempted_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function purge_join_attempts() from public, anon, authenticated;

/**
 * Les comptes anonymes orphelins.
 *
 * Chaque appareil enfant qui se rattache à une famille crée un utilisateur
 * anonyme. Une réinstallation en crée un deuxième, et le premier reste — sans
 * famille, sans usage, mais compté comme utilisateur actif et facturé comme
 * tel. À dix mille familles, ce sont des milliers de comptes fantômes par an.
 *
 * Ne sont supprimés que les comptes anonymes qui n'ont jamais rejoint de
 * famille et qui ont plus de trente jours. Un appareil enfant réellement
 * rattaché a une ligne dans `family_devices` et n'est jamais touché.
 */
create or replace function purge_orphan_devices()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from auth.users u
    where u.is_anonymous is true
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from family_devices d where d.user_id = u.id)
    returning 1
  )
  select count(*)::int from gone;
$$;

-- Celle-ci supprime des comptes : elle n'appartient qu'au planificateur.
revoke all on function purge_orphan_devices() from public, anon, authenticated;

-- Planifier avec pg_cron (extension à activer dans le tableau de bord) :
--
--   select cron.schedule('mino-purge-join-attempts', '0 4 * * *',
--                        $$select purge_join_attempts()$$);
--   select cron.schedule('mino-purge-orphan-devices', '30 4 * * *',
--                        $$select purge_orphan_devices()$$);
--
-- Laissé en commentaire volontairement : pg_cron s'active par projet, et une
-- planification créée deux fois s'exécute deux fois.

-- ------------------------------------------- 4. le solde sans tout l'historique

/**
 * Le solde d'un enfant, calculé par la base.
 *
 * L'application borne l'historique qu'elle télécharge — sans quoi une famille
 * de trois ans d'ancienneté rapatrie dix mille lignes à chaque ouverture. Mais
 * le solde, lui, doit rester exact : il est ici la somme du grand livre entier,
 * et l'application reconstitue la différence en une seule ligne d'ouverture.
 *
 * La règle du projet ne bouge pas d'un pouce : le solde reste une somme de
 * transactions, jamais un compteur que l'on modifie.
 */
create or replace function family_balances()
returns table (child_id text, minutes int)
language sql
stable
security definer
set search_path = public
as $$
  select t.child_id, coalesce(sum(t.delta), 0)::int
  from screen_time_transactions t
  where t.family_id in (select auth_family_ids())
  group by t.child_id;
$$;

revoke all on function family_balances() from public;
grant execute on function family_balances() to authenticated;
