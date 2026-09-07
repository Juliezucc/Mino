/**
 * Effacer TOUS les comptes et TOUTES les familles.
 *
 * ⚠️  À n'exécuter que sur un projet d'essai. Il n'y a pas de retour en
 *     arrière, pas de corbeille, et rien n'est conservé.
 *
 * Écrit parce que le ménage se refait souvent pendant la mise au point — on
 * arrive vite à court d'adresses e-mail — et qu'une suppression improvisée
 * laisse des restes : le jour où l'on recrée une famille, un vieux code famille
 * entre en collision, ou un abonnement fantôme accorde un accès qui n'a pas été
 * payé.
 *
 * DEUX LIGNES SUFFISENT, ET C'EST VÉRIFIÉ. Tout ce que Mino écrit pend soit de
 * `families`, soit de `auth.users`, par une cascade déclarée dans le schéma :
 *
 *   families  → parents, children, missions, mission_assignments,
 *               mission_completions, screen_time_transactions,
 *               screen_time_sessions, devices, free_windows, family_devices,
 *               companion_messages, referrals, subscriptions, billing_events,
 *               store_notifications, et companion_usage par children.
 *
 *   auth.users → parent_secrets, join_attempts, support_reports, et les
 *                sessions anonymes des appareils enfants.
 *
 * Seule `marketing_spend` reste, et c'est voulu : elle ne contient aucune
 * donnée de famille, seulement ce qu'on a dépensé en publicité.
 *
 * L'ordre compte : les familles d'abord. Supprimer les comptes ne supprime pas
 * les familles — la clé étrangère va de `parents` vers `families`, pas
 * l'inverse — et l'on se retrouverait avec des familles orphelines, invisibles
 * et indestructibles depuis l'application.
 *
 * À coller dans l'éditeur SQL de Supabase, d'un bloc.
 */

-- Avant : ce qu'on s'apprête à perdre.
select
  (select count(*) from families) as familles,
  (select count(*) from auth.users) as comptes,
  (select count(*) from children) as enfants;

delete from families;
delete from auth.users;

-- Après : tout doit être à zéro.
select
  (select count(*) from families) as familles,
  (select count(*) from auth.users) as comptes,
  (select count(*) from children) as enfants;
