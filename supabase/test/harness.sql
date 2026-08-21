/**
 * Le strict nécessaire pour rejouer `schema.sql` sur un PostgreSQL nu.
 *
 * Supabase fournit `auth.users`, `auth.uid()`, les rôles et la publication de
 * temps réel. Rien de tout cela n'est du Mino, et rien de tout cela n'a besoin
 * d'être fidèle : ce qu'on veut vérifier, ce sont **nos** politiques. Le
 * remplaçant d'`auth.uid()` lit une variable de session, ce qui permet de
 * changer d'utilisateur au milieu d'un test.
 *
 * Voir `supabase/test/rls.sql` pour ce que ça sert à démontrer, et
 * `npm run test:sql`.
 */

create schema if not exists auth;

-- Les colonnes que le schéma Mino lit réellement, et rien de plus. Chez
-- Supabase la table en compte une trentaine ; en inventer d'autres ici ferait
-- passer des requêtes qui échoueraient en production.
create table if not exists auth.users (
  id           uuid primary key,
  email        text,
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now()
);

/** L'utilisateur courant, posé par le test via `set local mino.uid`. */
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('mino.uid', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select '{}'::jsonb;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

/**
 * Chez Supabase, `authenticated` a les droits SQL sur `public` et c'est la RLS
 * — elle seule — qui trace la frontière. On reproduit exactement cela : sans
 * ces droits, un test passerait pour la mauvaise raison, en butant sur un
 * refus de privilège au lieu d'une politique.
 */
/**
 * Le temps réel de Supabase : `scale.sql` pose ses politiques sur
 * `realtime.messages`. On n'en reproduit que la forme — une table et la
 * fonction `topic()` — pour que le fichier s'applique et que ses erreurs de
 * syntaxe se voient. Le comportement du canal, lui, ne se teste pas ici.
 */
create schema if not exists realtime;

create table if not exists realtime.messages (
  id         bigserial primary key,
  topic      text not null,
  extension  text,
  payload    jsonb,
  event      text,
  inserted_at timestamptz not null default now()
);

create or replace function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '');
$$;

create or replace function realtime.send(
  payload jsonb, event text, topic text, private boolean default true
) returns void language sql security definer as $$
  insert into realtime.messages (topic, event, payload) values (topic, event, payload);
$$;

-- Chez Supabase, `realtime.messages` est protégée par RLS : c'est ce qui rend
-- un canal « privé » privé, et c'est donc la moitié du test qui compte.
alter table realtime.messages enable row level security;
grant select on realtime.messages to anon, authenticated;

grant usage on schema public, realtime to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
