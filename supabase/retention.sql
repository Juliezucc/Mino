-- =====================================================================
-- Mino — ce qu'on garde, et pendant combien de temps
--
-- À appliquer APRÈS schema.sql. Ce fichier ne crée aucune donnée : il en
-- efface, et c'est tout son sujet.
--
-- Jusqu'ici la base gardait tout, pour toujours. Trois raisons de ne plus le
-- faire, dans l'ordre d'importance :
--
--   1. La règle du produit. « Ne collecter aucune donnée enfant inutile. »
--      Trois ans de « Léa a rangé sa chambre le 12 mars » forment exactement
--      le dossier que Mino promet de ne pas constituer. Aucun écran ne les
--      affiche : le tableau de bord montre six lignes, la fiche d'un enfant
--      trente, son profil douze. Au-delà d'un trimestre, personne ne regarde
--      jamais rien.
--
--   2. Le RGPD, qui dit la même chose en droit : on ne conserve pas au-delà
--      de ce qui sert.
--
--   3. Le coût, qui vient loin derrière mais qui suit : le grand livre d'une
--      famille cesse de grandir, et avec lui la seule requête dont le prix
--      grandissait avec l'ancienneté (`family_balances()`).
--
-- LE SOLDE NE BOUGE PAS D'UNE MINUTE. C'est la seule chose qui ne se négocie
-- pas ici. La règle du projet — le solde est une somme de transactions, jamais
-- un compteur qu'on modifie — reste entière : on ne modifie aucune ligne, on
-- remplace un paquet de lignes par **leur somme exacte**, écrite comme une
-- transaction de plus. Après passage, `sum(delta)` rend le même nombre
-- qu'avant, pour chaque enfant. C'est vérifié à chaque `npm run test:sql`, et
-- c'est exactement ce que l'application fait déjà de son côté quand elle ne
-- télécharge que 90 jours (`withOpeningBalances`).
--
-- Appliquer avec :  npm run db:push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- --------------------------------------------------------- la fenêtre

/**
 * Combien de jours de détail on garde.
 *
 * Un trimestre : de quoi revenir de vacances et voir ce qui s'est passé, de
 * quoi répondre à « et le mois dernier ? », et rien de plus. Descendre à 30
 * ou à 7 ne demande que de changer ce nombre — le reste du fichier suit, et
 * `HISTORY_DAYS` côté application doit alors suivre aussi
 * (`src/data/supabaseRepository.ts`).
 */
create or replace function mino_history_days()
returns integer
language sql
immutable
as $$ select 90 $$;

-- --------------------------------------------- replier le grand livre

/**
 * Le détail ancien, replié en une ligne par enfant.
 *
 * Pour chaque enfant ayant des lignes antérieures à la fenêtre : on en fait la
 * somme, on les supprime, et on écrit cette somme comme une seule transaction
 * datée juste avant la fenêtre. Le solde est inchangé par construction — c'est
 * une somme partielle remplacée par sa valeur.
 *
 * La ligne d'ouverture est elle-même antérieure à la fenêtre : au passage
 * suivant elle sera repliée dans la nouvelle, avec ce qui aura vieilli entre
 * temps. La fonction se rattrape donc toute seule, et deux exécutions de suite
 * donnent le même résultat qu'une.
 *
 * Rend le nombre de lignes effacées.
 */
create or replace function compact_ledger(p_days integer default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut     timestamptz := now() - make_interval(days => coalesce(p_days, mino_history_days()));
  v_efface  integer := 0;
begin
  -- Silence : ce ménage efface des lignes par millions, et le déclencheur de
  -- diffusion émettrait un message pour chacune. Voir `mino_broadcast_change()`
  -- dans `scale.sql`. `true` = valable pour cette transaction seulement.
  perform set_config('mino.silence', 'on', true);

  -- Trois temps, et pas un seul : effacer et réécrire la même clé dans une
  -- seule instruction fait travailler les deux moitiés sur le même instantané,
  -- et la ligne d'ouverture du passage précédent entrerait en collision avec
  -- celle qu'on écrit. Séparées, les étapes se lisent et se prouvent.
  create temp table pg_temp.mino_repli on commit drop as
    select family_id, child_id, sum(delta)::int as total, count(*)::int as lignes
    from screen_time_transactions
    where created_at < v_cut
    group by family_id, child_id;

  -- La ligne d'ouverture écrite au passage précédent est datée d'avant sa
  -- propre fenêtre : elle part avec le reste, et son montant est déjà compté
  -- dans la somme ci-dessus. C'est ce qui rend la fonction rejouable.
  delete from screen_time_transactions where created_at < v_cut;

  insert into screen_time_transactions
    (id, family_id, child_id, delta, kind, reason, created_at)
  select
    'opening_' || r.child_id || '_' || to_char(v_cut, 'YYYYMMDD'),
    r.family_id, r.child_id, r.total, 'initial_balance',
    'Minutes gagnées avant cette période',
    v_cut - interval '1 second'
  from pg_temp.mino_repli r
  -- Un enfant dont tout l'ancien s'annule à zéro n'a pas besoin de ligne.
  where r.total <> 0;

  select coalesce(sum(lignes), 0)::int into v_efface from pg_temp.mino_repli;
  drop table pg_temp.mino_repli;

  -- On rend la parole : la fonction ne fait taire que son propre ménage, pas
  -- ce que la transaction ferait ensuite.
  perform set_config('mino.silence', 'off', true);
  return v_efface;
end;
$$;

-- Elle efface des lignes du grand livre : elle n'appartient qu'au
-- planificateur. `revoke from public` ne suffit pas — Supabase accorde
-- l'exécution à `anon` et `authenticated` par privilège par défaut.
revoke all on function compact_ledger(integer) from public, anon, authenticated;

-- ------------------------------------------------ effacer le reste

/**
 * Les missions faites et les sessions terminées, passé la fenêtre.
 *
 * Deux exceptions, et elles sont vitales :
 *
 *   — une mission déclarée que personne n'a relue reste, quel que soit son
 *     âge. C'est la seule ligne qui attend quelqu'un, et l'application refuse
 *     déjà de la tronquer au téléchargement ; l'effacer ici reviendrait à
 *     répondre « non » à la place du parent, quatre mois plus tard.
 *
 *   — une session en cours ou demandée reste, pour la même raison.
 *
 * Rend le nombre de lignes effacées, les deux tables confondues.
 */
create or replace function purge_history(p_days integer default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut    timestamptz := now() - make_interval(days => coalesce(p_days, mino_history_days()));
  v_total  integer := 0;
  v_lot    integer;
begin
  perform set_config('mino.silence', 'on', true);

  with gone as (
    delete from mission_completions c
    where c.completed_at < v_cut and c.status <> 'pending'
    returning 1
  )
  select count(*)::int into v_lot from gone;
  v_total := v_total + v_lot;

  with gone as (
    delete from screen_time_sessions s
    where s.started_at < v_cut and s.status not in ('running', 'requested')
    returning 1
  )
  select count(*)::int into v_lot from gone;
  v_total := v_total + v_lot;

  perform set_config('mino.silence', 'off', true);
  return v_total;
end;
$$;

revoke all on function purge_history(integer) from public, anon, authenticated;

-- Planifier avec pg_cron (extension à activer dans le tableau de bord) :
--
--   select cron.schedule('mino-compact-ledger', '0 3 * * *',
--                        $$select compact_ledger()$$);
--   select cron.schedule('mino-purge-history', '15 3 * * *',
--                        $$select purge_history()$$);
--
-- Dans cet ordre et à quinze minutes d'intervalle : le repli du grand livre
-- doit avoir eu lieu avant qu'on efface les missions auxquelles ses lignes
-- faisaient référence. Laissé en commentaire volontairement — pg_cron s'active
-- par projet, et une planification créée deux fois s'exécute deux fois.
--
-- LE PREMIER PASSAGE N'EST PAS COMME LES AUTRES. Chaque nuit, le repli ne
-- touche qu'une journée de retard — quelques dizaines de milliers de lignes,
-- l'affaire de secondes. Mais le tout premier, sur une base qui a déjà des
-- années derrière elle, efface tout d'un coup, dans une seule transaction.
--
-- Le remède est simple et ne demande aucun code : y aller par fenêtres
-- décroissantes, chacune dans son propre appel.
--
--   select compact_ledger(365);   -- d'abord tout ce qui a plus d'un an
--   select compact_ledger(180);
--   select compact_ledger(90);    -- puis le régime normal
--
-- Chaque appel est court, et le suivant repart de ce que le précédent a laissé.
