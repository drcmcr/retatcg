-- Reta · eliminar torneos que nunca se jugaron (borradores y cancelados sin rondas).
-- Un torneo que ya tuvo rondas se queda: sus resultados son historial de los jugadores.

create or replace function public._can_delete_tournament(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_id and t.status in ('draft', 'cancelled')
      and not exists (select 1 from public.rounds r where r.tournament_id = t.id)
      and (public.is_superadmin()
           or exists (select 1 from public.tournament_staff s
                      where s.tournament_id = t.id and s.user_id = (select auth.uid()) and s.role = 'organizer'))
  )
$$;

create or replace function public.delete_tournament(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments;
begin
  perform public._me();
  select * into t from public.tournaments where id = p_id for update;
  if t.id is null then raise exception 'No encontramos ese torneo.'; end if;
  if t.status not in ('draft', 'cancelled') then raise exception 'Solo se eliminan borradores y torneos cancelados. Cancélalo primero.'; end if;
  if exists (select 1 from public.rounds r where r.tournament_id = p_id) then
    raise exception 'Este torneo ya tuvo rondas: se queda en el historial de los jugadores.';
  end if;
  if not public._can_delete_tournament(p_id) then raise exception 'Solo el organizador del torneo puede eliminarlo.'; end if;
  -- Avisos que llevaban a este torneo (ya no tendrían a dónde ir).
  delete from public.notifications n
  where n.link = '/torneo/' || t.code or n.link like '/torneo/' || t.code || '/%'
     or n.link like '/staff/torneo/' || p_id || '%';
  delete from public.tournaments where id = p_id;  -- inscripciones, staff, invitaciones, mazos y bitácora se van en cascada
  perform public._audit(null, 'Eliminó el torneo', jsonb_build_object('torneo', t.name, 'codigo', t.code, 'estado', t.status));
end $$;

revoke all on function public._can_delete_tournament(uuid) from public, anon;
revoke all on function public.delete_tournament(uuid) from public, anon;
grant execute on function public._can_delete_tournament(uuid) to authenticated;
grant execute on function public.delete_tournament(uuid) to authenticated;

-- Para borrar las capturas de mazo del torneo antes de eliminarlo (la app lo hace con la API de Storage).
create policy "borrar capturas de un torneo que se elimina" on storage.objects for delete to authenticated
  using (bucket_id = 'capturas' and public._can_delete_tournament(((storage.foldername(name))[1])::uuid));
