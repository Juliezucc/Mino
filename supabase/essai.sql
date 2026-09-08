-- =====================================================================
-- Mino — l'essai de 30 jours
--
-- À appliquer APRÈS schema.sql.
--
-- **Le défaut que ce fichier répare, et il vidait le modèle économique.**
-- Aucune ligne n'était jamais créée dans `subscriptions` à la création d'une
-- famille : le seul écrivain était le webhook de paiement. Or `isLocked(null)`
-- rend `false` — une famille sans ligne avait donc un accès complet, gratuit,
-- pour toujours. Le compte à rebours des 30 jours ne démarrait jamais, et rien
-- ne se fermait jamais.
--
-- Le site, les CGV et la FAQ promettent tous les trois « 30 jours d'essai puis
-- 9,90 € ». Le produit promettait 30 jours et donnait l'infini.
--
-- Deuxième conséquence, qui confirme le diagnostic : `billing` allonge l'essai
-- du filleul en modifiant une ligne `trialing` existante. Sans ligne, le
-- parrainage n'accordait rien non plus.
--
-- **Ici et pas dans le client.** Une famille qui pourrait écrire son propre
-- statut le ferait, et la table n'a d'ailleurs aucune politique d'écriture :
-- avec RLS active et aucune politique, tout est refusé. Le déclencheur est
-- `security definer`, donc il s'exécute avec les droits du propriétaire de la
-- table — c'est la seule façon d'écrire cette ligne sans ouvrir la porte à qui
-- que ce soit d'autre.
-- =====================================================================

/**
 * 30 jours, et le nombre est écrit deux fois.
 *
 * `TRIAL_DAYS` dans `src/domain/billing.ts` décide de ce que l'application
 * affiche ; celui-ci décide de ce qui est vrai. Un test les compare —
 * `__tests__/billing.test.ts` — parce que deux nombres qui doivent être égaux
 * et qui vivent dans deux fichiers finissent toujours par diverger.
 */
create or replace function start_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into subscriptions (family_id, status, trial_ends_at)
  values (new.id, 'trialing', new.created_at + interval '30 days')
  on conflict (family_id) do nothing;
  return new;
end $$;

drop trigger if exists families_start_trial on families;
create trigger families_start_trial
  after insert on families
  for each row execute function start_trial();

/**
 * Les familles déjà créées, qui n'ont jamais eu d'essai.
 *
 * Leur compte à rebours part de leur inscription, pas d'aujourd'hui : c'est ce
 * que la promesse dit — trente jours à partir du moment où l'on s'inscrit. Une
 * famille inscrite il y a plus de trente jours se retrouve donc expirée
 * immédiatement, et c'est correct : elle a eu son essai, elle ne l'a
 * simplement jamais vu s'écouler.
 *
 * `on conflict do nothing` : une famille qui a déjà payé garde sa ligne.
 */
insert into subscriptions (family_id, status, trial_ends_at)
select f.id, 'trialing', f.created_at + interval '30 days'
from families f
left join subscriptions s on s.family_id = f.id
where s.family_id is null
on conflict (family_id) do nothing;
