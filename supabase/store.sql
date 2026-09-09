-- =====================================================================
-- Mino — achats App Store et Play Store
--
-- À appliquer APRÈS schema.sql et analytics.sql.
--
-- Deux rails, un seul abonnement. Dans l'application, Apple et Google exigent
-- leur propre système de paiement ; sur le web, Stripe. Ce fichier fait en
-- sorte que les trois écrivent dans la MÊME table `subscriptions`, de sorte
-- qu'une famille qui a payé sur iPhone soit abonnée sur le site, et
-- réciproquement.
--
-- La règle ne change pas d'un rail à l'autre : le client ne décide jamais
-- qu'il est abonné. Il transmet une preuve, le serveur la fait vérifier, et
-- seule la notification serveur à serveur fait foi — App Store Server
-- Notifications V2 côté Apple, Real-time Developer Notifications côté Google,
-- webhook côté Stripe.
-- =====================================================================

-- --------------------------------------------------- d'où vient le paiement

do $$ begin
  alter table subscriptions add column if not exists source text
    check (source in ('stripe', 'apple', 'google'));
exception when others then null; end $$;

-- Les identifiants côté boutique, à côté de ceux de Stripe.
alter table subscriptions add column if not exists store_product_id text;
alter table subscriptions add column if not exists store_transaction_id text;

-- Le journal de facturation doit dire par où l'argent est passé, sans quoi on
-- ne peut plus comparer ce que rapporte réellement chaque rail.
alter table billing_events add column if not exists source text
  check (source in ('stripe', 'apple', 'google'));

/**
 * Ce qui reste après commission, en centimes.
 *
 * Indispensable, et pas cosmétique : une commission de boutique porte sur le
 * prix hors taxes et la TVA est reversée par la boutique, tandis que les frais
 * Stripe portent sur le montant encaissé et la TVA reste à reverser. Comparer
 * les montants bruts des deux rails se trompe d'environ un cinquième — soit
 * exactement l'ordre de grandeur de la décision qu'on prend avec ce chiffre.
 */
alter table billing_events add column if not exists net_cents integer;

-- ------------------------------------------- relier un achat à une famille

/**
 * Le jeton de compte, et pourquoi il existe.
 *
 * C'est le détail que les intégrations d'achat in-app ratent le plus souvent,
 * et il n'a aucun rattrapage : quand Apple prévient le serveur qu'un
 * abonnement vient d'être renouvelé ou résilié, la seule chose qui accompagne
 * la notification est ce jeton, transmis au moment de l'achat. S'il n'a pas
 * été envoyé, la notification arrive sans qu'on sache de quelle famille elle
 * parle — et il est alors trop tard.
 *
 * Apple impose un UUID (`appAccountToken`), Google une chaîne opaque
 * (`obfuscatedAccountId`). Nos identifiants de famille n'étant ni l'un ni
 * l'autre, la base en attribue un.
 */
alter table families add column if not exists store_account_token uuid
  not null default gen_random_uuid();

create unique index if not exists idx_families_store_token on families (store_account_token);

/** Le jeton de la famille du parent connecté, à joindre à l'achat. */
create or replace function store_account_token()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.store_account_token
  from families f
  where f.id in (select auth_family_ids())
  limit 1;
$$;

revoke all on function store_account_token() from public;
grant execute on function store_account_token() to authenticated;

-- ------------------------------------------------- les notifications reçues

/**
 * Tout ce qu'Apple et Google nous envoient, tel quel.
 *
 * Gardé brut et en ajout seul, pour la même raison que le journal de
 * facturation : le jour où un abonnement est dans un état incompréhensible,
 * la seule façon de comprendre est de relire la suite exacte des
 * notifications. Une table qui ne garde que l'état final ne permet jamais ce
 * travail-là.
 */
create table if not exists store_notifications (
  id              bigserial primary key,
  platform        text not null check (platform in ('apple', 'google')),
  -- L'identifiant de la notification côté boutique. Unique : Apple et Google
  -- réémettent leurs notifications, et un renouvellement compté deux fois
  -- fausse le MRR.
  notification_id text unique,
  kind            text,
  account_token   uuid,
  family_id       text references families (id) on delete set null,
  product_id      text,
  transaction_id  text,
  payload         jsonb not null,
  -- Faux tant que la signature n'a pas été vérifiée ; rien n'est appliqué
  -- avant. Une notification non vérifiée est une notification que n'importe
  -- qui peut envoyer.
  verified        boolean not null default false,
  received_at     timestamptz not null default now()
);

create index if not exists idx_store_notifications_family
  on store_notifications (family_id, received_at desc);
create index if not exists idx_store_notifications_token
  on store_notifications (account_token, received_at desc);

alter table store_notifications enable row level security;
-- Aucune politique : seules les fonctions serveur, avec la clé de service,
-- écrivent et lisent ici.

-- ------------------------------------------------------ un seul abonnement

/**
 * Empêche une famille de payer deux fois.
 *
 * Le cas arrive vraiment : un parent souscrit sur le site, puis, sur son
 * iPhone, retombe sur l'écran d'abonnement avant que l'état ne soit
 * rafraîchi, et paie une seconde fois — à Apple cette fois. Il a alors deux
 * abonnements, dont un qu'il ne sait pas résilier, et il écrit au support en
 * colère avec raison.
 *
 * Cette fonction donne à l'application de quoi ne pas proposer l'achat.
 * Elle ne remplace pas le contrôle à l'affichage : elle le rend possible.
 */
create or replace function has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from subscriptions s
    where s.family_id in (select auth_family_ids())
      and s.status in ('active', 'past_due', 'offert')
  );
$$;

revoke all on function has_active_subscription() from public;
grant execute on function has_active_subscription() to authenticated;

-- ------------------------------------------------- revenu net, par rail

/**
 * Ce que chaque rail rapporte réellement.
 *
 * La vue à regarder avant de décider où pousser les gens à s'abonner. Elle
 * répond à une question et une seule : le gain de conversion de l'achat natif
 * couvre-t-il la commission qu'il coûte ?
 */
create or replace view metrics_par_rail as
select
  date_trunc('month', occurred_at)::date as mois,
  coalesce(source, 'inconnu')            as rail,
  count(*) filter (where kind = 'paiement')          as paiements,
  count(distinct family_id)                          as familles,
  round(sum(amount_cents) filter (where kind = 'paiement') / 100.0, 2) as encaisse,
  round(sum(net_cents)    filter (where kind = 'paiement') / 100.0, 2) as net,
  round(
    100.0 * (1 - sum(net_cents) filter (where kind = 'paiement')::numeric
                 / nullif(sum(amount_cents) filter (where kind = 'paiement'), 0)), 1
  ) as prelevement_pct
from billing_events
group by 1, 2
order by 1 desc, 2;

revoke all on metrics_par_rail from anon, authenticated;
