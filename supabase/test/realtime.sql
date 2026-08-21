/**
 * Le canal qui fait bouger le compteur sans rafraîchir.
 *
 * C'est lui qui tient la promesse visible du produit : le parent confirme sur
 * son téléphone, et la tablette de l'enfant passe de 35 à 50 toute seule. Rien
 * ne l'éprouvait.
 *
 * Deux choses se vérifient ici, et une troisième ne se vérifie pas :
 *
 * 1. **Le déclencheur émet, et sur le bon canal.** Le point délicat est
 *    `mission_assignments`, la seule des sept tables qui n'a pas de colonne
 *    `family_id` : la famille doit être retrouvée par l'enfant. Une erreur là
 *    et l'écran de l'enfant ne bouge plus, sans que rien ne signale la panne.
 * 2. **Le canal d'une famille n'est pas lisible par une autre.**
 * 3. Ce qui reste hors de portée : le vrai transport temps réel de Supabase.
 *    `realtime.send` est ici une doublure qui écrit dans une table.
 */

\set ON_ERROR_STOP on
\pset pager off

select seed();
delete from realtime.messages;

\echo ''
\echo 'Le déclencheur émet'

do $$
declare v_famille text; n integer;
begin
  select family_id into v_famille from children where id = 'enf-noah';

  -- Une confirmation de mission : le cas de référence.
  insert into mission_completions
    (id, family_id, assignment_id, mission_id, child_id, status,
     minutes_requested, minutes_awarded)
  values ('cmp-rt', v_famille, 'asg-chambre', 'mis-chambre', 'enf-noah',
          'pending', 15, 0);

  select count(*) into n from realtime.messages
    where topic = 'famille:' || v_famille;
  perform assert(n = 1, 'une complétion émet sur le canal de sa famille');

  perform assert(
    (select payload ->> 'table' from realtime.messages order by id desc limit 1)
      = 'mission_completions',
    'le message dit quelle table a changé'
  );

  perform assert(
    (select payload ->> 'op' from realtime.messages order by id desc limit 1) = 'insert',
    'et ce qui lui est arrivé'
  );

  -- Le message ne transporte pas la ligne : rien de sensible ne passe par le
  -- canal, et une confirmation coûte quelques dizaines d'octets.
  perform assert(
    (select not (payload ? 'minutes_awarded') from realtime.messages order by id desc limit 1),
    'le message ne transporte que le signal, jamais la ligne'
  );
end $$;

\echo ''
\echo 'La table sans family_id'

do $$
declare v_famille text; avant integer; apres integer;
begin
  select family_id into v_famille from children where id = 'enf-elliott';
  select count(*) into avant from realtime.messages where topic = 'famille:' || v_famille;

  -- `mission_assignments` est la seule des sept tables à ne pas porter la
  -- famille : elle se déduit de l'enfant. C'est la branche du déclencheur qui
  -- casserait sans qu'on s'en aperçoive.
  insert into mission_assignments (id, mission_id, child_id)
    values ('asg-rt', 'mis-chambre', 'enf-elliott');

  select count(*) into apres from realtime.messages where topic = 'famille:' || v_famille;
  perform assert(apres = avant + 1, 'une assignation retrouve la famille par l''enfant');
end $$;

\echo ''
\echo 'Une famille n’écoute pas le canal d’une autre'

set session role authenticated;
set session "mino.uid" = '11111111-1111-1111-1111-111111111111';

do $$
declare v_sienne text; v_autre text;
begin
  select family_id into v_sienne from children where id = 'enf-noah';
  v_autre := 'fam-2';

  perform set_config('realtime.topic', 'famille:' || v_sienne, true);
  perform assert(
    (select count(*) > 0 from realtime.messages),
    'écouter le canal de sa propre famille'
  );

  perform set_config('realtime.topic', 'famille:' || v_autre, true);
  perform assert(
    (select count(*) = 0 from realtime.messages),
    'écouter le canal de la famille d''à côté'
  );

  -- Un nom de canal qui n'est pas celui d'une famille ne donne rien non plus.
  perform set_config('realtime.topic', 'tout', true);
  perform assert(
    (select count(*) = 0 from realtime.messages),
    'écouter un canal qui n''est pas celui d''une famille'
  );
end $$;

reset role;
delete from realtime.messages;
delete from mission_assignments where id = 'asg-rt';
delete from mission_completions where id = 'cmp-rt';

\echo ''
\echo 'Le canal tient.'
