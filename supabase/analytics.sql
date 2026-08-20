-- =====================================================================
-- Mino — mesure de l'activité
--
-- À appliquer APRÈS schema.sql.
--
-- Le problème que ce fichier règle, en une phrase : `subscriptions` est un
-- miroir de ce que dit Stripe *aujourd'hui*. Chaque changement l'écrase. Une
-- famille qui a essayé, payé quatre mois puis résilié n'y laisse qu'une ligne
-- « canceled » — et cette ligne ne dit ni quand elle a commencé, ni combien
-- elle a payé, ni quand elle est partie.
--
-- Autrement dit : sans ce qui suit, le churn, les cohortes, la LTV et le MRR
-- des mois passés sont **définitivement incalculables**. Pas difficiles à
-- calculer : incalculables, parce que l'information n'a jamais été écrite.
--
-- C'est exactement la règle déjà appliquée au temps d'écran — on ne stocke
-- jamais qu'un compteur qui change — appliquée cette fois à l'argent.
--
-- Rien ici n'est lisible par un client : tout est réservé au rôle de service.
-- =====================================================================

-- ------------------------------------------------------ le journal facturation

create table if not exists billing_events (
  id           bigserial primary key,
  family_id    text not null references families(id) on delete cascade,
  kind         text not null check (kind in (
                 'essai_commence',
                 'abonnement_commence',
                 'paiement',
                 'paiement_echoue',
                 'resiliation_demandee',
                 'resiliation_effective',
                 'formule_changee',
                 'parrainage_credite'
               )),
  -- L'état et la formule au moment de l'événement : c'est ce qui permet de
  -- reconstituer la situation d'une famille à n'importe quelle date passée.
  status       text check (status in ('trialing','active','past_due','canceled')),
  plan         text check (plan in ('monthly','yearly')),
  -- En centimes, hors taxes, tel qu'encaissé. Nul pour tout ce qui n'est pas
  -- un paiement.
  amount_cents integer,
  currency     text not null default 'eur',
  -- L'identifiant de l'événement Stripe. Unique : Stripe rejoue ses webhooks,
  -- et un paiement compté deux fois fausse tout ce qui suit.
  stripe_event_id text unique,
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_billing_events_family on billing_events (family_id, occurred_at desc);
create index if not exists idx_billing_events_kind on billing_events (kind, occurred_at desc);

alter table billing_events enable row level security;
-- Aucune politique : ni lecture ni écriture par un client. Seul le webhook,
-- qui utilise la clé de service, écrit ici.

-- --------------------------------------------------- dépenses d'acquisition

/**
 * Ce que Stripe ne saura jamais : ce que la publicité a coûté.
 *
 * Sans cette table, le CAC n'est pas calculable — il n'y a aucune source
 * automatique pour le montant dépensé. Une ligne par mois et par canal,
 * saisie à la main ou importée. C'est cinq minutes par mois, et c'est le
 * seul chiffre qui dise si l'acquisition est rentable.
 */
create table if not exists marketing_spend (
  month      date not null,
  channel    text not null,
  amount_eur numeric(10,2) not null check (amount_eur >= 0),
  -- Renseigné depuis App Store Connect et la Play Console, qui ne se
  -- connectent pas à la base : c'est le haut de l'entonnoir.
  installs   integer,
  note       text,
  primary key (month, channel)
);

alter table marketing_spend enable row level security;

-- ----------------------------------------- l'état de chaque famille, mois par mois

/**
 * La brique de tout le reste : où en était chaque famille à la fin de chaque
 * mois. Le `lateral` prend le dernier événement antérieur à la fin du mois —
 * un seul accès à l'index par famille et par mois.
 */
create or replace view metrics_famille_mois as
select
  p.family_id,
  p.month::date as mois,
  coalesce(e.status, 'canceled') as statut,
  e.plan as formule
from (
  select f.family_id, m.month
  from (select distinct family_id from billing_events) f
  cross join generate_series(
    coalesce(date_trunc('month', (select min(occurred_at) from billing_events)), date_trunc('month', now())),
    date_trunc('month', now()),
    interval '1 month'
  ) m(month)
) p
left join lateral (
  select b.status, b.plan
  from billing_events b
  where b.family_id = p.family_id
    and b.occurred_at < p.month + interval '1 month'
  order by b.occurred_at desc
  limit 1
) e on true;

-- ------------------------------------------------------------------- MRR

/**
 * Le revenu récurrent mensuel.
 *
 * L'annuel est ramené au mois (79 € / 12 = 6,58 €) : sans cela, un mois de
 * ventes annuelles fait un pic magnifique et un trou les onze mois suivants.
 * Les chiffres sont hors taxes — c'est le revenu, pas l'encaissement.
 */
create or replace view metrics_mrr as
select
  mois,
  count(*) filter (where statut = 'active')                        as clients_payants,
  count(*) filter (where statut = 'trialing')                      as en_essai,
  count(*) filter (where statut = 'past_due')                      as impayes,
  count(*) filter (where statut = 'active' and formule = 'monthly') as mensuels,
  count(*) filter (where statut = 'active' and formule = 'yearly')  as annuels,
  round(sum(
    case when statut = 'active'
      then case when formule = 'yearly' then 79.0 / 12 else 9.90 end
      else 0 end
  )::numeric, 2) as mrr,
  round(sum(
    case when statut = 'active'
      then case when formule = 'yearly' then 79.0 else 9.90 * 12 end
      else 0 end
  )::numeric, 2) as arr
from metrics_famille_mois
group by mois
order by mois;

-- ----------------------------------------------------------------- churn

/**
 * Le taux de résiliation mensuel, et son inverse utile : la durée de vie.
 *
 * 1 / churn donne le nombre de mois qu'une famille reste en moyenne. À 5 % par
 * mois, vingt mois ; à 8 %, douze et demi. C'est ce nombre, et non le MRR, qui
 * décide de combien on peut dépenser pour acquérir un client.
 */
create or replace view metrics_churn as
select
  courant.mois,
  count(*) filter (where precedent.statut = 'active')                                as base_debut,
  count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active') as perdus,
  count(*) filter (where precedent.statut <> 'active' and courant.statut = 'active') as gagnes,
  round(
    100.0 * count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active')
    / nullif(count(*) filter (where precedent.statut = 'active'), 0), 2
  ) as taux_churn_pct,
  round(
    1.0 / nullif(
      count(*) filter (where precedent.statut = 'active' and courant.statut <> 'active')::numeric
      / nullif(count(*) filter (where precedent.statut = 'active'), 0), 0), 1
  ) as duree_de_vie_mois
from metrics_famille_mois courant
join metrics_famille_mois precedent
  on precedent.family_id = courant.family_id
 and precedent.mois = (courant.mois - interval '1 month')::date
group by courant.mois
order by courant.mois;

-- -------------------------------------------------------------- cohortes

/**
 * Les cohortes, ancrées sur la création du compte et non sur le premier
 * paiement. C'est le seul ancrage qui laisse voir la conversion de l'essai :
 * partir du premier paiement revient à ne regarder que ceux qui ont converti.
 */
create or replace view metrics_cohortes as
with cohorte as (
  select id as family_id, date_trunc('month', created_at)::date as mois_arrivee
  from families
)
select
  c.mois_arrivee,
  m.mois,
  ((extract(year from age(m.mois, c.mois_arrivee)) * 12
    + extract(month from age(m.mois, c.mois_arrivee))))::int as mois_apres,
  count(*)                                        as familles,
  count(*) filter (where m.statut = 'active')     as payantes,
  round(100.0 * count(*) filter (where m.statut = 'active') / nullif(count(*), 0), 1) as retention_pct
from cohorte c
join metrics_famille_mois m on m.family_id = c.family_id and m.mois >= c.mois_arrivee
group by c.mois_arrivee, m.mois
order by c.mois_arrivee, m.mois;

-- ------------------------------------------------------------------- LTV

/**
 * Deux LTV, et il faut les deux.
 *
 * `revenu_encaisse_par_famille` est un fait : ce que cette cohorte a réellement
 * rapporté à ce jour. Il sous-estime toujours les cohortes récentes, qui n'ont
 * pas fini de payer.
 *
 * `ltv_projetee` est une estimation : revenu mensuel moyen ÷ taux de churn.
 * C'est elle qu'on compare au CAC — mais elle vaut ce que vaut le churn, donc
 * pas grand-chose avant six mois d'historique. Les deux ensemble, jamais l'une
 * seule.
 */
create or replace view metrics_ltv as
with cohorte as (
  select id as family_id, date_trunc('month', created_at)::date as mois_arrivee
  from families
),
encaisse as (
  select c.mois_arrivee,
         count(distinct c.family_id)                                     as familles,
         coalesce(sum(b.amount_cents), 0) / 100.0                        as revenu_total,
         count(distinct b.family_id) filter (where b.kind = 'paiement')  as familles_payantes
  from cohorte c
  left join billing_events b on b.family_id = c.family_id and b.kind = 'paiement'
  group by c.mois_arrivee
),
churn_moyen as (
  select avg(taux_churn_pct) / 100.0 as taux
  from metrics_churn
  where base_debut > 0
)
select
  e.mois_arrivee,
  e.familles,
  e.familles_payantes,
  round(100.0 * e.familles_payantes / nullif(e.familles, 0), 1) as conversion_pct,
  round((e.revenu_total / nullif(e.familles, 0))::numeric, 2)   as revenu_encaisse_par_famille,
  round((e.revenu_total / nullif(e.familles_payantes, 0))::numeric, 2) as revenu_par_payante,
  round((9.90 / nullif((select taux from churn_moyen), 0))::numeric, 2) as ltv_projetee
from encaisse e
order by e.mois_arrivee;

-- ------------------------------------------------------------------- CAC

/**
 * Le coût d'acquisition, et le seul ratio qui compte vraiment : LTV / CAC.
 *
 * Le repère habituel est 3. En dessous de 1, chaque client acquis coûte plus
 * qu'il ne rapporte — et dépenser davantage aggrave la situation au lieu de
 * l'améliorer, ce qui est le piège le plus courant à ce stade.
 *
 * `cac_paye` ne compte que les dépenses déclarées : les clients venus du
 * parrainage ou du bouche-à-oreille tirent le CAC moyen vers le bas, ce qui
 * est juste — ils ont vraiment coûté moins cher.
 */
create or replace view metrics_cac as
with nouveaux as (
  select date_trunc('month', min(occurred_at))::date as mois, family_id
  from billing_events
  where kind = 'abonnement_commence'
  group by family_id
),
par_mois as (
  select mois, count(*) as nouveaux_payants from nouveaux group by mois
),
depense as (
  select month as mois, sum(amount_eur) as depense_eur, sum(installs) as installs
  from marketing_spend group by month
)
select
  coalesce(p.mois, d.mois)                                        as mois,
  coalesce(p.nouveaux_payants, 0)                                 as nouveaux_payants,
  coalesce(d.depense_eur, 0)                                      as depense_eur,
  d.installs,
  round((d.depense_eur / nullif(p.nouveaux_payants, 0))::numeric, 2) as cac,
  round(
    (select ltv_projetee from metrics_ltv order by mois_arrivee desc limit 1)
    / nullif(d.depense_eur / nullif(p.nouveaux_payants, 0), 0), 2
  ) as ltv_sur_cac
from par_mois p
full outer join depense d on d.mois = p.mois
order by 1;

-- ------------------------------------------------------------ entonnoir

/**
 * De l'installation au paiement. Le taux qui compte est le dernier : un essai
 * qui ne devient pas payant a coûté un client sans en rapporter un.
 */
create or replace view metrics_entonnoir as
with mois as (
  select date_trunc('month', created_at)::date as mois, count(*) as comptes_crees
  from families group by 1
),
essais as (
  select date_trunc('month', min(occurred_at))::date as mois, count(distinct family_id) as essais
  from billing_events where kind = 'essai_commence' group by 1
),
payants as (
  select date_trunc('month', min(occurred_at))::date as mois, count(distinct family_id) as payants
  from billing_events where kind = 'abonnement_commence' group by 1
),
installs as (
  select month as mois, sum(installs) as installs from marketing_spend group by 1
)
select
  m.mois,
  i.installs,
  m.comptes_crees,
  e.essais,
  p.payants,
  round(100.0 * m.comptes_crees / nullif(i.installs, 0), 1) as install_vers_compte_pct,
  round(100.0 * e.essais / nullif(m.comptes_crees, 0), 1)   as compte_vers_essai_pct,
  round(100.0 * p.payants / nullif(e.essais, 0), 1)         as essai_vers_payant_pct
from mois m
left join essais e on e.mois = m.mois
left join payants p on p.mois = m.mois
left join installs i on i.mois = m.mois
order by m.mois;

-- ----------------------------------------------------------- parrainage

/**
 * Le parrainage rapporte-t-il plus qu'il ne coûte ?
 *
 * Un mois offert vaut 9,90 € de revenu abandonné. Tant que le filleul reste
 * plus d'un mois, l'opération est gagnante — d'où la colonne qui compare les
 * mois offerts au revenu réellement encaissé auprès des filleuls.
 */
create or replace view metrics_parrainage as
with filleuls as (
  select r.referee_family_id, r.status,
         date_trunc('month', r.created_at)::date as mois,
         coalesce(sum(b.amount_cents) filter (where b.kind = 'paiement'), 0) / 100.0 as revenu
  from referrals r
  left join billing_events b on b.family_id = r.referee_family_id
  group by r.referee_family_id, r.status, date_trunc('month', r.created_at)
)
select
  mois,
  count(*)                                          as parrainages,
  count(*) filter (where status = 'credited')       as credites,
  count(*) filter (where status = 'pending')        as en_attente,
  round(sum(revenu)::numeric, 2)                    as revenu_filleuls,
  round((count(*) filter (where status = 'credited') * 9.90)::numeric, 2) as cout_mois_offerts,
  round((sum(revenu) - count(*) filter (where status = 'credited') * 9.90)::numeric, 2) as gain_net
from filleuls
group by mois
order by mois;

-- ------------------------------------------------------------ verrouillage

-- Ce sont des chiffres d'entreprise, pas des données de famille. Aucun client
-- n'y accède : seul le rôle de service, depuis le tableau de bord Supabase.
do $$
declare v text;
begin
  foreach v in array array[
    'metrics_famille_mois', 'metrics_mrr', 'metrics_churn', 'metrics_cohortes',
    'metrics_ltv', 'metrics_cac', 'metrics_entonnoir', 'metrics_parrainage'
  ] loop
    execute format('revoke all on %I from anon, authenticated', v);
  end loop;
end $$;
