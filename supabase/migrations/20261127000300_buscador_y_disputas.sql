-- Reta · buscador de jugadores para dar roles, y aviso al staff cuando se disputa un marcador.

-- Sugerencias por nombre de usuario. Solo para quien da roles: superadmin, organizadores y staff del torneo.
-- Devuelve lo mismo que ya es público en las tablas de torneo: usuario y rango. Nunca correo ni datos de Pocket.
create or replace function public.search_players(p_q text, p_tournament uuid default null)
returns table (id uuid, username text, rank_index int, role text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_q, '')));
        pat text;
begin
  if not (public.is_superadmin() or public.is_organizer()
          or (p_tournament is not null and public.is_staff(p_tournament))) then
    raise exception 'Solo el staff puede buscar jugadores.';
  end if;
  if length(q) < 2 or q !~ '^[a-z0-9._]+$' then return; end if;
  pat := replace(replace(q, '\', '\\'), '_', '\_');
  return query
    select p.id, p.username::text, public._rank_index(public._user_pr(p.id)),
      case when p_tournament is not null
           then (select s.role from public.tournament_staff s where s.tournament_id = p_tournament and s.user_id = p.id)
           else (select r.role from public.platform_roles r where r.user_id = p.id and r.role = 'organizer') end
    from public.profiles p
    where p.deleting_at is null and lower(p.username::text) like '%' || pat || '%'
    order by (lower(p.username::text) like pat || '%') desc, length(p.username::text), lower(p.username::text)
    limit 8;
end $$;
revoke all on function public.search_players(text, uuid) from public, anon;
grant execute on function public.search_players(text, uuid) to authenticated;

-- Casos que se abren solos (disputa de marcador, reportes distintos, desconexión, plazo vencido) ahora avisan
-- a todo el staff del torneo, igual que "Llamar juez" (que ya avisaba y por eso queda fuera).
create or replace function public._notify_staff_new_case()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s record; mesa text; what text;
begin
  select ' · Mesa ' || m.table_no into mesa from public.matches m where m.id = new.match_id;
  what := case new.kind when 'marcador' then 'disputa de marcador' when 'desconexion' then 'desconexión'
                        when 'plazo' then 'plazo vencido' else new.kind end;
  for s in select user_id from public.tournament_staff where tournament_id = new.tournament_id loop
    perform public._notify(s.user_id, 'staff', 'Caso #' || new.id || coalesce(mesa, '') || ': ' || what,
      case new.kind when 'marcador' then 'Los jugadores no están de acuerdo con el resultado.'
                    when 'desconexion' then 'Hubo una desconexión que necesita revisión.'
                    else 'Revisa el caso para decidir.' end,
      '/staff/torneo/' || new.tournament_id || '/casos/' || new.id);
  end loop;
  return new;
end $$;
revoke execute on function public._notify_staff_new_case() from public, anon, authenticated;

drop trigger if exists avisar_staff_caso on public.cases;
create trigger avisar_staff_caso after insert on public.cases
  for each row when (new.kind in ('marcador', 'desconexion', 'plazo'))
  execute function public._notify_staff_new_case();
