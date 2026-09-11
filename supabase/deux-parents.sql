/**
 * Deux parents dans une famille — et un seul compte.
 *
 * Le second parent rejoint avec le CODE FAMILLE, comme le reste de la maison.
 * Sa ligne `parents` porte le `user_id` de SON appareil — c'est ce qui en fait
 * un parent aux yeux de `auth_is_parent()`, donc quelqu'un qui peut créer une
 * mission et pas seulement les regarder — mais elle n'a pas d'`email` : c'est
 * un parent, pas un compte. Le schéma le prévoyait déjà — « un parent qui n'a pas encore donné
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
 * Avec un second parent, le compte à deux devenait faux : le titulaire du
 * compte partait, sa ligne était supprimée, et la famille restait — avec ses
 * enfants, son historique et son abonnement — rattachée à quelqu'un qui ne
 * peut pas se reconnecter. Plus aucune session ne pouvait la rouvrir depuis un
 * autre téléphone, et plus aucune ne pouvait l'effacer. C'est-à-dire exactement
 * l'état que le commentaire d'origine décrivait comme celui à ne jamais
 * produire, et un refus de suppression au sens du RGPD comme de la règle
 * 5.1.1(v) d'Apple.
 *
 * **On compte les ADRESSES, et pas les `user_id`.** La nuance est tout le
 * correctif, et elle a failli m'échapper deux fois. Le second parent PORTE un
 * `user_id` — celui de son téléphone, c'est ce qui lui donne ses droits — mais
 * cette identité-là est anonyme : elle vit dans l'application installée sur cet
 * appareil, et rien ne permet de la retrouver ailleurs. Un téléphone reformaté,
 * et la famille serait perdue pour tout le monde. Ce qui permet de revenir,
 * c'est une adresse et un mot de passe. C'est donc cela qu'on compte.
 *
 * Un parent sans adresse ne survit pas à la famille : sa ligne pend à
 * `families.id` par une clé étrangère `on delete cascade`, et part avec elle.
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

  /**
   * Un parent AVEC UNE ADRESSE, et la nuance est devenue vitale.
   *
   * La clause d'origine — « une ligne `parents` à mon nom » — suffisait tant
   * qu'être parent voulait dire avoir un compte. Depuis qu'un second parent
   * rejoint par le code famille et porte le `user_id` de son téléphone,
   * `auth_is_parent()` répond oui pour lui : il franchissait ce garde, la
   * boucle trouvait sa famille, le compte des adresses donnait 1, et la
   * FAMILLE ENTIÈRE partait — enfants, historique, abonnement — effacée par
   * quelqu'un qui n'en est pas le titulaire. Un enfant qui aurait vu le code à
   * quatre chiffres pouvait faire la même chose.
   *
   * Supprimer un compte demande d'en avoir un. Un second parent qui veut s'en
   * aller se retire depuis « Les parents », ce qui ne touche à rien d'autre.
   */
  if not exists (
    select 1 from parents where user_id = moi and email is not null
  ) then
    raise exception 'Seul le titulaire du compte peut le supprimer' using errcode = '42501';
  end if;

  for fam in select family_id from parents where user_id = moi loop
    -- `email is not null` : la clause entière tient dans ces trois mots.
    -- Un parent sans adresse ne peut pas hériter d'une famille, puisque
    -- personne ne peut s'y reconnecter depuis un autre appareil pour la
    -- reprendre. Compter les `user_id` aurait laissé la famille à une
    -- identité anonyme, c'est-à-dire à personne.
    if (
      select count(*) from parents where family_id = fam and email is not null
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
  'Efface le compte appelant et, s''il en était le dernier parent AVEC UNE ADRESSE, sa famille entière. Un second parent sans adresse ne peut pas hériter d''une famille : son identité est celle de son téléphone, et rien ne permet de la retrouver ailleurs.';

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
