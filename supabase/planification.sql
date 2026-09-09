-- =====================================================================
-- Mino — les tâches de nuit
--
-- À coller dans l'éditeur SQL de Supabase, une fois, sur le projet de
-- production. **Ce fichier ne fait pas partie de `tout.sql`** : le schéma
-- décrit ce que la base EST, celui-ci décide de ce qu'elle FAIT toutes les
-- nuits, et c'est un acte d'exploitation, pas une définition.
--
-- ---------------------------------------------------------------------
-- Pourquoi ce fichier existe
--
-- Les cinq fonctions ci-dessous étaient écrites, testées, et n'ont jamais
-- tourné : leur planification était laissée en commentaire dans le schéma, par
-- prudence — pg_cron s'active par projet, et une planification créée deux fois
-- s'exécute deux fois.
--
-- La prudence a coûté plus cher que le risque. La politique de confidentialité
-- publiée annonce que **les conversations d'un enfant avec Mino sont effacées
-- au bout de trente jours**. La fonction qui les efface existe
-- (`purge_companion_messages`), et rien ne l'appelait. Une durée de
-- conservation annoncée et non appliquée, sur des données d'enfants, est la
-- chose la plus exposée qu'un produit comme celui-ci puisse laisser traîner.
--
-- Le fichier est **rejouable** : chaque tâche est déprogrammée avant d'être
-- reprogrammée. Le collant deux fois, on obtient cinq tâches, pas dix.
--
-- ---------------------------------------------------------------------
-- Les heures, et pourquoi celles-là
--
-- pg_cron raisonne en **UTC**. 3 h UTC, c'est 4 ou 5 h à Paris selon la
-- saison : la nuit dans tous les cas, et le creux d'usage d'une application
-- familiale.
--
-- L'ordre compte sur les deux premières : le repli du grand livre doit avoir
-- eu lieu AVANT qu'on efface les missions auxquelles ses lignes font
-- référence. D'où le quart d'heure entre les deux.
-- =====================================================================

create extension if not exists pg_cron;

-- Déprogrammer d'abord, sans échouer si rien n'existe.
do $$
declare j record;
begin
  for j in
    select jobid from cron.job
    where jobname in (
      'mino-compact-ledger',
      'mino-purge-history',
      'mino-purge-join-attempts',
      'mino-purge-orphan-devices',
      'mino-purge-companion'
    )
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 03:00 — replier le grand livre.
select cron.schedule('mino-compact-ledger', '0 3 * * *',
                     $$select compact_ledger()$$);

-- 03:15 — effacer l'historique au-delà de la durée annoncée.
select cron.schedule('mino-purge-history', '15 3 * * *',
                     $$select purge_history()$$);

-- 04:00 — les tentatives de rattachement, qui ne servent qu'à limiter les essais.
select cron.schedule('mino-purge-join-attempts', '0 4 * * *',
                     $$select purge_join_attempts()$$);

-- 04:30 — les comptes anonymes d'appareils qui n'ont jamais rejoint de famille.
select cron.schedule('mino-purge-orphan-devices', '30 4 * * *',
                     $$select purge_orphan_devices()$$);

-- 04:45 — les conversations avec Mino, trente jours, comme la politique le dit.
select cron.schedule('mino-purge-companion', '45 4 * * *',
                     $$select purge_companion_messages()$$);

-- ---------------------------------------------------------------------
-- Vérifier, après avoir collé
--
--   select jobname, schedule, active from cron.job order by jobname;
--
-- Cinq lignes, toutes `active`. Puis, le lendemain :
--
--   select jobname, status, start_time, return_message
--   from cron.job_run_details
--   order by start_time desc limit 20;
--
-- Une tâche qui échoue le fait en silence : personne n'est prévenu, et la
-- politique de confidentialité continue d'annoncer un effacement qui n'a pas
-- lieu. Cette requête-là mérite d'être regardée une fois par mois.
--
-- ---------------------------------------------------------------------
-- LE PREMIER PASSAGE DE `purge_history` N'EST PAS COMME LES AUTRES
--
-- Chaque nuit, il ne rattrape qu'une journée. Le tout premier, sur une base
-- qui a déjà des années derrière elle, efface tout d'un coup dans une seule
-- transaction. Voir l'avertissement détaillé de `retention.sql`.
--
-- Sur la base de Mino en septembre 2026, la question ne se pose pas : elle
-- vient d'être vidée de tout sauf de la famille de démonstration. Elle se
-- posera le jour où l'on activera ces tâches sur une base ancienne.
-- =====================================================================
