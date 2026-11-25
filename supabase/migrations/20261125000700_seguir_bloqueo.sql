-- Reta · un bloqueo impide volver a seguir, en cualquier dirección.
create or replace function public.follow(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = p_user) or (blocker = p_user and blocked = auth.uid())) then
    raise exception 'No puedes seguir a este jugador.';
  end if;
  insert into public.follows (follower, followee) values (public._me(), p_user) on conflict do nothing;
end $$;
