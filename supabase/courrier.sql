/**
 * Ce que Mino a déjà écrit à chaque famille.
 *
 * **Le défaut que cette table empêche.** Un rappel envoyé deux fois est pire
 * qu'un rappel manqué : il dit au parent que personne ne tient les comptes
 * chez nous, à l'instant précis où on lui parle d'argent. Or les messages du
 * cycle de vie se déclenchent depuis plusieurs endroits — l'application après
 * l'inscription, une tâche planifiée pour les échéances — et rien ne garantit
 * qu'aucun ne se rejoue : un réseau qui hoquette, une fonction qui reprend, un
 * parent qui rouvre l'application au mauvais moment.
 *
 * La clé primaire porte donc la famille ET le genre du message. Ce n'est pas
 * une condition qu'on pourrait oublier d'écrire dans le code : c'est la base
 * qui refuse.
 *
 * Aucune politique de lecture n'est ouverte. Cette table ne sert qu'à la
 * fonction `courrier`, qui parle avec la clé de service ; personne d'autre n'a
 * de raison de savoir ce qu'on a écrit à qui, et surtout pas depuis un
 * appareil.
 */
create table if not exists courriers (
  family_id  text not null references families (id) on delete cascade,
  -- 'bienvenue', 'fin_essai', 'reconduction' — la liste vit dans la fonction,
  -- pas ici : une contrainte `check` obligerait à migrer la base à chaque
  -- message ajouté, pour une valeur qu'aucun client ne choisit librement.
  genre      text not null,
  sent_at    timestamptz not null default now(),
  primary key (family_id, genre)
);

alter table courriers enable row level security;

-- Volontairement sans politique : aucune n'existe, donc personne ne lit ni
-- n'écrit cette table à travers l'API. Seule la clé de service y accède, et
-- elle contourne RLS par construction.
