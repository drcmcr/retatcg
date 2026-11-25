-- Reta · funciones de apoyo y RLS
-- Regla general: lectura por políticas; ninguna tabla acepta insert/update/delete directo desde el cliente.

create or replace function public.is_superadmin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_roles r where r.user_id = uid and r.role = 'superadmin')
$$;

create or replace function public.is_organizer(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_roles r where r.user_id = uid and r.role in ('organizer', 'superadmin'))
$$;

-- Organizador del torneo, juez del torneo o superadmin.
create or replace function public.is_staff(t uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and (
    exists (select 1 from public.tournaments x where x.id = t and x.organizer_id = uid)
    or exists (select 1 from public.tournament_staff s where s.tournament_id = t and s.user_id = uid)
    or public.is_superadmin(uid)
  )
$$;

-- ¿El usuario juega en esta mesa?
create or replace function public.is_match_player(m uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.matches mm
    join public.registrations r on r.id in (mm.a, mm.b)
    where mm.id = m and r.user_id = uid
  )
$$;

create or replace function public.can_see_match_private(m uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_match_player(m, uid)
      or public.is_staff((select tournament_id from public.matches where id = m), uid)
$$;

-- RLS en todo.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','profile_private','platform_roles','seasons','player_seasons','titles','tournaments',
    'tournament_staff','registrations','rounds','matches','match_secrets','match_events','availability',
    'cases','case_messages','deck_declarations','sanctions','results','follows','blocks','notifications',
    'push_subscriptions','mod_reports','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Lo público también se lee sin cuenta (vista pública del torneo y tarjetas compartidas).
grant select on public.profiles, public.seasons, public.player_seasons, public.titles, public.tournaments,
  public.tournament_staff, public.registrations, public.rounds, public.matches, public.results to anon;

create policy "perfiles públicos" on public.profiles for select using (deleting_at is null or id = auth.uid());
create policy "solo yo" on public.profile_private for select using (user_id = auth.uid());
create policy "mis roles" on public.platform_roles for select using (user_id = auth.uid() or public.is_superadmin());
create policy "temporadas" on public.seasons for select using (true);
create policy "pr de temporada" on public.player_seasons for select using (
  user_id = auth.uid()
  or not exists (select 1 from public.profiles p where p.id = user_id and (p.is_private or p.deleting_at is not null))
);
create policy "títulos" on public.titles for select using (true);

create policy "torneos visibles" on public.tournaments for select using (
  status not in ('draft', 'pending_approval') or public.is_staff(id)
);
create policy "staff visible" on public.tournament_staff for select using (true);
create policy "inscritos" on public.registrations for select using (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.status not in ('draft', 'pending_approval'))
  or public.is_staff(tournament_id)
);
create policy "rondas" on public.rounds for select using (true);
create policy "mesas" on public.matches for select using (true);
create policy "contraseña de mesa" on public.match_secrets for select using (public.can_see_match_private(match_id));
create policy "registro de mesa" on public.match_events for select using (public.can_see_match_private(match_id));
create policy "disponibilidad" on public.availability for select using (public.can_see_match_private(match_id));
create policy "casos" on public.cases for select using (
  public.is_staff(tournament_id) or opened_by = auth.uid() or (match_id is not null and public.is_match_player(match_id))
);
create policy "mensajes de caso" on public.case_messages for select using (
  exists (select 1 from public.cases c where c.id = case_id and (
    public.is_staff(c.tournament_id) or c.opened_by = auth.uid() or (c.match_id is not null and public.is_match_player(c.match_id))
  ))
);
create policy "mazos" on public.deck_declarations for select using (
  public.is_staff(tournament_id)
  or exists (select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid())
);
create policy "sanciones" on public.sanctions for select using (
  user_id = auth.uid() or is_public or public.is_staff(tournament_id) or public.is_superadmin()
);
create policy "resultados" on public.results for select using (true);
create policy "seguidos" on public.follows for select using (follower = auth.uid() or followee = auth.uid());
create policy "bloqueos" on public.blocks for select using (blocker = auth.uid());
create policy "avisos" on public.notifications for select using (user_id = auth.uid());
create policy "suscripciones" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "reportes" on public.mod_reports for select using (reporter = auth.uid() or public.is_superadmin());
create policy "auditoría" on public.audit_log for select using (
  (tournament_id is not null and public.is_staff(tournament_id)) or public.is_superadmin()
);

-- Ninguna función queda abierta al público por defecto.
alter default privileges in schema public revoke execute on functions from public;
revoke execute on all functions in schema public from public;
grant execute on function public.is_superadmin(uuid), public.is_organizer(uuid), public.is_staff(uuid, uuid),
  public.is_match_player(uuid, uuid), public.can_see_match_private(uuid, uuid) to anon, authenticated;
