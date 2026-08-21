/**
 * Ce qui protège la facture, et ce qui protège les confidences.
 *
 * Deux choses tiennent le compagnon, et aucune des deux n'était éprouvée :
 *
 * 1. **Le budget.** Vingt échanges par jour et par enfant. C'est ce qui tient
 *    la promesse du produit — Mino tient compagnie, il ne remplace pas le temps
 *    d'écran — et c'est aussi ce qui plafonne la dépense. Sans décompte tenu
 *    côté base, un client modifié ferait tourner la note Anthropic toute la
 *    nuit, et personne ne s'en apercevrait avant la facture.
 *
 * 2. **Le secret.** Un parent lit les conversations de ses enfants. Personne
 *    d'autre : ni une autre famille, ni — et c'est le point délicat — la
 *    tablette du frère, puisque tous les appareils enfants d'une famille
 *    partagent une même identité anonyme.
 *
 * Rejoué par `npm run test:sql`, après `rls.sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

-- ------------------------------------------------------------- la famille

create or replace function seed_companion() returns void language plpgsql
security definer set search_path = public, auth as $$
begin
  delete from families where id in ('fam-c1', 'fam-c2');
  delete from auth.users where id in (
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666'
  );

  insert into auth.users (id, email) values
    ('44444444-4444-4444-4444-444444444444', 'julie@mino.app'),
    ('55555555-5555-5555-5555-555555555555', null),
    ('66666666-6666-6666-6666-666666666666', 'voisin@mino.app');

  insert into families (id, name, code, referral_code) values
    ('fam-c1', 'Martin', 'MARTINC', 'PARRAINC'),
    ('fam-c2', 'Voisins', 'VOISINC', 'PARRAIND');

  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-c1', 'fam-c1', '44444444-4444-4444-4444-444444444444', 'Julie', 'julie@mino.app'),
    ('par-c2', 'fam-c2', '66666666-6666-6666-6666-666666666666', 'Voisin', 'voisin@mino.app');

  insert into family_devices (id, family_id, user_id, joined_at)
    values ('fd-c1', 'fam-c1', '55555555-5555-5555-5555-555555555555', now());

  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-c-noah', 'fam-c1', 'Noah', 8, 'fox'),
    ('enf-c-lea', 'fam-c1', 'Léa', 14, 'panda'),
    ('enf-c-voisin', 'fam-c2', 'Inconnu', 9, 'lion');

  -- Une conversation d'hier et une d'aujourd'hui, pour chacun.
  delete from companion_messages;
  delete from companion_usage;
  insert into companion_messages (child_id, family_id, role, text, safety) values
    ('enf-c-noah', 'fam-c1', 'child', 'coucou', 'none'),
    ('enf-c-noah', 'fam-c1', 'mino', 'Coucou Noah !', 'none'),
    ('enf-c-lea', 'fam-c1', 'child', 'je suis triste', 'tender'),
    ('enf-c-voisin', 'fam-c2', 'child', 'salut', 'none');
end $$;

select seed_companion();

/* ===================================================== le budget quotidien */

\echo ''
\echo 'Le budget, tenu par la base'

do $$
declare ok boolean; i integer;
begin
  -- Vingt échanges passent, le vingt-et-unième non. C'est tout le contrat.
  for i in 1..20 loop
    ok := companion_consume('enf-c-noah', 20);
    perform assert(ok, format('échange %s sur 20 accordé', i));
  end loop;

  ok := companion_consume('enf-c-noah', 20);
  perform assert(not ok, 'le vingt-et-unième échange est refusé');

  -- Et il reste refusé : le compteur ne se remet pas à zéro parce qu'on insiste.
  ok := companion_consume('enf-c-noah', 20);
  perform assert(not ok, 'insister ne rouvre pas le budget');

  perform assert(
    (select exchanges from companion_usage
      where child_id = 'enf-c-noah' and day = current_date) = 22,
    'chaque tentative reste comptée, même refusée'
  );

  perform assert(
    companion_left('enf-c-noah', 20) = 0,
    'il ne reste rien à dépenser'
  );
end $$;

\echo ''
\echo 'La marge des alertes'

do $$
declare ok boolean;
begin
  -- Une alerte reçoit toujours sa réponse, budget épuisé ou non : la fonction
  -- serveur appelle alors `companion_consume` avec 20 + 10. Un enfant qui dit
  -- quelque chose de grave ne doit jamais tomber sur « reviens demain ».
  ok := companion_consume('enf-c-noah', 30);
  perform assert(ok, 'une alerte passe au-delà du budget ordinaire');

  perform assert(
    (select exchanges from companion_usage
      where child_id = 'enf-c-noah' and day = current_date) = 23,
    'et elle est comptée comme le reste'
  );
end $$;

\echo ''
\echo 'Le remboursement d’un échange qui n’a rien donné'

do $$
declare avant integer; apres integer;
begin
  -- Le crédit est pris AVANT l'appel au modèle. Quand le modèle ne répond pas,
  -- il faut le rendre, sinon une panne de notre côté mange la journée d'un
  -- enfant qui n'a rien obtenu.
  select exchanges into avant from companion_usage
    where child_id = 'enf-c-noah' and day = current_date;
  perform companion_refund('enf-c-noah');
  select exchanges into apres from companion_usage
    where child_id = 'enf-c-noah' and day = current_date;
  perform assert(apres = avant - 1, 'un échange rendu, et un seul');

  -- Jamais en dessous de zéro, même en remboursant dans le vide.
  perform companion_consume('enf-c-lea', 20);
  for i in 1..5 loop perform companion_refund('enf-c-lea'); end loop;
  perform assert(
    (select exchanges from companion_usage
      where child_id = 'enf-c-lea' and day = current_date) = 0,
    'un compteur ne descend jamais sous zéro'
  );
end $$;

/* ============================================== qui peut appeler quoi */

\echo ''
\echo 'Session appareil (la tablette d’un enfant)'

set session role authenticated;
set session "mino.uid" = '55555555-5555-5555-5555-555555555555';

do $$ begin
  perform assert(not auth_is_parent(), 'un appareil n''est pas un parent');

  -- Le décompte est la seule chose qui empêche la facture de s'envoler : il
  -- doit être hors de portée du client, quoi qu'il tente.
  perform assert(
    refuses($sql$select companion_consume('enf-c-noah', 20)$sql$),
    'consommer un échange soi-même'
  );
  perform assert(
    refuses($sql$select companion_consume('enf-c-noah', 100000)$sql$),
    's''accorder un budget de cent mille'
  );
  perform assert(
    refuses($sql$select companion_refund('enf-c-noah')$sql$),
    'se rembourser un échange'
  );

  -- Écrire directement dans la table reviendrait au même.
  perform assert(
    refuses($sql$
      insert into companion_usage (child_id, day, exchanges)
      values ('enf-c-noah', current_date, 0)
      on conflict (child_id, day) do update set exchanges = 0
    $sql$),
    'remettre son propre compteur à zéro'
  );

  perform assert(
    (select count(*) = 0 from companion_usage),
    'lire la consommation, la sienne ou celle de son frère'
  );

  -- Le point délicat : tous les appareils enfants d'une famille partagent une
  -- même identité. Sans une politique réservée aux parents, la tablette de
  -- Noah lirait ce que Léa raconte à Mino.
  perform assert(
    (select count(*) = 0 from companion_messages),
    'lire les conversations, les siennes comme celles de sa sœur'
  );

  perform assert(
    refuses($sql$
      insert into companion_messages (child_id, family_id, role, text)
      values ('enf-c-noah', 'fam-c1', 'mino', 'Je te donne 100 minos')
    $sql$),
    'faire dire à Mino ce qu''il n''a pas dit'
  );

  -- Les purges appartiennent au planificateur, et à lui seul. Celle des
  -- appareils orphelins SUPPRIME DES COMPTES : ouverte à un client, elle
  -- deviendrait un bouton pour effacer les autres.
  perform assert(
    refuses($sql$select purge_companion_messages()$sql$),
    'effacer les conversations de toute la base'
  );
  perform assert(
    refuses($sql$select purge_join_attempts()$sql$),
    'effacer les tentatives de rattachement'
  );
  perform assert(
    refuses($sql$select purge_orphan_devices()$sql$),
    'supprimer des comptes'
  );

  -- Ce qu'un appareil A le droit de demander : combien il lui reste.
  perform assert(
    companion_left('enf-c-noah', 20) is not null,
    'demander ce qu''il lui reste'
  );
end $$;

\echo ''
\echo 'Session parent'

set session "mino.uid" = '44444444-4444-4444-4444-444444444444';

do $$ begin
  perform assert(auth_is_parent(), 'un parent est reconnu comme tel');

  perform assert(
    (select count(*) = 3 from companion_messages),
    'lire les conversations de ses enfants — les trois lignes de sa famille'
  );
  perform assert(
    (select count(*) = 0 from companion_messages where family_id = 'fam-c2'),
    'lire celles de la famille d''à côté'
  );
  perform assert(
    (select count(*) > 0 from companion_usage),
    'voir la consommation de ses enfants'
  );

  -- Un parent lit, il n'écrit pas : aucune politique d'insertion n'existe, et
  -- une conversation qu'un adulte pourrait fabriquer ne vaudrait plus rien
  -- comme trace.
  perform assert(
    refuses($sql$
      insert into companion_messages (child_id, family_id, role, text)
      values ('enf-c-noah', 'fam-c1', 'child', 'inventé')
    $sql$),
    'écrire dans les conversations'
  );

  perform assert(
    refuses($sql$delete from companion_messages where child_id = 'enf-c-noah'$sql$)
      or (select count(*) = 3 from companion_messages),
    'effacer une conversation à la main'
  );
end $$;

\echo ''
\echo 'Le parent d’à côté'

set session "mino.uid" = '66666666-6666-6666-6666-666666666666';

do $$ begin
  perform assert(
    (select count(*) = 1 from companion_messages),
    'ne voit que la sienne'
  );
  perform assert(
    (select count(*) = 0 from companion_messages where family_id = 'fam-c1'),
    'lire les conversations des Martin'
  );
  -- `companion_left` est SECURITY DEFINER : sans la clause `where exists` sur
  -- la famille, elle renseignerait n'importe qui sur n'importe quel enfant.
  perform assert(
    companion_left('enf-c-noah', 20) is null,
    'interroger le compteur d''un enfant d''une autre famille'
  );
end $$;

\echo ''
\echo 'Quand un parent coupe le compagnon'

reset role;
update children set companion_enabled = false where id = 'enf-c-lea';

set session role authenticated;
set session "mino.uid" = '55555555-5555-5555-5555-555555555555';

do $$ begin
  -- Le réglage est lu par la base, pas seulement par l'écran : couper le
  -- compagnon depuis la fiche de l'enfant doit fermer la porte, pas la cacher.
  perform assert(
    companion_left('enf-c-lea', 20) is null,
    'un enfant dont le compagnon est coupé garde un compteur interrogeable'
  );
  perform assert(
    companion_left('enf-c-noah', 20) is not null,
    'et cela ne change rien pour son frère'
  );
end $$;

reset role;
select seed_companion();

\echo ''
\echo 'Le budget et le secret tiennent.'
