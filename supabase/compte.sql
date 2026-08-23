-- =====================================================================
-- Mino — quitter
--
-- À appliquer APRÈS schema.sql. Un seul sujet : permettre à un parent de
-- s'en aller pour de bon, et que « pour de bon » soit vrai.
--
-- Trois raisons, et chacune suffirait :
--
--   1. La FAQ le promet déjà, mot pour mot : « Depuis Réglages, "Supprimer le
--      compte". Tout est effacé sous trente jours. » Une promesse écrite dans
--      le produit et absente du produit est un mensonge, pas un manque.
--
--   2. Apple l'exige. Règle 5.1.1(v) : une application qui permet de créer un
--      compte doit permettre de le supprimer, depuis l'application, sans
--      écrire à personne. Une application qui ne le fait pas est refusée —
--      pas commentée, refusée.
--
--   3. Le RGPD, article 17. Le droit à l'effacement ne se satisfait pas d'une
--      adresse e-mail à qui écrire.
--
-- POURQUOI DU SQL ET PAS DU JAVASCRIPT. Supprimer une ligne de `auth.users`
-- demande des droits que l'application n'a pas et ne doit jamais avoir : la
-- clé `service_role` passe outre toutes les règles RLS et donnerait, si elle
-- fuitait d'un téléphone, accès aux enfants de toutes les familles. Cette
-- fonction est `security definer` : elle s'exécute avec les droits de son
-- propriétaire, mais elle ne connaît qu'un seul compte — celui qui appelle,
-- lu dans `auth.uid()` et jamais reçu en paramètre. Il n'y a donc rien à
-- falsifier.
--
-- Appliquer avec :  npm run db:push   (ou coller dans l'éditeur SQL)
-- =====================================================================

-- ------------------------------------------------------------ supprimer

/**
 * Effacer le compte qui appelle, et la famille s'il en était le dernier parent.
 *
 * L'ordre compte, et il n'est pas celui qu'on écrirait d'instinct.
 *
 * On supprime la FAMILLE d'abord, la ligne `auth.users` ensuite. En sens
 * inverse, la cascade de `parents.user_id` emporterait la ligne `parents`
 * avant qu'on ait pu lire à quelle famille elle appartenait — et la famille
 * resterait là, avec ses enfants, ses missions et son grand livre, rattachée à
 * personne et lisible par personne. C'est-à-dire indestructible.
 *
 * Le cas à deux parents est traité à part, et il n'est pas symétrique : si un
 * autre parent reste, la famille ne lui appartient pas moins qu'avant. On
 * retire le partant, on ne touche pas aux enfants. Un parent qui s'en va n'a
 * pas le pouvoir d'effacer les données de l'autre.
 *
 * Ce que la fonction NE supprime PAS, et pourquoi :
 *
 *   - les factures. Elles ne sont pas ici : elles vivent chez Stripe, Apple ou
 *     Google, qui les gardent dix ans comme la loi comptable l'exige. Elles ne
 *     contiennent aucune donnée d'enfant — un montant, une date, une adresse
 *     de facturation d'adulte. C'est exactement ce que dit la FAQ.
 *
 *   - l'abonnement lui-même. Supprimer le compte n'annule pas un prélèvement
 *     en cours chez Apple : seul Apple le peut, et l'écran d'avertissement le
 *     dit avant de demander confirmation. Prétendre le contraire depuis le SQL
 *     serait la pire des deux erreurs possibles.
 *
 * Rend le nombre de familles effacées : 0 si le parent en quitte une où
 * quelqu'un reste, 1 dans le cas courant.
 */
create or replace function delete_my_account()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moi        uuid := auth.uid();
  effacees   integer := 0;
  fam        text;
begin
  if moi is null then
    raise exception 'Aucune session' using errcode = '42501';
  end if;

  -- Un appareil enfant appairé porte lui aussi le rôle `authenticated` — c'est
  -- une session anonyme, pas un rôle à part. Sans cette ligne, la fonction lui
  -- serait ouverte : la boucle ne trouverait aucune famille, mais le `delete
  -- from auth.users` plus bas emporterait son identité, et l'appareil se
  -- désappairerait tout seul. Un enfant n'a pas ce pouvoir-là.
  if not exists (select 1 from parents where user_id = moi) then
    raise exception 'Seul un parent peut supprimer un compte' using errcode = '42501';
  end if;

  -- Une famille à la fois : un parent peut en théorie en avoir plusieurs, et
  -- la règle du dernier parent se décide famille par famille.
  for fam in select family_id from parents where user_id = moi loop
    if (select count(*) from parents where family_id = fam) <= 1 then
      -- Dernier parent : la famille part avec lui. Tout le reste — enfants,
      -- missions, grand livre, sessions, appareils, abonnement, parrainages —
      -- pend à `families.id` par des clés étrangères `on delete cascade`. Une
      -- seule ligne à supprimer, et rien ne survit.
      delete from families where id = fam;
      effacees := effacees + 1;
    else
      delete from parents where family_id = fam and user_id = moi;
    end if;
  end loop;

  -- Puis l'identité elle-même. La cascade emporte ce qui restait accroché à
  -- l'utilisateur : `parent_secrets` (le code parent), `family_devices`, et la
  -- ligne `parents` dans le cas à deux parents traité ci-dessus.
  delete from auth.users where id = moi;

  return effacees;
end;
$$;

comment on function delete_my_account() is
  'Efface le compte appelant et, s''il en était le dernier parent, sa famille entière. Ne prend aucun paramètre : le compte visé est toujours auth.uid().';

-- Aucun paramètre à falsifier, mais la porte se ferme quand même côté anonyme :
-- une session doit exister pour que `auth.uid()` rende autre chose que null,
-- et un appareil enfant appairé n'est pas un parent — il ne trouvera aucune
-- ligne `parents` à son nom et n'effacera donc rien.
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
