/**
 * L'essai de 30 jours démarre tout seul, à la création de la famille.
 *
 * Ce que ces vérifications tiennent : une famille créée sans essai est une
 * famille qui ne paiera jamais — `isLocked(null)` rend `false`, donc l'accès
 * reste complet indéfiniment. Le défaut n'a rien cassé pendant des semaines,
 * précisément parce qu'il donnait plus au lieu de donner moins.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'L’essai de 30 jours : créé tout seul, et par personne d’autre'

do $$ begin
  delete from families where id in ('fam-essai-a', 'fam-essai-b');
end $$;

-- ---------------------------------------------- une famille neuve

do $$
declare
  ligne subscriptions%rowtype;
begin
  insert into families (id, name, code, referral_code)
  values ('fam-essai-a', 'Essai', 'ESSAIA1', 'PARRESSA');

  select * into ligne from subscriptions where family_id = 'fam-essai-a';

  perform assert(ligne.family_id is not null, 'une famille neuve reçoit sa ligne d''abonnement');
  perform assert(ligne.status = 'trialing', 'et elle est en essai');
  perform assert(ligne.plan is null, 'sans formule choisie');

  /**
   * Trente jours, à un cheveu près.
   *
   * La comparaison est bornée plutôt qu'exacte : `now()` bouge entre
   * l'insertion et la lecture. Une minute de tolérance suffit à absorber cela
   * et ne laisserait pas passer un intervalle qui aurait été écrit en jours
   * au lieu de trente, ou l'inverse.
   */
  perform assert(
    ligne.trial_ends_at between now() + interval '30 days' - interval '1 minute'
                           and now() + interval '30 days' + interval '1 minute',
    'et elle expire dans exactement trente jours');
end $$;

-- -------------------------------------- l'essai ne se réécrit pas

do $$
declare
  avant timestamptz;
  apres timestamptz;
begin
  select trial_ends_at into avant from subscriptions where family_id = 'fam-essai-a';

  -- Une famille qui a déjà sa ligne ne doit pas en recevoir une seconde, ni
  -- voir la sienne repoussée : ce serait un essai qui se renouvelle tout seul.
  update families set name = 'Essai renommé' where id = 'fam-essai-a';

  select trial_ends_at into apres from subscriptions where family_id = 'fam-essai-a';
  perform assert(avant = apres, 'modifier la famille ne repousse pas son essai');

  perform assert(
    (select count(*) from subscriptions where family_id = 'fam-essai-a') = 1,
    'et n''en crée pas une deuxième');
end $$;

-- ------------------------------------ personne ne s'offre l'abonnement

do $$ begin
  set local role authenticated;
  set local mino.uid = '';

  /**
   * La table n'a aucune politique d'écriture, et c'est délibéré : avec RLS
   * active et aucune politique, l'insertion, la mise à jour et la suppression
   * sont toutes refusées. Le déclencheur, lui, passe parce qu'il est
   * `security definer`.
   *
   * Sans cette vérification, il suffirait d'un jour de fatigue et d'une
   * politique « for all » ajoutée par confort pour qu'une famille se déclare
   * abonnée à vie.
   */
  perform assert(
    refuses($q$insert into subscriptions (family_id, status)
              values ('fam-essai-a', 'active')$q$),
    'un client ne peut pas s''inventer un abonnement');

  /**
   * Sur une MISE À JOUR, la clause `using` d'une politique absente ne lève
   * pas : elle rend la ligne invisible, l'ordre porte sur zéro ligne, et
   * PostgreSQL répond « UPDATE 0 » sans une plainte. Il faut donc vérifier
   * l'effet, pas l'erreur — c'est exactement le piège qui ferait écrire un
   * test vert au-dessus d'une table ouverte.
   */
  update subscriptions set status = 'active' where family_id = 'fam-essai-a';
end $$;

do $$ begin
  perform assert(
    (select status from subscriptions where family_id = 'fam-essai-a') = 'trialing',
    'ni transformer son essai en abonnement');
end $$;

do $$ begin
  delete from families where id in ('fam-essai-a', 'fam-essai-b');
end $$;
