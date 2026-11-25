-- Reta · avisos push: llave pública para el navegador y envío cada minuto.

-- La llave pública VAPID no es secreta: el navegador la necesita para suscribirse.
create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select value from private.config where key = 'vapid_public'
$$;
revoke execute on function public.push_public_key() from public;
grant execute on function public.push_public_key() to authenticated;

-- Llamada genérica a una función de Supabase (sin sesión). Reemplaza a _call_core.
create or replace function public._call_fn(p_name text, p_body jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare url text;
begin
  select value into url from private.config where key = 'functions_url';
  if url is null or not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 20000)'
    using url || '/' || p_name, p_body, '{"Content-Type":"application/json"}'::jsonb;
end $$;
revoke execute on function public._call_fn(text, jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reta-push', '* * * * *', $c$select public._call_fn('push')$c$);
  end if;
end $$;
