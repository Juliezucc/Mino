/**
 * Deux parents dans une famille — et un seul compte.
 *
 * Le second parent rejoint avec le CODE FAMILLE, comme le reste de la maison.
 * Sa ligne `parents` n'a ni `user_id` ni `email` : c'est un profil, pas un
 * compte. Le schéma le prévoyait déjà — « un parent qui n'a pas encore donné
 * son adresse n'en a pas, `null` le dit » — mais une seule fonction comptait
 * les parents sans faire la différence, et cette différence coûte la famille
 * entière.
 *
 * L'insertion elle-même ne passe pas par ici : `parents_insert` exige
 * `user_id = auth.uid()`, et il n'est pas question d'y toucher — c'est cette
 * clause qui empêche la tablette d'un enfant de se déclarer parent. La
 * fonction Edge `ajouter-parent` écrit la ligne avec la clé de service, après
 * avoir vérifié le code à quatre chiffres.
 *
 * À appliquer après `compte.sql`, dont il corrige une fonction.
 */

-- ------------------------------------------------------- supprimer (corrigé)

/**
 * Le défaut, et il rendait une famille indestructible.
 *
 * `delete_my_account()` décidait d'effacer la famille ou d'en retirer le
 * partant en comptant les lignes de `parents`. La règle est bonne — « si un
 * autre parent reste, la famille ne lui appartient pas moins qu'avant » — mais
 * elle a été écrite quand toute ligne `parents` portait un compte.
 *
 * Avec un second parent en profil, le compte à deux devenait faux dans les
 * deux sens à la fois : le titulaire du compte partait, sa ligne était
 * supprimée, et la famille restait — avec ses enfants, son historique et son
 * abonnement — rattachée à un profil que personne ne peut ouvrir. Plus aucune
 * session ne pouvait la lire, et plus aucune ne pouvait l'effacer. C'est-à-dire
 * exactement l'état que le commentaire d'origine décrivait comme celui à ne
 * jamais produire, et un refus de suppression au sens du RGPD comme de la
 * règle 5.1.1(v) d'Apple.
 *
 * On compte donc ce qui pouvait rouvrir la porte : les parents qui ont un
 * compte. Un profil ne survit pas à la famille — il pend à `families.id` par
 * une clé étrangère `on delete cascade`, et part avec elle.
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

  if not exists (select 1 from parents where user_id = moi) then
    raise exception 'Seul un parent peut supprimer un compte' using errcode = '42501';
  end if;

  for fam in select family_id from parents where user_id = moi loop
    -- `user_id is not null` : la clause entière tient dans ces quatre mots.
    -- Un profil sans compte ne peut pas hériter d'une famille, puisque
    -- personne ne peut s'y connecter pour la reprendre.
    if (
      select count(*) from parents where family_id = fam and user_id is not null
    ) <= 1 then
      delete from families where id = fam;
      effacees := effacees + 1;
    else
      delete from parents where family_id = fam and user_id = moi;
    end if;
  end loop;

  delete from auth.users where id = moi;

  return effacees;
end;
$$;

comment on function delete_my_account() is
  'Efface le compte appelant et, s''il en était le dernier parent AVEC UN COMPTE, sa famille entière. Les profils de parent sans compte partent avec la famille : ils ne peuvent pas en hériter.';

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
