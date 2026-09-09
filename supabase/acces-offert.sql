-- =====================================================================
-- Mino — l'accès offert
--
-- Pour les familles qui essuient les plâtres : celles qui essaient Mino avant
-- tout le monde et racontent ce qui ne va pas. Elles ne paient pas, jamais.
--
-- À coller **une fois** dans l'éditeur SQL de Supabase pour ouvrir l'état, puis
-- à rejouer, dernière requête seulement, pour chaque famille à qui l'offrir.
--
-- ---------------------------------------------------------------------
-- Pourquoi un état à part, et pas « actif jusqu'en 2099 »
--
-- On aurait pu écrire une date lointaine et passer à autre chose. L'écran
-- d'abonnement aurait alors annoncé « prochain paiement le 31 décembre 2099 »
-- et proposé un bouton « Résilier » qui n'aurait rien eu à résilier — un bouton
-- mort de plus, sur l'écran qui parle d'argent, offert précisément aux gens
-- dont on attend qu'ils nous disent ce qui cloche.
--
-- `offert` s'affiche « Accès offert · sans limite de durée », ne propose ni
-- formule ni résiliation, et n'expire pas : `accessOf` le rend avant même de
-- regarder une date.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ouvrir l'état (une seule fois, sur le projet)
--
-- La contrainte d'origine n'admettait que quatre valeurs. Sans cette ligne,
-- l'attribution plus bas échoue avec « violates check constraint », ce qui est
-- exactement le bon comportement — mieux vaut un refus franc qu'un état que la
-- moitié du code ne saurait pas lire.
-- ---------------------------------------------------------------------

alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('trialing','active','past_due','canceled','offert'));

-- `has_active_subscription()` sert à ne pas proposer un achat à quelqu'un qui
-- est déjà couvert. Une famille en accès offert l'est.
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

-- ---------------------------------------------------------------------
-- 2. Retrouver la famille
--
-- Par l'adresse du parent, qui est ce qu'on a sous la main quand quelqu'un
-- accepte de tester. Le code famille marche aussi : `where f.code = 'MINO-…'`.
-- ---------------------------------------------------------------------

select f.id as famille, f.code, p.display_name, p.email, s.status, s.trial_ends_at
from families f
left join parents p on p.family_id = f.id
left join subscriptions s on s.family_id = f.id
where lower(p.email) = lower('adresse@exemple.fr');

-- ---------------------------------------------------------------------
-- 3. Offrir l'accès
--
-- Remplacez l'identifiant par celui rendu ci-dessus. Tout ce qui décrit une
-- facturation est effacé dans le même geste : ni formule, ni échéance, ni
-- résiliation en attente. Ce qui n'est pas facturé ne doit rien laisser
-- derrière qui ressemble à une facture.
--
-- `customer_id` et `subscription_id` ne sont PAS effacés : si cette famille a
-- payé un jour, cette trace lui appartient, et l'effacer rouvrirait l'essai à
-- une famille qui l'a déjà eu.
-- ---------------------------------------------------------------------

update subscriptions
set status               = 'offert',
    plan                 = null,
    current_period_end   = null,
    cancel_at_period_end = false,
    source               = null,
    updated_at           = now()
where family_id = 'fam_………';

-- ---------------------------------------------------------------------
-- 4. Vérifier, et savoir à qui on l'a donné
-- ---------------------------------------------------------------------

select f.code, p.email, s.status, s.updated_at
from subscriptions s
join families f on f.id = s.family_id
left join parents p on p.family_id = f.id
where s.status = 'offert'
order by s.updated_at desc;

-- ---------------------------------------------------------------------
-- 5. Le retirer, le jour venu
--
-- La famille repasse en `canceled` : elle garde ses données, ses missions et
-- ses minutes, et retrouve l'écran d'abonnement ordinaire. Elle recevra
-- l'e-mail de reprise, avec son lien de paiement sans mot de passe.
--
--   update subscriptions
--   set status = 'canceled', updated_at = now()
--   where family_id = 'fam_………';
-- =====================================================================
