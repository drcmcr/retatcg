-- Reta · tiempo real, capturas y tareas programadas

-- Tiempo real: la app escucha estos cambios (las políticas RLS siguen aplicando).
do $$
declare t text;
begin
  foreach t in array array['tournaments','registrations','rounds','matches','match_secrets','match_events',
                           'availability','cases','case_messages','notifications','deck_declarations'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Capturas (mazos y casos): privadas. Ruta: <torneo>/<usuario>/<archivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capturas', 'capturas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "subir mis capturas" on storage.objects for insert to authenticated
  with check (bucket_id = 'capturas' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "ver capturas propias o como staff" on storage.objects for select to authenticated
  using (bucket_id = 'capturas' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.is_staff(((storage.foldername(name))[1])::uuid)
  ));

-- Configuración por entorno (no secreta): la URL de las funciones se guarda aquí con un insert por entorno.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);

-- Confirmación automática: si el rival no responde a tiempo, el reporte queda confirmado.
create or replace function public._auto_confirm()
returns int language plpgsql security definer set search_path = '' as $$
declare m record; n int := 0;
begin
  for m in
    select mm.id, mm.tournament_id, mm.reported_by from public.matches mm
    join public.tournaments t on t.id = mm.tournament_id
    where mm.status = 'reported'
      and mm.reported_at + make_interval(mins => coalesce(t.confirm_minutes, case when t.pace->>'kind' = 'ventana' then 60 else 5 end)) < now()
    for update of mm skip locked
  loop
    insert into public.match_events (match_id, kind, data) values (m.id, 'confirmación automática', '{}');
    perform public._confirm(m.id, 'auto');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Cuentas que pidieron borrarse hace más de 7 días.
create or replace function public._purge_deleted_accounts()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from auth.users where id in (select id from public.profiles where deleting_at is not null and deleting_at < now());
  get diagnostics n = row_count;
  return n;
end $$;

-- Llama a la función "core" (plazos por ventana, rondas automáticas). Si no hay URL configurada, no hace nada.
create or replace function public._call_core(p_body jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare url text;
begin
  select value into url from private.config where key = 'functions_url';
  if url is null or not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 20000)'
    using url || '/core', p_body, '{"Content-Type":"application/json"}'::jsonb;
end $$;

revoke execute on function public._auto_confirm(), public._purge_deleted_accounts(), public._call_core(jsonb) from public, anon, authenticated;

-- Tareas cada minuto (solo donde existen pg_cron y pg_net, es decir, en Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron;
    perform cron.schedule('reta-confirmar', '* * * * *', 'select public._auto_confirm()');
    perform cron.schedule('reta-core', '* * * * *', $c$select public._call_core('{"action":"tick"}'::jsonb)$c$);
    perform cron.schedule('reta-borrar-cuentas', '17 4 * * *', 'select public._purge_deleted_accounts()');
  end if;
end $$;
