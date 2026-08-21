/**
 * De quoi remplir une base comme le ferait le produit, pour mesurer au lieu de
 * calculer.
 *
 * Les volumes reprennent exactement les hypothèses de `docs/ops/capacite.md` :
 * deux enfants par famille, trois missions validées par enfant et par jour,
 * une session et demie, et une transaction par mission validée comme par
 * session. Soit ~6 570 lignes de journal par famille et par an — le chiffre
 * annoncé dans le document, ici réellement écrit.
 *
 * Paramètres (psql -v) :
 *   familles         nombre de familles
 *   jours            ancienneté du parc, en jours
 *   anciennes        combien de familles ont trois ans d'ancienneté
 *   jours_anciennes  leur ancienneté à elles
 *
 * Les « anciennes » ne sont pas un détail : la seule requête dont le coût
 * grandit avec l'ancienneté d'une famille est `family_balances()`, qui somme
 * tout le grand livre. Mesurer la médiane du parc la ferait passer pour
 * gratuite. On mesure donc la famille la plus lourde, pas la plus banale.
 */

select set_config('mino.familles', :'familles', false);
select set_config('mino.jours', :'jours', false);
select set_config('mino.anciennes', :'anciennes', false);
select set_config('mino.jours_anciennes', :'jours_anciennes', false);

do $$
declare
  n_fam   int := current_setting('mino.familles')::int;
  j_std   int := current_setting('mino.jours')::int;
  n_anc   int := current_setting('mino.anciennes')::int;
  j_anc   int := current_setting('mino.jours_anciennes')::int;
  -- Par lots : un seul INSERT de soixante millions de lignes tient en mémoire
  -- sur cette machine et sur aucune autre.
  lot     int := 200;
  base    int;
  fin     int;
begin
  -- ------------------------------------------------------------- le socle

  insert into auth.users (id, email, created_at)
  select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
         'parent' || i || '@exemple.fr',
         now() - make_interval(days => case when i <= n_anc then j_anc else j_std end)
  from generate_series(1, n_fam) i;

  insert into families (id, name, code, referral_code, created_at)
  select 'fam_m5k2p7q9' || lpad(i::text, 6, '0'), 'Famille ' || i,
         'MINO-' || lpad(i::text, 6, '0'), 'R' || lpad(i::text, 7, '0'),
         now() - make_interval(days => case when i <= n_anc then j_anc else j_std end)
  from generate_series(1, n_fam) i;

  insert into parents (id, family_id, user_id, display_name, email)
  select 'parent_m5k2p7q9' || lpad(i::text, 6, '0'), 'fam_m5k2p7q9' || lpad(i::text, 6, '0'),
         ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
         'Parent ' || i, 'parent' || i || '@exemple.fr'
  from generate_series(1, n_fam) i;

  insert into children (id, family_id, first_name, age, avatar_key)
  select 'child_m5k2p7q9' || lpad(i::text, 5, '0') || k, 'fam_m5k2p7q9' || lpad(i::text, 6, '0'),
         case k when 1 then 'Léa' else 'Tom' end, 6 + k, 'renard'
  from generate_series(1, n_fam) i, generate_series(1, 2) k;

  insert into devices (id, family_id, label, kind)
  select 'dev_m5k2p7q9' || lpad(i::text, 5, '0') || k, 'fam_m5k2p7q9' || lpad(i::text, 6, '0'),
         case k when 1 then 'Console du salon' else 'Télévision' end,
         case k when 1 then 'console' else 'tv' end
  from generate_series(1, n_fam) i, generate_series(1, 2) k;

  -- Cinq missions, dont trois validées chaque jour : l'index unique interdit
  -- deux validations de la même mission le même jour, ce qui est justement la
  -- règle qu'on veut voir tenir sous volume.
  insert into missions (id, family_id, title, icon, minutes, created_by)
  select 'mission_m5k2p7q9' || lpad(i::text, 5, '0') || m, 'fam_m5k2p7q9' || lpad(i::text, 6, '0'),
         'Mission ' || m, '🧹', 10, 'parent_m5k2p7q9' || lpad(i::text, 6, '0')
  from generate_series(1, n_fam) i, generate_series(1, 5) m;

  insert into mission_assignments (id, mission_id, child_id)
  select 'asg_m5k2p7q' || lpad(i::text, 5, '0') || m || k, 'mission_m5k2p7q9' || lpad(i::text, 5, '0') || m, 'child_m5k2p7q9' || lpad(i::text, 5, '0') || k
  from generate_series(1, n_fam) i, generate_series(1, 5) m, generate_series(1, 2) k;

  insert into subscriptions (family_id, status, plan, current_period_end)
  select 'fam_m5k2p7q9' || lpad(i::text, 6, '0'), 'active', 'monthly', now() + interval '20 days'
  from generate_series(1, n_fam) i;

  -- Un parrainage pour une famille sur trois.
  insert into referrals (id, code, referrer_family_id, referee_family_id, status)
  select 'ref_m5k2p7q9' || lpad(i::text, 6, '0'), 'R' || lpad(i::text, 7, '0'), 'fam_m5k2p7q9' || lpad(i::text, 6, '0'), 'fam_m5k2p7q9' || lpad((i + 1)::text, 6, '0'), 'credited'
  from generate_series(1, n_fam - 1, 3) i;

  raise notice 'socle posé : % familles', n_fam;

  -- --------------------------------------------------------- les journaux

  base := 1;
  while base <= n_fam loop
    fin := least(base + lot - 1, n_fam);

    -- Trois missions validées par enfant et par jour.
    insert into mission_completions (
      id, family_id, assignment_id, mission_id, child_id,
      status, minutes_requested, minutes_awarded, completed_at, reviewed_at, reviewed_by
    )
    select
      'cmp_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || m,
      'fam_m5k2p7q9' || lpad(f::text, 6, '0'),
      'asg_m5k2p7q' || lpad(f::text, 5, '0') || m || k,
      'mission_m5k2p7q9' || lpad(f::text, 5, '0') || m,
      'child_m5k2p7q9' || lpad(f::text, 5, '0') || k,
      'approved', 10, 10,
      j.moment, j.moment + interval '5 minutes', 'parent_m5k2p7q9' || lpad(f::text, 6, '0')
    from generate_series(base, fin) f
    cross join lateral generate_series(0, (case when f <= n_anc then j_anc else j_std end) - 1) d
    cross join generate_series(1, 2) k
    cross join generate_series(1, 3) m
    cross join lateral (
      select date_trunc('day', now()) - make_interval(days => d) + make_interval(hours => 7 + 3 * m)
    ) as j(moment);

    -- La récompense de chacune : le grand livre ne connaît que des lignes.
    insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id, created_at)
    select
      'txn_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || m,
      'fam_m5k2p7q9' || lpad(f::text, 6, '0'), 'child_m5k2p7q9' || lpad(f::text, 5, '0') || k, 10, 'mission_reward', 'Mission ' || m,
      'cmp_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || m,
      j.moment + interval '5 minutes'
    from generate_series(base, fin) f
    cross join lateral generate_series(0, (case when f <= n_anc then j_anc else j_std end) - 1) d
    cross join generate_series(1, 2) k
    cross join generate_series(1, 3) m
    cross join lateral (
      select date_trunc('day', now()) - make_interval(days => d) + make_interval(hours => 7 + 3 * m)
    ) as j(moment);

    -- Une session et demie par enfant et par jour : un jour sur deux en porte
    -- une, l'autre deux. La moyenne est celle du document.
    insert into screen_time_sessions (
      id, family_id, child_id, requested_minutes, device_id,
      started_at, ends_at, status, ended_at, consumed_minutes
    )
    select
      'ses_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || s,
      'fam_m5k2p7q9' || lpad(f::text, 6, '0'), 'child_m5k2p7q9' || lpad(f::text, 5, '0') || k, 20,
      case when s = 1 then 'dev_m5k2p7q9' || lpad(f::text, 5, '0') || 1 else null end,
      j.moment, j.moment + interval '20 minutes', 'finished',
      j.moment + interval '20 minutes', 20
    from generate_series(base, fin) f
    cross join lateral generate_series(0, (case when f <= n_anc then j_anc else j_std end) - 1) d
    cross join generate_series(1, 2) k
    cross join generate_series(1, 3) s
    cross join lateral (
      select date_trunc('day', now()) - make_interval(days => d) + make_interval(hours => 17 + s)
    ) as j(moment)
    where (d + s) % 2 = 0;

    -- Et ce qu'elles ont coûté.
    insert into screen_time_transactions (id, family_id, child_id, delta, kind, reason, ref_id, created_at)
    select
      'txs_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || s,
      'fam_m5k2p7q9' || lpad(f::text, 6, '0'), 'child_m5k2p7q9' || lpad(f::text, 5, '0') || k, -20, 'screen_time_used', 'Écran',
      'ses_m5k' || lpad(f::text, 5, '0') || lpad(d::text, 4, '0') || k || s,
      j.moment + interval '20 minutes'
    from generate_series(base, fin) f
    cross join lateral generate_series(0, (case when f <= n_anc then j_anc else j_std end) - 1) d
    cross join generate_series(1, 2) k
    cross join generate_series(1, 3) s
    cross join lateral (
      select date_trunc('day', now()) - make_interval(days => d) + make_interval(hours => 17 + s)
    ) as j(moment)
    where (d + s) % 2 = 0;

    base := fin + 1;
    if (fin % 2000) = 0 then raise notice '  journaux : % familles', fin; end if;
  end loop;

  -- ------------------------------------------------- ce qui attend quelqu'un

  -- Deux missions déclarées et jamais relues, vieilles de deux cents jours.
  -- C'est la ligne que `load()` refuse de tronquer, et donc celle dont la
  -- requête doit rester rapide alors qu'elle sort de la fenêtre.
  insert into mission_completions (
    id, family_id, assignment_id, mission_id, child_id,
    status, minutes_requested, minutes_awarded, completed_at
  )
  select
    'cmp_m5p' || lpad(i::text, 5, '0') || '0000' || k || '9', 'fam_m5k2p7q9' || lpad(i::text, 6, '0'),
    'asg_m5k2p7q' || lpad(i::text, 5, '0') || (3 + k) || k,
    'mission_m5k2p7q9' || lpad(i::text, 5, '0') || (3 + k),
    'child_m5k2p7q9' || lpad(i::text, 5, '0') || k,
    'pending', 10, 0,
    date_trunc('day', now()) - interval '200 days' + make_interval(hours => 9 + k)
  from generate_series(1, n_fam) i, generate_series(1, 2) k;

  -- Une famille sur dix a un écran en cours ou une demande en attente.
  insert into screen_time_sessions (
    id, family_id, child_id, requested_minutes, device_id,
    started_at, ends_at, status, requested_at
  )
  select
    'ses_m5v' || lpad(i::text, 5, '0') || '000019', 'fam_m5k2p7q9' || lpad(i::text, 6, '0'), 'child_m5k2p7q9' || lpad(i::text, 5, '0') || 1, 20, 'dev_m5k2p7q9' || lpad(i::text, 5, '0') || 1,
    now(), now() + interval '20 minutes',
    (case when i % 20 = 0 then 'requested' else 'running' end)::session_status,
    now()
  from generate_series(10, n_fam, 10) i;

  raise notice 'journaux écrits';
end $$;
