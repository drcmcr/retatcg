-- Reta · invitaciones personales
-- En torneos "solo con invitación", cada lugar seguro sale de un enlace personal de un solo uso.
-- El enlace general, el QR y el código solo dan acceso a la lista de espera. El staff puede
-- reacomodar lugares ("Pasar a espera" / "Dar lugar") hasta que abre el check-in.

create table public.tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- Secreto del enlace /i/<token>. 122 bits aleatorios; solo lo ve el staff del torneo.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Para quién es (lo escribe el staff; lo ve quien abre el enlace).
  label text not null check (char_length(label) between 1 and 30),
  status text not null default 'open' check (status in ('open', 'used', 'cancelled', 'expired')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  registration_id uuid references public.registrations (id) on delete set null
);
create index on public.tournament_invites (tournament_id, status);
alter table public.tournament_invites enable row level security;
create policy "tournament_invites: lo ve el staff" on public.tournament_invites for select to authenticated using (public.is_staff(tournament_id));
grant select on public.tournament_invites to authenticated;
revoke insert, update, delete on public.tournament_invites from authenticated;
revoke all on public.tournament_invites from anon;

-- ───────────── Utilidades ─────────────

create or replace function public._checkin_open(t public.tournaments)
returns boolean language sql stable set search_path = '' as $$
  select now() >= t.starts_at - make_interval(mins => t.checkin_minutes)
$$;

-- Lugares ocupados: inscritos, presentes y enlaces personales sin usar (están apartados).
create or replace function public._seats_taken(p_tournament uuid)
returns int language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.registrations where tournament_id = p_tournament and status in ('registered', 'checked_in'))::int
       + (select count(*) from public.tournament_invites where tournament_id = p_tournament and status = 'open')::int
$$;

-- Las mismas reglas que inscribirse normalmente.
create or replace function public._check_can_register(p_uid uuid, t public.tournaments)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if t.status <> 'registration' then raise exception 'La inscripción no está abierta.'; end if;
  if t.starts_at <= now() and t.pace->>'kind' = 'en_vivo' then raise exception 'El torneo ya empezó.'; end if;
  if exists (select 1 from public.sanctions where user_id = p_uid and suspended_until > now()) then
    raise exception 'Tu cuenta está suspendida para torneos hasta el %.',
      to_char((select max(suspended_until) from public.sanctions where user_id = p_uid), 'DD/MM');
  end if;
  if public._rank_index(public._user_pr(p_uid)) < t.min_rank then raise exception 'Este torneo pide un rango más alto.'; end if;
  if (select friend_id from public.profile_private where user_id = p_uid) is null then
    raise exception 'Agrega tu ID de amigo antes de inscribirte.';
  end if;
end $$;

-- ───────────── Inscripción ─────────────

-- En torneos con invitación, inscribirse sin enlace personal deja en lista de espera.
create or replace function public.register(p_tournament uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments; r public.registrations; st text;
begin
  select * into t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'La inscripción no está abierta.'; end if;
  perform public._check_can_register(uid, t);
  select * into r from public.registrations where tournament_id = p_tournament and user_id = uid;
  if found and r.status in ('registered', 'checked_in', 'waitlist') then return r.status; end if;
  st := case when t.invite_only or public._seats_taken(p_tournament) >= t.capacity then 'waitlist' else 'registered' end;
  insert into public.registrations (tournament_id, user_id, status) values (p_tournament, uid, st)
  on conflict (tournament_id, user_id) do update set status = excluded.status, created_at = now(), checked_in_at = null, dropped_at = null;
  return st;
end $$;

-- En torneos con invitación los lugares libres no se llenan solos antes del check-in:
-- el staff decide si manda otra invitación o le da el lugar a alguien de la espera.
create or replace function public._promote_waitlist(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record;
begin
  select * into t from public.tournaments where id = p_tournament;
  if t.invite_only then return; end if;
  while public._seats_taken(p_tournament) < t.capacity loop
    select * into r from public.registrations where tournament_id = p_tournament and status = 'waitlist' order by created_at limit 1 for update;
    exit when not found;
    update public.registrations set status = 'registered' where id = r.id;
    perform public._notify(r.user_id, 'torneo', 'Entraste a ' || t.name, 'Se liberó un lugar y ya estás inscrito.', '/torneo/' || t.code);
  end loop;
end $$;

-- ───────────── Invitaciones: staff ─────────────

-- Crea una invitación por cada nombre. No se puede apartar más lugares que el cupo.
create or replace function public.create_invites(p_tournament uuid, p_labels text[])
returns int language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments; l text; labels text[]; free int;
begin
  perform public._require_staff(p_tournament);
  select * into t from public.tournaments where id = p_tournament for update;
  if not t.invite_only then raise exception 'Activa "Solo con invitación" para usar enlaces personales.'; end if;
  if t.status not in ('draft', 'pending_approval', 'registration') then raise exception 'La inscripción ya cerró.'; end if;
  if public._checkin_open(t) then raise exception 'El check-in ya abrió: ya no se pueden mandar invitaciones.'; end if;
  select array_agg(x) into labels from (select trim(x) x from unnest(p_labels) x where trim(x) <> '') s;
  if coalesce(cardinality(labels), 0) = 0 then raise exception 'Escribe para quién es cada invitación.'; end if;
  foreach l in array labels loop
    if char_length(l) > 30 then raise exception 'Cada nombre lleva hasta 30 caracteres.'; end if;
    perform public._require_clean(l, 'invitado', 'El nombre de la invitación');
  end loop;
  free := t.capacity - public._seats_taken(p_tournament);
  if cardinality(labels) > free then
    raise exception 'Solo quedan % lugares libres. Cancela invitaciones sin usar o pasa a alguien a espera.', greatest(free, 0);
  end if;
  insert into public.tournament_invites (tournament_id, label, created_by) select p_tournament, x, uid from unnest(labels) x;
  perform public._audit(p_tournament, 'Creó invitaciones', jsonb_build_object('para', labels));
  return cardinality(labels);
end $$;

-- Cancelar: si no se usó, libera el lugar; si ya se usó, quien la usó pasa a lista de espera.
create or replace function public.cancel_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.tournament_invites; t public.tournaments; r public.registrations;
begin
  select * into i from public.tournament_invites where id = p_invite for update;
  if not found then raise exception 'No encontramos esa invitación.'; end if;
  perform public._require_staff(i.tournament_id);
  select * into t from public.tournaments where id = i.tournament_id;
  if i.status in ('cancelled', 'expired') then raise exception 'Esa invitación ya no está activa.'; end if;
  if i.status = 'used' then
    if t.status <> 'registration' or public._checkin_open(t) then
      raise exception 'El check-in ya abrió: los lugares ya no se pueden mover.';
    end if;
    select * into r from public.registrations where id = i.registration_id for update;
    if found and r.status = 'registered' then
      update public.registrations set status = 'waitlist', created_at = now() where id = r.id;
      perform public._notify(r.user_id, 'torneo', 'Cambio en ' || t.name,
        'El organizador reservó los lugares para sus invitados. Quedaste en lista de espera: si haces check-in y alguien falta, entras tú.', '/torneo/' || t.code);
    end if;
  end if;
  update public.tournament_invites set status = 'cancelled' where id = i.id;
  perform public._audit(i.tournament_id, 'Canceló una invitación', jsonb_build_object('para', i.label, 'estaba', i.status));
end $$;

-- Reacomodar lugares a mano: pasar a espera o dar lugar. Solo antes de que abra el check-in.
create or replace function public.staff_move(p_registration uuid, p_to text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.registrations; t public.tournaments;
begin
  select * into r from public.registrations where id = p_registration for update;
  if not found then raise exception 'No encontramos esa inscripción.'; end if;
  perform public._require_staff(r.tournament_id);
  select * into t from public.tournaments where id = r.tournament_id for update;
  if t.status <> 'registration' or public._checkin_open(t) then
    raise exception 'El check-in ya abrió: los lugares ya no se pueden mover.';
  end if;
  if p_to = 'waitlist' then
    if r.status <> 'registered' then raise exception 'Solo se puede pasar a espera a alguien con lugar.'; end if;
    update public.registrations set status = 'waitlist', created_at = now() where id = r.id;
    if r.user_id is not null then
      perform public._notify(r.user_id, 'torneo', 'Cambio en ' || t.name,
        'El organizador reacomodó los lugares. Quedaste en lista de espera: si haces check-in y alguien falta, entras tú.', '/torneo/' || t.code);
    end if;
  elsif p_to = 'registered' then
    if r.status <> 'waitlist' then raise exception 'Solo se le puede dar lugar a alguien en lista de espera.'; end if;
    if public._seats_taken(t.id) >= t.capacity then
      raise exception 'No hay lugar libre. Pasa a alguien a espera o cancela una invitación sin usar.';
    end if;
    update public.registrations set status = 'registered', checked_in_at = null where id = r.id;
    if r.user_id is not null then
      perform public._notify(r.user_id, 'torneo', 'Entraste a ' || t.name, 'El organizador te dio un lugar. Recuerda hacer check-in antes de empezar.', '/torneo/' || t.code);
    end if;
  else
    raise exception 'Acción desconocida.';
  end if;
  perform public._audit(r.tournament_id, case when p_to = 'waitlist' then 'Pasó a lista de espera' else 'Dio un lugar' end,
    jsonb_build_object('jugador', coalesce((select username::text from public.profiles where id = r.user_id), r.guest_name)));
end $$;

-- ───────────── Invitaciones: jugador ─────────────

-- Lo que ve quien abre el enlace (también sin sesión). No revela el enlace de nadie más.
create or replace function public.invite_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i public.tournament_invites; t public.tournaments; uid uuid := auth.uid(); st text;
begin
  select * into i from public.tournament_invites where token = p_token;
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  select * into t from public.tournaments where id = i.tournament_id;
  st := case
    when i.status = 'used' and i.used_by = uid then 'mine'
    when i.status = 'used' then 'used'
    when i.status = 'cancelled' then 'cancelled'
    when i.status = 'expired' or (i.status = 'open' and public._checkin_open(t)) then 'expired'
    when t.status in ('draft', 'pending_approval') then 'unpublished'
    when t.status <> 'registration' then 'closed'
    else 'open' end;
  return jsonb_build_object('state', st, 'label', i.label, 'code', t.code, 'name', t.name, 'club', t.club, 'starts_at', t.starts_at);
end $$;

create or replace function public.claim_invite(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); i public.tournament_invites; t public.tournaments; r public.registrations; reg_id uuid;
begin
  select * into i from public.tournament_invites where token = p_token for update;
  if not found then raise exception 'Esta invitación no existe. Revisa el enlace.'; end if;
  select * into t from public.tournaments where id = i.tournament_id for update;
  if i.status = 'used' and i.used_by = uid then return t.code; end if;
  if i.status = 'used' then raise exception 'Esta invitación ya la usó otra persona. Pídele una nueva al organizador.'; end if;
  if i.status = 'cancelled' then raise exception 'Esta invitación se canceló. Pídele una nueva al organizador.'; end if;
  if i.status = 'expired' or public._checkin_open(t) then raise exception 'Esta invitación venció porque ya abrió el check-in.'; end if;
  if t.status in ('draft', 'pending_approval') then raise exception 'El torneo todavía no se publica. Intenta más tarde.'; end if;
  perform public._check_can_register(uid, t);
  select * into r from public.registrations where tournament_id = t.id and user_id = uid for update;
  -- Si ya tiene lugar, no gasta la invitación (el organizador puede mandarla a alguien más).
  if found and r.status in ('registered', 'checked_in') then
    raise exception 'Ya tienes lugar en este torneo. Puedes devolverle este enlace al organizador para alguien más.';
  end if;
  insert into public.registrations (tournament_id, user_id, status) values (t.id, uid, 'registered')
  on conflict (tournament_id, user_id) do update set status = 'registered', created_at = now(), checked_in_at = null, dropped_at = null
  returning id into reg_id;
  update public.tournament_invites set status = 'used', used_by = uid, used_at = now(), registration_id = reg_id where id = i.id;
  perform public._notify(t.organizer_id, 'torneo', 'Invitación usada',
    '@' || (select username::text from public.profiles where id = uid) || ' usó la invitación para "' || i.label || '" en ' || t.name || '.', '/staff/torneo/' || t.id);
  perform public._audit(t.id, 'Usó una invitación', jsonb_build_object('para', i.label,
    'jugador', (select username::text from public.profiles where id = uid)));
  return t.code;
end $$;

-- ───────────── Check-in ─────────────

-- Al cerrar el check-in, las invitaciones sin usar vencen y sus lugares pasan a la lista de espera.
create or replace function public._close_checkin(p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record; free int; no_shows int := 0; promoted int := 0;
begin
  select * into t from public.tournaments where id = p_tournament for update;
  update public.tournament_invites set status = 'expired' where tournament_id = p_tournament and status = 'open';
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

-- ───────────── Permisos ─────────────

revoke execute on function public._seats_taken(uuid), public._check_can_register(uuid, public.tournaments), public._checkin_open(public.tournaments)
  from public, anon, authenticated;
revoke execute on function public.create_invites(uuid, text[]), public.cancel_invite(uuid), public.staff_move(uuid, text), public.claim_invite(text) from public, anon;
grant execute on function public.create_invites(uuid, text[]), public.cancel_invite(uuid), public.staff_move(uuid, text), public.claim_invite(text) to authenticated;
revoke execute on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
