-- =====================================================================
-- Mino — signalements
--
-- À appliquer APRÈS schema.sql.
--
-- Un seul endroit où arrivent les problèmes. Un bug remonté par e-mail, un
-- autre par un avis sur la boutique et un troisième par message privé, ce sont
-- trois endroits à consulter et trois occasions d'en perdre un.
-- =====================================================================

create table if not exists support_reports (
  id          bigserial primary key,
  -- Renseigné par la base, jamais par le client : un rapport ne doit pas
  -- pouvoir se faire passer pour celui d'une autre famille.
  --
  -- **`not null` ET `on delete set null` sur la même colonne, c'est une
  -- suppression de compte impossible**, et ça l'a été jusqu'au 16 septembre
  -- 2026. `delete_my_account()` finit par `delete from auth.users` ; Postgres
  -- déclenche alors `update support_reports set user_id = null`, qui viole la
  -- contrainte, lève 23502, et annule TOUTE la transaction — y compris
  -- l'effacement de la famille et des profils d'enfants déjà faits juste
  -- avant. Le parent lisait « La suppression n'a pas abouti. Rien n'a été
  -- effacé. », et c'était exact.
  --
  -- La population touchée n'était pas « les parents qui ont écrit au
  -- support » : `ExpoIapStore.ts` envoie un rapport `crash` à CHAQUE achat
  -- refusé par la boutique, et `ErrorBoundary.tsx` à chaque plantage. Un
  -- premier paiement refusé suffisait à rendre le compte indestructible.
  --
  -- `set null` plutôt que `cascade`, et c'est la politique publiée qui
  -- tranche : elle promet qu'après suppression « le lien est rompu et il ne
  -- subsiste qu'un texte anonyme ». Effacer le rapport rendrait cette phrase
  -- fausse à son tour ; le détacher la tient. La colonne doit donc accepter
  -- `null`, et la valeur par défaut continue de la remplir à l'insertion.
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  kind        text not null check (kind in ('manual', 'crash')),
  -- Déjà nettoyé côté application (voir src/domain/diagnostics.ts) : ni prénom
  -- d'enfant, ni adresse, ni code.
  message     text not null default '',
  stack       text,
  -- Regroupe les occurrences d'un même problème.
  fingerprint text not null,
  app_version text not null,
  platform    text not null,
  os_version  text,
  route       text,
  repository  text,
  -- Des compteurs (« trois enfants, douze missions »), jamais des contenus.
  counts      jsonb,
  status      text not null default 'nouveau'
              check (status in ('nouveau', 'en cours', 'corrige', 'sans suite')),
  created_at  timestamptz not null default now()
);

/**
 * L'adresse à laquelle répondre — et il n'y en avait aucune.
 *
 * **Le défaut, et c'est celui qui rendait tout le reste inutile.** Un parent
 * bloqué écrivait, recevait une référence, et attendait. Rien ne pouvait lui
 * revenir : la table ne garde que `user_id`, et `buildReport` EFFACE les
 * adresses du message — la ligne `EMAIL` de `src/domain/diagnostics.ts` est là
 * pour protéger la vie privée, et elle protégeait aussi le parent de toute
 * réponse. Depuis la tablette d'un enfant, l'identité est anonyme : il n'y
 * avait même pas de jointure possible.
 *
 * Séparée du message, donc, et jamais nettoyée : c'est le seul champ de cette
 * table que le parent donne POUR qu'on s'en serve. Facultatif — on répond si
 * on peut, on ne refuse pas un signalement anonyme.
 */
alter table support_reports add column if not exists reply_to text;

create index if not exists idx_reports_fingerprint on support_reports (fingerprint, created_at desc);
create index if not exists idx_reports_status on support_reports (status, created_at desc);
create index if not exists idx_reports_user on support_reports (user_id, created_at desc);

alter table support_reports enable row level security;

-- Écrire, oui, chacun pour soi. Un appareil enfant en a le droit aussi : c'est
-- souvent lui qui plante, et lui refuser la parole reviendrait à ne jamais
-- entendre parler des bugs du côté enfant.
drop policy if exists support_reports_insert on support_reports;
create policy support_reports_insert on support_reports
  for insert to authenticated
  with check (user_id = auth.uid());

-- Relire ses propres signalements, pour en suivre l'état.
drop policy if exists support_reports_select on support_reports;
create policy support_reports_select on support_reports
  for select to authenticated
  using (user_id = auth.uid());

-- Ni modification ni suppression : aucune politique n'est déclarée, donc tout
-- est refusé. Un signalement qu'un utilisateur peut réécrire après coup ne vaut
-- rien comme trace.

-- ------------------------------------------------------------ la file d'attente

/**
 * Ce qu'il faut regarder le matin.
 *
 * Un groupe, pas un ticket : cent parents touchés par le même plantage font une
 * ligne « 100 fois », ce qui dit lequel corriger en premier. Réservé au rôle de
 * service — c'est un tableau de bord interne, pas une donnée de famille.
 */
-- Supprimée puis recréée, et non « or replace » : PostgreSQL refuse de
-- remplacer une vue dont la liste de colonnes change ailleurs qu'à la fin, et
-- `repondre_a` s'insère avant `statut`. Une vue interne se reconstruit sans
-- rien perdre.
drop view if exists support_queue;
create view support_queue as
select
  fingerprint,
  kind,
  count(*)                                as occurrences,
  count(distinct user_id)                 as familles,
  min(created_at)                         as premiere_fois,
  max(created_at)                         as derniere_fois,
  mode() within group (order by app_version) as version_frequente,
  mode() within group (order by platform)    as plateforme_frequente,
  mode() within group (order by route)       as ecran_frequent,
  -- Trois exemples suffisent à comprendre ; le reste est du volume.
  (array_agg(message order by created_at desc) filter (where message <> ''))[1:3] as exemples,
  -- À qui répondre. Sans cette colonne, le tableau de bord du matin disait
  -- quoi corriger sans jamais dire à qui l'annoncer.
  (array_agg(reply_to order by created_at desc) filter (where reply_to is not null))[1:3] as repondre_a,
  min(status)                             as statut
from support_reports
group by fingerprint, kind
order by max(created_at) desc;

revoke all on support_queue from anon, authenticated;
