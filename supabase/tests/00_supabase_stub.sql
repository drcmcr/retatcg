-- Solo para pruebas locales: imita lo mínimo de Supabase (roles, auth, storage, realtime).
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema extensions; create schema storage;
create extension citext with schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema auth, extensions, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant execute on function auth.uid(), auth.role() to anon, authenticated;
