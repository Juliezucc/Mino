/**
 * Prévenir l'autre bout de la boucle, quand l'application est fermée.
 *
 * Mino savait déjà quoi dire et quand : `domain/notifications.ts` porte les
 * textes, les règles de silence et les deux publics. Mais tout partait
 * **localement**, sur l'appareil qui venait d'agir — c'est-à-dire à la seule
 * personne qui était déjà au courant.
 *
 * Concrètement : un enfant termine une mission à 19 h, le parent ne l'apprend
 * qu'en rouvrant Mino. Le parent valide à 21 h, l'enfant ne le découvre que le
 * lendemain matin. Or la boucle ne tient que si les deux bouts l'entendent :
 * un enfant qui attend jusqu'au lendemain cesse de relier l'effort à la
 * récompense, et c'est précisément la chose que ce produit existe pour relier.
 *
 * Une table, et rien de plus. `family_devices` sait déjà quel enfant un
 * appareil affiche, `parents` sait déjà qui est parent : il n'y a donc aucune
 * notion de rôle à dupliquer ici. Un jeton, une famille, un compte.
 */

create table if not exists push_tokens (
  -- Un compte, un appareil. Un parent qui installe Mino sur un second
  -- téléphone ouvre une seconde session, donc une seconde ligne.
  user_id    uuid primary key references auth.users (id) on delete cascade,
  family_id  text not null references families (id) on delete cascade,
  -- Le jeton d'Expo, pas celui d'Apple : c'est le service d'Expo qui parle à
  -- APNs, et c'est lui qui détient la clé.
  token      text not null,
  updated_at timestamptz not null default now()
);

-- L'envoi lit toujours par famille, jamais par compte.
create index if not exists idx_push_tokens_family on push_tokens (family_id);

alter table push_tokens enable row level security;

/**
 * CHACUN NE VOIT QUE LE SIEN — pas ceux de sa famille, pas ceux de ses enfants.
 *
 * Un jeton de notification est une adresse d'appareil : qui l'obtient peut
 * écrire à l'appareil d'un enfant, avec le texte de son choix. Il n'y a aucune
 * raison qu'un client lise ceux des autres. Seule la fonction serveur `notify`,
 * qui tourne avec la clé de service, les consulte tous.
 *
 * **Pourquoi une politique de lecture existe quand même**, alors que l'intention
 * était « personne » : `insert … on conflict do update` doit LIRE la ligne en
 * conflit pour savoir qu'il y en a une. Sans politique de lecture, elle est
 * invisible, la fusion se croit neuve, et PostgreSQL refuse — « new row violates
 * row-level security policy », sur une ligne pourtant parfaitement légitime.
 *
 * Le client réécrit son jeton à chaque démarrage, donc la fusion est le chemin
 * normal. Lire son propre jeton ne révèle rien : c'est lui qui vient de
 * l'écrire.
 */
drop policy if exists push_tokens_select on push_tokens;
create policy push_tokens_select on push_tokens
  for select using (user_id = auth.uid());

drop policy if exists push_tokens_insert on push_tokens;
create policy push_tokens_insert on push_tokens
  for insert with check (
    user_id = auth.uid()
    and family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

/**
 * La mise à jour existe pour une seule raison, et elle n'est pas théorique :
 * un jeton d'appareil change. Après une réinstallation, une restauration de
 * sauvegarde, parfois une mise à jour d'iOS. Le client réécrit donc le sien à
 * chaque démarrage, par une fusion.
 *
 * Les deux politiques sont nécessaires **ensemble** : `insert … on conflict do
 * update` fait appliquer par PostgreSQL la clause de la politique de MISE À
 * JOUR à la ligne neuve. Une seule des deux, et la fusion échoue — c'est
 * exactement le défaut qui empêchait de créer une famille.
 */
drop policy if exists push_tokens_update on push_tokens;
create policy push_tokens_update on push_tokens
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and family_id = any (coalesce((select auth_family_ids_array()), '{}'::text[]))
  );

-- Se déconnecter, c'est cesser de recevoir. Sans cela, le téléphone revendu
-- continuerait d'être prévenu des missions d'une famille qui n'est plus la
-- sienne.
drop policy if exists push_tokens_delete on push_tokens;
create policy push_tokens_delete on push_tokens
  for delete using (user_id = auth.uid());
