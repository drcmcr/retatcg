-- Reta · correos: cola de envío y bienvenida al crear la cuenta.
-- La función "mail" (Gmail SMTP) toma lo pendiente; la base solo decide qué y cuándo.

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('bienvenida')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique (user_id, kind)
);
create index if not exists email_outbox_pending on public.email_outbox (send_after) where status = 'pending';
alter table public.email_outbox enable row level security;  -- sin políticas: nadie la lee desde la app
revoke all on public.email_outbox from anon, authenticated;

-- Bienvenida al terminar el registro. Espera 3 minutos: si en ese rato se inscribe a un torneo, el correo ya lo trae.
create or replace function public._queue_welcome()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_outbox (user_id, kind, send_after) values (new.id, 'bienvenida', now() + interval '3 minutes')
  on conflict (user_id, kind) do nothing;
  return new;
end $$;
revoke execute on function public._queue_welcome() from public, anon, authenticated;

drop trigger if exists bienvenida_por_correo on public.profiles;
create trigger bienvenida_por_correo after insert on public.profiles
  for each row execute function public._queue_welcome();

-- Solo despierta a la función cuando hay algo listo para mandar.
create or replace function public._send_pending_mail()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.email_outbox where status = 'pending' and send_after <= now()) then
    perform public._call_fn('mail');
  end if;
end $$;
revoke execute on function public._send_pending_mail() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reta-correos', '* * * * *', 'select public._send_pending_mail()');
  end if;
end $$;
