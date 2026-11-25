-- Reta · asistencia a torneos y cuentas inactivas.
-- 1) Quien se inscribe y no hace check-in cuenta como falta; 2 faltas en la temporada = 7 días sin inscribirse.
-- 2) La lista de espera también hace check-in y ocupa los lugares de quien no llegó.
-- 3) Recordatorio 24 h antes y al abrir el check-in.
-- 4) Quien pierde una mesa por no presentarse sale del torneo.
-- 5) Métricas de actividad para el superadmin y limpieza de cuentas sin uso.

-- ───────────── Esquema ─────────────

alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('registered', 'waitlist', 'checked_in', 'dropped', 'removed', 'no_show'));

alter table public.tournaments add column if not exists reminded_24h_at timestamptz;
alter table public.tournaments add column if not exists reminded_checkin_at timestamptz;

alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists inactive_warned_at timestamptz;

-- Para poder borrar una cuenta sin romper registros que otros necesitan: estas referencias quedan vacías.
alter table public.platform_roles drop constraint if exists platform_roles_granted_by_fkey,
  add constraint platform_roles_granted_by_fkey foreign key (granted_by) references public.profiles (id) on delete set null;
alter table public.tournaments drop constraint if exists tournaments_approved_by_fkey,
  add constraint tournaments_approved_by_fkey foreign key (approved_by) references public.profiles (id) on delete set null;
alter table public.cases drop constraint if exists cases_judge_id_fkey,
  add constraint cases_judge_id_fkey foreign key (judge_id) references public.profiles (id) on delete set null;
alter table public.deck_declarations drop constraint if exists deck_declarations_reviewed_by_fkey,
  add constraint deck_declarations_reviewed_by_fkey foreign key (reviewed_by) references public.profiles (id) on delete set null;
alter table public.sanctions drop constraint if exists sanctions_created_by_fkey,
  add constraint sanctions_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.mod_reports drop constraint if exists mod_reports_handled_by_fkey,
  add constraint mod_reports_handled_by_fkey foreign key (handled_by) references public.profiles (id) on delete set null;

-- ───────────── Faltas ─────────────

create or replace function public._season_no_shows(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.registrations r join public.tournaments t on t.id = r.tournament_id
  where r.user_id = p_user and r.status = 'no_show' and t.season_id is not distinct from public._current_season();
$$;

-- Anota la falta, avisa y, desde la segunda en la temporada, bloquea inscripciones 7 días.
create or replace function public._register_no_show(p_user uuid, t public.tournaments)
returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_user is null then return; end if;
  n := public._season_no_shows(p_user);
  if n >= 2 then
    insert into public.sanctions (user_id, tournament_id, season_id, kind, reason, is_public, suspended_until)
    values (p_user, t.id, public._current_season(), 'suspension', 'Faltas sin aviso: ' || n || ' en la temporada', false, now() + interval '7 days');
    perform public._notify(p_user, 'sancion', 'No puedes inscribirte a torneos durante 7 días',
      'Llevas ' || n || ' faltas sin aviso esta temporada. Si no puedes llegar, date de baja antes: así no cuenta.', '/perfil');
  else
    perform public._notify(p_user, 'torneo', 'No hiciste check-in en ' || t.name,
      'Es tu primera falta de la temporada; con la segunda no podrás inscribirte durante 7 días. Si no puedes llegar, date de baja antes: así no cuenta.', '/torneo/' || t.code);
  end if;
end $$;

-- Cierra el check-in al empezar el torneo: faltas, lugares liberados a la lista de espera presente, y limpieza.
-- La llama la función "core" dentro de la misma transacción que empareja la primera ronda.
create or replace function public._close_checkin(p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record; free int; no_shows int := 0; promoted int := 0;
begin
  select * into t from public.tournaments where id = p_tournament for update;
  if t.pace->>'kind' = 'ventana' then
    -- Por ventana no hay check-in en vivo: la inscripción basta y no hay faltas.
    update public.registrations set status = 'checked_in', checked_in_at = now() where tournament_id = p_tournament and status = 'registered';
  else
    for r in update public.registrations set status = 'no_show'
             where tournament_id = p_tournament and status = 'registered' returning user_id loop
      no_shows := no_shows + 1;
      perform public._register_no_show(r.user_id, t);
    end loop;
  end if;
  free := t.capacity - (select count(*) from public.registrations where tournament_id = p_tournament and status = 'checked_in');
  for r in select id, user_id from public.registrations
           where tournament_id = p_tournament and status = 'waitlist' and checked_in_at is not null
           order by created_at limit greatest(free, 0) loop
    update public.registrations set status = 'checked_in' where id = r.id;
    promoted := promoted + 1;
    perform public._notify(r.user_id, 'torneo', 'Entraste a ' || t.name, 'Alguien no llegó y su lugar es tuyo. Te avisamos cuando salga tu mesa.', '/torneo/' || t.code);
  end loop;
  for r in update public.registrations set status = 'removed'
           where tournament_id = p_tournament and status = 'waitlist' returning user_id loop
    perform public._notify(r.user_id, 'torneo', 'No alcanzaste lugar en ' || t.name, 'El torneo empezó con el cupo lleno. No cuenta como falta.', '/torneo/' || t.code);
  end loop;
  return jsonb_build_object('faltas', no_shows, 'de_espera', promoted);
end $$;

-- Check-in: también para la lista de espera (queda presente por si se libera un lugar).
drop function if exists public.checkin(uuid);
create or replace function public.checkin(p_tournament uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments; st text;
begin
  select * into t from public.tournaments where id = p_tournament;
  if t.status <> 'registration' then raise exception 'El check-in no está abierto.'; end if;
  if now() < t.starts_at - make_interval(mins => t.checkin_minutes) then
    raise exception 'El check-in abre a las %.', to_char((t.starts_at - make_interval(mins => t.checkin_minutes)) at time zone 'America/Mexico_City', 'HH24:MI');
  end if;
  update public.registrations set status = case when status = 'registered' then 'checked_in' else status end, checked_in_at = now()
  where tournament_id = p_tournament and user_id = uid and status in ('registered', 'waitlist')
  returning status into st;
  if st is null then raise exception 'No tienes un lugar en este torneo.'; end if;
  return st;
end $$;

-- Recordatorios: 24 h antes y al abrir el check-in (torneos en vivo y por jornadas). Corre cada minuto.
create or replace function public._tournament_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record; n int := 0; hora text;
begin
  for t in select * from public.tournaments
           where status = 'registration' and pace->>'kind' in ('en_vivo', 'jornadas')
             and reminded_24h_at is null and starts_at <= now() + interval '24 hours' and starts_at > now() + interval '2 hours'
           for update skip locked loop
    hora := to_char(t.starts_at at time zone 'America/Mexico_City', 'HH24:MI');
    for r in select user_id from public.registrations where tournament_id = t.id and status in ('registered', 'waitlist') and user_id is not null loop
      perform public._notify(r.user_id, 'torneo',
        case when (t.starts_at at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date then 'Hoy a las ' else 'Mañana a las ' end || hora || ': ' || t.name,
        '¿Sigues dentro? Si ya no puedes, toca "Ya no puedo ir" para liberar tu lugar. Así no cuenta como falta.', '/torneo/' || t.code);
      n := n + 1;
    end loop;
    update public.tournaments set reminded_24h_at = now() where id = t.id;
  end loop;

  for t in select * from public.tournaments
           where status = 'registration' and pace->>'kind' in ('en_vivo', 'jornadas') and reminded_checkin_at is null
             and now() >= starts_at - make_interval(mins => checkin_minutes) and now() < starts_at
           for update skip locked loop
    hora := to_char(t.starts_at at time zone 'America/Mexico_City', 'HH24:MI');
    for r in select user_id, status from public.registrations where tournament_id = t.id and status in ('registered', 'waitlist') and user_id is not null loop
      perform public._notify(r.user_id, 'torneo', 'Abrió el check-in de ' || t.name,
        case when r.status = 'waitlist' then 'Estás en lista de espera: haz check-in antes de las ' || hora || ' y si alguien falta, entras tú.'
             else 'Hazlo antes de las ' || hora || '. Si no, cuenta como falta. ¿Ya no puedes? Date de baja.' end,
        '/torneo/' || t.code || '/checkin');
      n := n + 1;
    end loop;
    update public.tournaments set reminded_checkin_at = now() where id = t.id;
  end loop;
  return n;
end $$;

-- ───────────── No presentarse a una mesa ─────────────

-- Saca del torneo a quien no se presentó a su mesa (ya no lo emparejan).
create or replace function public._drop_absent(p_registration uuid, p_round int)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.registrations; t public.tournaments;
begin
  update public.registrations set status = 'dropped', dropped_at = now()
  where id = p_registration and status = 'checked_in' returning * into r;
  if not found then return; end if;
  select * into t from public.tournaments where id = r.tournament_id;
  perform public._notify(r.user_id, 'torneo', 'Saliste de ' || t.name,
    'No te presentaste a tu mesa de la ronda ' || p_round || ', así que ya no te emparejamos. Si fue un error, habla con el juez.', '/torneo/' || t.code);
  perform public._audit(t.id, 'Retiro por no presentarse',
    jsonb_build_object('jugador', coalesce((select username::text from public.profiles where id = r.user_id), r.guest_name), 'ronda', p_round));
end $$;

-- El juez marca que alguien no se presentó: gana su rival y el ausente sale del torneo.
create or replace function public.staff_no_show(p_match uuid, p_absent uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; r public.rounds; win int;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'No encontramos esa mesa.'; end if;
  perform public._require_staff(m.tournament_id);
  if p_absent not in (m.a, coalesce(m.b, m.a)) or m.b is null then raise exception 'Ese jugador no está en esta mesa.'; end if;
  select * into r from public.rounds where id = m.round_id;
  if r.status = 'closed' then raise exception 'La ronda ya cerró.'; end if;
  win := ceil(r.best_of / 2.0);
  update public.matches set games_a = case when p_absent = m.b then win else 0 end, games_b = case when p_absent = m.a then win else 0 end,
    game_draws = 0, double_loss = false where id = m.id;
  perform public._confirm(m.id, 'juez');
  perform public._drop_absent(p_absent, r.number);
  perform public._audit(m.tournament_id, 'No se presentó en la mesa ' || m.table_no,
    jsonb_build_object('jugador', (select coalesce(p.username::text, g.guest_name) from public.registrations g left join public.profiles p on p.id = g.user_id where g.id = p_absent)));
end $$;

-- ───────────── Actividad y métricas ─────────────

-- La app la llama al abrir pantallas con sesión (como mucho una vez cada 12 h).
create or replace function public.touch_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now(), inactive_warned_at = null
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '12 hours' or inactive_warned_at is not null);
$$;

-- Faltas y torneos jugados de cada inscrito, para el staff del torneo.
create or replace function public.tournament_attendance(p_tournament uuid)
returns table (user_id uuid, played int, no_shows int) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_staff(p_tournament);
  return query
    select r.user_id,
      (select count(*)::int from public.registrations x join public.tournaments y on y.id = x.tournament_id
        where x.user_id = r.user_id and x.status in ('checked_in', 'dropped') and y.status in ('running', 'finished')),
      (select count(*)::int from public.registrations x where x.user_id = r.user_id and x.status = 'no_show')
    from public.registrations r where r.tournament_id = p_tournament and r.user_id is not null;
end $$;

create or replace function public.platform_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if not public.is_superadmin() then raise exception 'Solo el superadmin ve las métricas.'; end if;
  with played as (
    select x.user_id, count(*) as n, max(coalesce(y.started_at, y.starts_at)) as last_played
    from public.registrations x join public.tournaments y on y.id = x.tournament_id
    where x.user_id is not null and x.status in ('checked_in', 'dropped') and y.status in ('running', 'finished')
    group by x.user_id
  ), activity as (
    select p.id, greatest(p.created_at, coalesce(p.last_seen_at, p.created_at),
      coalesce((select max(created_at) from public.registrations where user_id = p.id), p.created_at)) as last_active
    from public.profiles p
  )
  select jsonb_build_object(
    'cuentas', (select count(*) from auth.users),
    'perfiles', (select count(*) from public.profiles),
    'con_id_amigo', (select count(*) from public.profile_private where friend_id is not null),
    'jugaron_1', (select count(*) from played),
    'jugaron_2', (select count(*) from played where n >= 2),
    'activos_7', (select count(*) from activity where last_active > now() - interval '7 days'),
    'activos_30', (select count(*) from activity where last_active > now() - interval '30 days'),
    'jugaron_30', (select count(*) from played where last_played > now() - interval '30 days'),
    'repiten_semana', (select count(distinct x.user_id) from public.registrations x join public.tournaments y on y.id = x.tournament_id
        where x.status in ('checked_in', 'dropped') and coalesce(y.started_at, y.starts_at) > now() - interval '7 days'
          and x.user_id in (select x2.user_id from public.registrations x2 join public.tournaments y2 on y2.id = x2.tournament_id
            where x2.status in ('checked_in', 'dropped') and coalesce(y2.started_at, y2.starts_at) between now() - interval '14 days' and now() - interval '7 days')),
    'asistencia', (select jsonb_build_object('llegaron', count(*) filter (where r.status in ('checked_in', 'dropped')), 'faltas', count(*) filter (where r.status = 'no_show'))
        from public.registrations r join public.tournaments y on y.id = r.tournament_id
        where y.status in ('running', 'finished') and y.season_id is not distinct from public._current_season()),
    'sin_registro_completo', (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)),
    'aviso_inactividad', (select count(*) from public.profiles where inactive_warned_at is not null)
  ) into res;
  return res;
end $$;

-- ───────────── Borrado y limpieza de cuentas ─────────────

-- Borra cuentas sin romper torneos pasados: sus inscripciones quedan como "Jugador eliminado".
-- No borra a quien organizó torneos (sus torneos lo necesitan); a esa cuenta solo le quita los datos privados.
create or replace function public._delete_accounts(p_ids uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.registrations set guest_name = 'Jugador eliminado' where user_id = any (p_ids) and guest_name is null;
  delete from public.profile_private where user_id = any (p_ids) and user_id in (select organizer_id from public.tournaments);
  delete from auth.users where id = any (p_ids) and id not in (select organizer_id from public.tournaments);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public._purge_deleted_accounts()
returns int language plpgsql security definer set search_path = '' as $$
begin
  return public._delete_accounts(array(select id from public.profiles where deleting_at is not null and deleting_at < now()));
end $$;

-- Diario: registros sin terminar (7 días), aviso por 12 meses sin uso y borrado 30 días después del aviso.
create or replace function public._cleanup_accounts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare stale int; warned int := 0; removed int; r record;
begin
  delete from auth.users u where u.created_at < now() - interval '7 days'
    and not exists (select 1 from public.profiles p where p.id = u.id);
  get diagnostics stale = row_count;

  for r in select p.id from public.profiles p
           where p.inactive_warned_at is null and p.deleting_at is null
             and greatest(p.created_at, coalesce(p.last_seen_at, p.created_at),
                 coalesce((select max(created_at) from public.registrations where user_id = p.id), p.created_at)) < now() - interval '12 months' loop
    update public.profiles set inactive_warned_at = now() where id = r.id;
    perform public._notify(r.id, 'cuenta', 'Tu cuenta se borrará en 30 días',
      'No has usado Reta en un año. Entra a la app para conservarla; si no, borramos tus datos.', '/perfil');
    warned := warned + 1;
  end loop;

  removed := public._delete_accounts(array(
    select id from public.profiles where inactive_warned_at < now() - interval '30 days'
      and coalesce(last_seen_at, created_at) < inactive_warned_at));
  return jsonb_build_object('sin_terminar', stale, 'avisadas', warned, 'borradas', removed);
end $$;

-- ───────────── Permisos y tareas ─────────────

revoke execute on function public._season_no_shows(uuid), public._register_no_show(uuid, public.tournaments), public._close_checkin(uuid),
  public._tournament_reminders(), public._drop_absent(uuid, int), public._delete_accounts(uuid[]), public._cleanup_accounts()
  from public, anon, authenticated;
revoke execute on function public.staff_no_show(uuid, uuid), public.touch_seen(), public.tournament_attendance(uuid), public.platform_metrics(), public.checkin(uuid) from public, anon;
grant execute on function public.staff_no_show(uuid, uuid), public.touch_seen(), public.tournament_attendance(uuid), public.platform_metrics(), public.checkin(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reta-recordatorios', '* * * * *', 'select public._tournament_reminders()');
    perform cron.schedule('reta-limpiar-cuentas', '37 4 * * *', 'select public._cleanup_accounts()');
  end if;
end $$;
