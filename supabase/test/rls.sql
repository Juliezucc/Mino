/**
 * Ce que les politiques RLS tiennent, démontré en les attaquant.
 *
 * Écrit après avoir ajouté la validation automatique, qui donne pour la
 * première fois à un appareil d'enfant le droit d'écrire des minutes. Un droit
 * pareil ne se relit pas, il s'éprouve : chaque cas ci-dessous est une tentative
 * précise, et le test échoue si elle passe.
 *
 * Deux sessions jouent : `parent` (une ligne dans `parents`) et `appareil` (une
 * ligne dans `family_devices` seulement). C'est exactement la différence que
 * `auth_is_parent()` regarde.
 *
 * Lancer avec `npm run test:sql`.
 */

\set ON_ERROR_STOP on
\pset pager off

-- --------------------------------------------------------------- outillage

create or replace function assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if not ok then raise exception 'ÉCHEC — %', what; end if;
  raise notice '  ok · %', what;
end $$;

/**
 * Lit une valeur sans passer par RLS.
 *
 * Indispensable pour éprouver une écriture repoussée : la session qui vient
 * d'essayer ne voit pas la ligne qu'elle visait, donc elle ne peut pas
 * constater elle-même que rien n'a bougé. Sans ce lecteur, l'assertion passe
 * au vert en lisant `null`, et elle y passerait tout autant si la protection
 * tombait.
 */
create or replace function brut(sql text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare valeur text;
begin
  execute sql into valeur;
  return valeur;
end $$;

/** Joue une écriture et dit si la base l'a refusée. */
create or replace function refuses(sql text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;
exception
  when insufficient_privilege or unique_violation or check_violation
    or foreign_key_violation or raise_exception then return true;
end $$;

-- ------------------------------------------------------------- la famille

create or replace function seed() returns void language plpgsql
security definer set search_path = public, auth as $$
begin
  delete from families where id in ('fam-1', 'fam-2', 'fam-anon');
  delete from auth.users where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    -- Le fondateur anonyme : il n'a pas d'adresse, et c'est tout le sujet.
    '44444444-4444-4444-4444-444444444444'
  );

  insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'julie@mino.app'),
    ('22222222-2222-2222-2222-222222222222', 'tablette@mino.app'),
    ('33333333-3333-3333-3333-333333333333', 'autre@mino.app'),
    ('44444444-4444-4444-4444-444444444444', null);

  insert into families (id, name, code, referral_code) values
    ('fam-1', 'Martin', 'MARTIN1', 'PARRAIN1'),
    ('fam-2', 'Voisins', 'VOISIN1', 'PARRAIN2');

  insert into parents (id, family_id, user_id, display_name, email) values
    ('par-1', 'fam-1', '11111111-1111-1111-1111-111111111111', 'Julie', 'julie@mino.app'),
    ('par-2', 'fam-2', '33333333-3333-3333-3333-333333333333', 'Voisin', 'autre@mino.app');

  -- La tablette du salon : membre de la famille, mais pas parent.
  insert into family_devices (id, family_id, user_id, joined_at)
    values ('fd-1', 'fam-1', '22222222-2222-2222-2222-222222222222', now());

  insert into children (id, family_id, first_name, age, avatar_key) values
    ('enf-noah', 'fam-1', 'Noah', 8, 'fox'),
    ('enf-elliott', 'fam-1', 'Elliott', 6, 'frog'),
    ('enf-voisin', 'fam-2', 'Inconnu', 9, 'lion');

  insert into missions (id, family_id, title, icon, minutes, auto_approve, created_by) values
    ('mis-dents', 'fam-1', 'Me brosser les dents', '🪥', 5, true, 'par-1'),
    ('mis-chambre', 'fam-1', 'Ranger ma chambre', '🧸', 15, false, 'par-1'),
    ('mis-elliott', 'fam-1', 'Ranger mes chaussures', '👟', 5, true, 'par-1');

  insert into mission_assignments (id, mission_id, child_id) values
    ('asg-dents', 'mis-dents', 'enf-noah'),
    ('asg-chambre', 'mis-chambre', 'enf-noah'),
    -- Assignée à Elliott, et à lui seul : c'est ce qui permet de vérifier
    -- qu'un enfant ne peut pas se compter la mission de son frère.
    ('asg-elliott', 'mis-elliott', 'enf-elliott');
end $$;

select seed();

-- ============================================================ l'appareil

\echo ''
\echo 'Session appareil (ni parent, ni enfant authentifié)'

set session role authenticated;
set session "mino.uid" = '22222222-2222-2222-2222-222222222222';

do $$ begin
  perform assert(not auth_is_parent(), 'un appareil n''est pas un parent');
  perform assert(
    array['fam-1'] = (select array_agg(f) from auth_family_ids() f),
    'un appareil ne voit qu''une famille : la sienne'
  );
end $$;

-- --- Ce qu'un appareil a le droit de faire ---------------------------------

do $$ begin
  perform assert(
    not refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded)
      values ('cmp-demande', 'fam-1', 'asg-chambre', 'mis-chambre', 'enf-noah',
              'pending', 15, 0)
    $sql$),
    'déclarer une mission qui attend confirmation'
  );

  perform assert(
    not refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded)
      values ('cmp-auto', 'fam-1', 'asg-dents', 'mis-dents', 'enf-noah',
              'approved', 5, 5)
    $sql$),
    'compter une mission que le parent a ouverte'
  );

  perform assert(
    not refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id)
      values ('tx-auto', 'fam-1', 'enf-noah', 5, 'mission_reward',
              'Me brosser les dents', 'cmp-auto')
    $sql$),
    'écrire les minutes de cette mission-là'
  );

  perform assert(
    not refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
      values ('tx-conso', 'fam-1', 'enf-noah', -20, 'screen_time_used', 'Temps d''écran utilisé')
    $sql$),
    'décompter du temps consommé'
  );
end $$;

-- --- Ce qu'un appareil ne doit jamais pouvoir faire ------------------------

\echo ''
\echo 'Les tentatives, une par une'

do $$ begin
  -- Le fond du sujet : le solde est la somme du registre, donc rejouer la
  -- même récompense revient à s'imprimer des minutes.
  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id)
      values ('tx-rejeu', 'fam-1', 'enf-noah', 5, 'mission_reward',
              'Me brosser les dents', 'cmp-auto')
    $sql$),
    'rejouer deux fois la récompense d''une même mission accomplie'
  );

  perform assert(
    refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded)
      values ('cmp-auto-2', 'fam-1', 'asg-dents', 'mis-dents', 'enf-noah',
              'approved', 5, 5)
    $sql$),
    'compter deux fois la même mission dans la journée'
  );

  perform assert(
    refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded)
      values ('cmp-vol', 'fam-1', 'asg-chambre', 'mis-chambre', 'enf-noah',
              'approved', 15, 15)
    $sql$),
    'se compter une mission que le parent veut confirmer'
  );

  perform assert(
    refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded)
      values ('cmp-frere', 'fam-1', 'asg-elliott', 'mis-elliott', 'enf-noah',
              'approved', 5, 5)
    $sql$),
    'se compter une mission confiée à son frère'
  );

  perform assert(
    refuses($sql$
      insert into mission_completions
        (id, family_id, assignment_id, mission_id, child_id, status,
         minutes_requested, minutes_awarded, reviewed_by)
      values ('cmp-signe', 'fam-1', 'asg-dents', 'mis-dents', 'enf-elliott',
              'approved', 5, 5, 'par-1')
    $sql$),
    'signer du nom d''un parent une mission que personne n''a vérifiée'
  );

  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
      values ('tx-cadeau', 'fam-1', 'enf-noah', 120, 'bonus', 'Cadeau')
    $sql$),
    's''offrir un bonus'
  );

  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
      values ('tx-correction', 'fam-1', 'enf-noah', 999, 'parent_adjustment', 'Correction')
    $sql$),
    's''écrire une correction'
  );

  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id)
      values ('tx-gonfle', 'fam-1', 'enf-noah', 300, 'mission_reward', 'Me brosser les dents', 'cmp-auto')
    $sql$),
    'gonfler le montant d''une mission qui se compte toute seule'
  );

  perform assert(
    refuses($sql$update missions set auto_approve = true where id = 'mis-chambre'$sql$)
      or (select not auto_approve from missions where id = 'mis-chambre'),
    'ouvrir soi-même la confirmation d''une mission'
  );

  perform assert(
    refuses($sql$update missions set minutes = 600 where id = 'mis-dents'$sql$)
      or (select minutes = 5 from missions where id = 'mis-dents'),
    'augmenter ce que rapporte une mission'
  );

  perform assert(
    refuses($sql$
      update mission_completions set status = 'approved', minutes_awarded = 15
      where id = 'cmp-demande'
    $sql$)
      or (select status = 'pending' from mission_completions where id = 'cmp-demande'),
    'confirmer soi-même une demande en attente'
  );

  perform assert(
    (select count(*) = 0 from children where family_id = 'fam-2'),
    'voir un enfant d''une autre famille'
  );

  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
      values ('tx-voisin', 'fam-2', 'enf-voisin', 60, 'bonus', 'Chez le voisin')
    $sql$),
    'écrire chez une autre famille'
  );
end $$;

-- =============================================================== le parent

\echo ''
\echo 'Session parent'

set session "mino.uid" = '11111111-1111-1111-1111-111111111111';

do $$ begin
  perform assert(auth_is_parent(), 'un parent est reconnu comme tel');

  perform assert(
    not refuses($sql$
      update mission_completions
        set status = 'approved', minutes_awarded = 15, reviewed_by = 'par-1', reviewed_at = now()
      where id = 'cmp-demande'
    $sql$),
    'confirmer une demande'
  );

  perform assert(
    not refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id)
      values ('tx-chambre', 'fam-1', 'enf-noah', 15, 'mission_reward', 'Ranger ma chambre', 'cmp-demande')
    $sql$),
    'écrire les minutes correspondantes'
  );

  -- Même un parent : deux récompenses pour une seule mission accomplie est une
  -- erreur, et la base la refuse quelle que soit la main qui l'écrit.
  perform assert(
    refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id)
      values ('tx-chambre-2', 'fam-1', 'enf-noah', 15, 'mission_reward', 'Ranger ma chambre', 'cmp-demande')
    $sql$),
    'payer deux fois la même mission accomplie'
  );

  perform assert(
    not refuses($sql$
      insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason)
      values ('tx-bonus', 'fam-1', 'enf-noah', 30, 'bonus', 'Bravo')
    $sql$),
    'offrir un bonus'
  );

  perform assert(
    refuses($sql$
      update screen_time_transactions set delta = 900 where id = 'tx-bonus'
    $sql$)
      or (select delta = 30 from screen_time_transactions where id = 'tx-bonus'),
    'réécrire une ligne du registre — même pour un parent'
  );

  perform assert(
    (select count(*) = 0 from children where family_id = 'fam-2'),
    'voir les enfants de la famille d''à côté'
  );
end $$;

-- ============================================ le parent pas encore identifié

/**
 * Le premier écran du parcours d'inscription, avant toute adresse.
 *
 * `docs/ops/parcours-inscription.md` fait créer la famille et le premier
 * enfant AVANT de demander son e-mail au parent : il voit sa famille exister
 * d'abord. Entre les deux il est authentifié, mais anonymement — Supabase
 * ouvre une session sans adresse.
 *
 * Tout le parcours repose donc sur une question à laquelle on ne pouvait pas
 * répondre en lisant les politiques : **une session anonyme a-t-elle le droit
 * de fonder une famille ?** Si la réponse est non, il n'y a pas de parcours du
 * tout, et mieux vaut le savoir avant d'écrire quatre écrans.
 *
 * L'appartenance se lit dans `parents` **ou** dans `family_devices`
 * (`auth_family_ids()`). Un fondateur n'a ni l'un ni l'autre : sa ligne
 * `parents` doit donc exister dès le premier écran, sans nom et sans adresse —
 * d'où les deux `not null` retirés dans `schema.sql`.
 */

\echo ''
\echo 'Session anonyme — le parent qui n''a pas encore donné son adresse'

set session "mino.uid" = '44444444-4444-4444-4444-444444444444';

do $$ begin
  perform assert(not auth_is_parent(), 'un anonyme n''est encore le parent de personne');

  perform assert(
    0 = (select count(*) from auth_family_ids() f),
    'il n''appartient à aucune famille'
  );

  -- Écran 1 : fonder la famille.
  perform assert(
    not refuses($sql$
      insert into families (id, name, code, referral_code)
      values ('fam-anon', 'Nouvelle', 'ANON001', 'PARRAIN9')
    $sql$),
    'fonder une famille'
  );

  -- Sans nom et sans e-mail : il ne les a pas encore donnés.
  perform assert(
    not refuses($sql$
      insert into parents (id, family_id, user_id, display_name, email, consent_at)
      values ('par-anon', 'fam-anon', '44444444-4444-4444-4444-444444444444',
              null, null, now())
    $sql$),
    's''inscrire comme parent, sans nom ni adresse'
  );

  perform assert(
    array['fam-anon'] = (select array_agg(f) from auth_family_ids() f),
    'il voit alors la famille qu''il vient de fonder'
  );

  -- Écran 1, suite : l'enfant, qui est la raison d'être de tout l'écran.
  perform assert(
    not refuses($sql$
      insert into children (id, family_id, first_name, age, avatar_key)
      values ('enf-anon', 'fam-anon', 'Lou', 7, 'fox')
    $sql$),
    'ajouter son premier enfant'
  );
end $$;

-- --- Ce qu'une session anonyme ne doit pas pouvoir faire pour autant --------

do $$ begin
  perform assert(
    (select count(*) = 0 from children where family_id = 'fam-1'),
    'ne pas voir les enfants d''une famille qui n''est pas la sienne'
  );

  perform assert(
    refuses($sql$
      insert into parents (id, family_id, user_id, display_name, email)
      values ('par-vol', 'fam-1', '44444444-4444-4444-4444-444444444444', null, null)
    $sql$),
    's''inviter dans une famille existante en s''y déclarant parent'
  );

  /**
   * Ici on regarde l'effet, et non l'exception — et c'est une leçon à part
   * entière.
   *
   * Une politique RLS sur `update` ne refuse pas la commande : elle rend la
   * ligne invisible. La commande porte alors sur zéro ligne, aboutit
   * normalement, et ne lève rien du tout. `refuses()` répondrait donc « non »
   * pour une tentative parfaitement repoussée — et un test écrit sur ce
   * malentendu passe au vert le jour où la protection tombe.
   */
  perform refuses($sql$
    update parents set display_name = 'Voleur' where id = 'par-1'
  $sql$);
  perform assert(
    brut($q$select display_name from parents where id = 'par-1'$q$) = 'Julie',
    'modifier le parent d''une autre famille'
  );
end $$;

-- --- L'élévation de privilège que la tablette d'un enfant pouvait s'offrir --

/**
 * Le cas qui a motivé la reprise de `parents_insert`.
 *
 * La condition était `user_id = auth.uid()` — seulement. Elle vérifie qu'on
 * s'inscrit soi-même, jamais dans QUELLE famille. Or l'appareil d'un enfant
 * est authentifié et connaît l'identifiant de sa propre famille : il le lit
 * légitimement, il est dans ses données.
 *
 * Il lui suffisait d'écrire une ligne dans `parents` pour que
 * `auth_is_parent()` devienne vrai, et avec elle tout l'espace parent :
 * confirmer ses propres missions, s'accorder des minutes, supprimer un profil,
 * résilier l'abonnement. Chaque politique de ce fichier s'appuie sur cette
 * fonction ; aucune ne protégeait la fonction elle-même.
 */

\echo ''
\echo 'Session appareil — l''enfant qui essaie de se promouvoir parent'

set session "mino.uid" = '22222222-2222-2222-2222-222222222222';

do $$ begin
  perform assert(not auth_is_parent(), 'la tablette n''est pas parent, au départ');

  perform assert(
    array['fam-1'] = (select array_agg(f) from auth_family_ids() f),
    'elle connaît pourtant l''identifiant de sa famille — c''est normal'
  );

  perform assert(
    refuses($sql$
      insert into parents (id, family_id, user_id, display_name, email)
      values ('par-usurpe', 'fam-1', '22222222-2222-2222-2222-222222222222',
              'Moi', 'enfant@ruse.fr')
    $sql$),
    'SE DÉCLARER PARENT DE SA PROPRE FAMILLE'
  );

  perform assert(not auth_is_parent(), 'et elle ne l''est toujours pas');
end $$;

-- ------------------------------------------------------------- le total

\echo ''
\echo 'Le solde, qui est la somme de tout ce qui précède'

do $$
declare total int;
begin
  select coalesce(sum(delta), 0) into total
    from screen_time_transactions where child_id = 'enf-noah';
  -- 5 (dents) − 20 (consommé) + 15 (chambre) + 30 (bonus) = 30
  perform assert(total = 30, format('solde de Noah = 30 minutes (obtenu : %s)', total));
end $$;

reset role;
select seed();

\echo ''
\echo 'Toutes les tentatives ont été repoussées.'
