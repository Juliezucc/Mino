/**
 * Les jetons de notification : ce qu'un appareil a le droit d'écrire, et ce
 * que personne n'a le droit de lire.
 *
 * Un jeton de notification est une **adresse d'appareil**. Qui l'obtient peut
 * écrire à l'appareil d'un enfant, avec le texte de son choix. Chacun ne voit
 * donc que le sien, et seule la fonction serveur — qui tourne avec la clé de
 * service — les lit tous.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo 'Jetons de notification : écrire le sien, ne lire celui de personne'

do $$ begin
  delete from families where id in ('fam-notif-a', 'fam-notif-b');
  delete from auth.users where id in (
    'eeeeeeee-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000003');

  insert into auth.users (id, email, is_anonymous) values
    ('eeeeeeee-0000-0000-0000-000000000001', 'a@mino.app', false),
    ('eeeeeeee-0000-0000-0000-000000000002', 'b@mino.app', false),
    ('eeeeeeee-0000-0000-0000-000000000003', null, true);

  insert into families (id, name, code, referral_code) values
    ('fam-notif-a', 'A', 'NOTIFA1', 'PARRNOTA'),
    ('fam-notif-b', 'B', 'NOTIFB1', 'PARRNOTB');

  insert into parents (id, family_id, display_name, email, user_id) values
    ('par-notif-a', 'fam-notif-a', 'Anne', 'a@mino.app', 'eeeeeeee-0000-0000-0000-000000000001'),
    ('par-notif-b', 'fam-notif-b', 'Bruno', 'b@mino.app', 'eeeeeeee-0000-0000-0000-000000000002');

  insert into children (id, family_id, first_name, age, avatar_key)
  values ('enf-notif-a', 'fam-notif-a', 'Lou', 7, 'fox');

  insert into family_devices (id, family_id, user_id, child_id)
  values ('dev-notif-a', 'fam-notif-a', 'eeeeeeee-0000-0000-0000-000000000003', 'enf-notif-a');
end $$;

-- ------------------------------------------------- un parent pose le sien

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000001';

  insert into push_tokens (user_id, family_id, token)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'fam-notif-a', 'ExponentPushToken[a]');

  perform assert(true, 'un parent déclare son appareil joignable');

  /**
   * La fusion doit passer — et ce n'est pas acquis. Un jeton d'appareil change
   * après une réinstallation ou une restauration, et le client réécrit donc le
   * sien à chaque démarrage. `insert … on conflict do update` fait appliquer
   * par PostgreSQL la clause de la politique de MISE À JOUR à la ligne neuve :
   * sans les deux politiques, cette ligne-ci échouerait, et le produit
   * cesserait de notifier après le premier changement de jeton.
   */
  insert into push_tokens (user_id, family_id, token)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'fam-notif-a', 'ExponentPushToken[a2]')
  on conflict (user_id) do update set token = excluded.token;

  perform assert(true, 'et il peut le remplacer quand l''appareil en change');
end $$;

-- ------------------------------------------- l'appareil de l'enfant aussi

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000003';

  -- Une session anonyme est rattachée par `family_devices`, et cela suffit :
  -- sans quoi l'enfant ne recevrait jamais « tu as reçu des minos ».
  insert into push_tokens (user_id, family_id, token)
  values ('eeeeeeee-0000-0000-0000-000000000003', 'fam-notif-a', 'ExponentPushToken[enfant]');

  perform assert(true, 'l''appareil d''un enfant déclare le sien');
end $$;

-- ------------------------------------------------------ ce qui est refusé

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000002';

  -- Poser un jeton au nom de quelqu'un d'autre reviendrait à détourner ses
  -- notifications vers son propre téléphone.
  perform assert(
    refuses($q$insert into push_tokens (user_id, family_id, token)
              values ('eeeeeeee-0000-0000-0000-000000000001', 'fam-notif-a', 'volé')$q$),
    'poser un jeton au nom d''un autre compte est refusé');

  -- Et se rattacher à une famille étrangère reviendrait à recevoir les
  -- notifications de ses enfants.
  perform assert(
    refuses($q$insert into push_tokens (user_id, family_id, token)
              values ('eeeeeeee-0000-0000-0000-000000000002', 'fam-notif-a', 'intrus')$q$),
    'se déclarer joignable dans la famille d''un autre est refusé');
end $$;

-- --------------------------------------------- personne ne lit cette table

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000001';

  /**
   * Chacun voit le sien, et rien d'autre.
   *
   * La politique de lecture n'existe que parce que `on conflict do update` doit
   * lire la ligne en conflit — sans elle, réécrire son propre jeton échoue.
   * Elle s'arrête donc à `user_id = auth.uid()` : lire le jeton qu'on vient
   * d'écrire ne révèle rien, lire celui d'un autre reviendrait à obtenir
   * l'adresse de l'appareil de son enfant.
   */
  perform assert(
    (select count(*) from push_tokens) = 1,
    'un parent ne voit qu''un jeton : le sien');

  perform assert(
    (select count(*) from push_tokens
      where user_id = 'eeeeeeee-0000-0000-0000-000000000003') = 0,
    'et pas celui de l''appareil de son enfant, qui existe pourtant');
end $$;

do $$ begin
  set local role anon;
  set local mino.uid = '';

  perform assert(
    (select count(*) from push_tokens) = 0,
    'et le rôle anonyme n''en voit aucun non plus');
end $$;

-- ---------------------------------------- se déconnecter, c'est se retirer

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000002';

  -- Supprimer celui d'un autre laisserait un appareil sourd sans que son
  -- propriétaire ne l'ait demandé. La clause `using` d'une SUPPRESSION filtre
  -- en silence : aucune erreur, zéro ligne touchée.
  delete from push_tokens where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000001';

  -- Vérifié depuis la session d'Anne, et il n'y a pas d'autre endroit d'où le
  -- vérifier : Bruno ne voit pas cette ligne, donc de chez lui « elle a
  -- disparu » et « elle a toujours été invisible » se ressemblent trait pour
  -- trait. C'est le propriétaire qui doit constater qu'elle est intacte.
  perform assert(
    (select count(*) from push_tokens
      where user_id = 'eeeeeeee-0000-0000-0000-000000000001') = 1,
    'la tentative de suppression par un autre n''a rien touché');
end $$;

do $$ begin
  set local role authenticated;
  set local mino.uid = 'eeeeeeee-0000-0000-0000-000000000001';

  delete from push_tokens where user_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform assert(
    (select count(*) from push_tokens
      where user_id = 'eeeeeeee-0000-0000-0000-000000000001') = 0,
    'mais chacun peut retirer le sien');
end $$;

do $$ begin
  delete from families where id in ('fam-notif-a', 'fam-notif-b');
  delete from auth.users where id in (
    'eeeeeeee-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000003');
end $$;
