-- =====================================================================
-- Mino — rattraper les comptes fondés sans adresse
--
-- À jouer UNE FOIS dans l'éditeur SQL de Supabase, après le déploiement du
-- correctif. Rejouable sans dommage.
--
-- ---------------------------------------------------------------------
-- Ce qui s'est passé
--
-- Le parcours d'inscription fonde la famille sur une session **anonyme**, puis
-- demande l'adresse deux écrans plus tard. Or Supabase rend `''` — et non
-- `null` — pour l'adresse d'un utilisateur anonyme, et `createAccount` faisait
-- `session.email ?? saisie` : le vide passait devant l'adresse tapée, parce
-- qu'il n'est ni `null` ni `undefined`.
--
-- Conséquence : `parents.email` naissait vide. L'e-mail de bienvenue s'arrêtait
-- sur « sans adresse » et rendait 200 sans rien écrire dans les journaux — ce
-- qui, vu du tableau de bord, ressemble exactement à une fonction que personne
-- n'appelle.
--
-- Le second défaut, corrigé dans le même mouvement, ne se rattrape pas ici :
-- `auth_is_parent()` répondait déjà « oui » à ce moment-là (la ligne `parents`
-- existe depuis l'écran d'avant), si bien que `linkEmail` n'était jamais
-- appelé. Ces comptes-là n'ont ni adresse ni mot de passe côté `auth.users` :
-- ils marchent sur l'appareil où ils ont été créés, et nulle part ailleurs.
-- Le parent doit repasser par « Mon compte » pour poser son adresse et son mot
-- de passe — ce qui, lui, appelle bien `updateUser`.
--
-- ---------------------------------------------------------------------
-- 1. Voir l'étendue avant de toucher à quoi que ce soit
-- =====================================================================

select
  p.family_id,
  p.display_name,
  coalesce(nullif(p.email, ''), '(vide)') as adresse_dans_parents,
  coalesce(nullif(u.email, ''), '(vide)') as adresse_dans_auth,
  u.is_anonymous,
  p.created_at
from parents p
left join auth.users u on u.id = p.user_id
where coalesce(p.email, '') = ''
order by p.created_at desc;

-- =====================================================================
-- 2. Recopier l'adresse du compte quand il y en a une
--
-- On ne renseigne que ce que la base sait déjà : l'adresse portée par
-- `auth.users`. Inventer une adresse à partir d'autre chose écrirait à
-- quelqu'un qui ne s'est jamais inscrit.
-- =====================================================================

update parents p
set email = lower(trim(u.email))
from auth.users u
where u.id = p.user_id
  and coalesce(p.email, '') = ''
  and coalesce(u.email, '') <> '';

-- =====================================================================
-- 3. Ce qui reste sans adresse nulle part
--
-- Ces familles-là n'ont jamais eu d'adresse enregistrée : personne ne peut leur
-- écrire, et personne ne peut se reconnecter sur leur compte. Il n'y a rien à
-- réparer en base — le parent doit ouvrir « Mon compte » et poser son adresse.
-- La requête est là pour savoir combien elles sont.
-- =====================================================================

select count(*) as familles_sans_adresse
from parents p
left join auth.users u on u.id = p.user_id
where coalesce(p.email, '') = '' and coalesce(u.email, '') = '';

-- =====================================================================
-- 4. Rouvrir la bienvenue pour celles qu'on vient de réparer
--
-- La table `courriers` empêche tout doublon. Elle est vide pour ces
-- familles-là, puisque la trace n'est écrite qu'après un envoi réussi — il n'y
-- a donc rien à effacer, et rien à faire ici. La ligne suivante est une
-- vérification, pas une correction :
-- =====================================================================

select genre, count(*) from courriers group by genre;
