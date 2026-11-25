-- Reta · acciones (RPC)
-- Cada acción valida quién la pide y deja registro. Los mensajes de error van en español: la app los muestra tal cual.
-- Lo que necesita el motor del torneo (emparejar, cerrar plazos, PR y medallas) vive en la función "core".

-- ───────────── Utilidades internas ─────────────

create or replace function public._me()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para continuar.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Termina de crear tu cuenta para continuar.' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link where p_user is not null;
$$;

create or replace function public._audit(p_tournament uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (tournament_id, actor, action, detail) values (p_tournament, auth.uid(), p_action, p_detail);
$$;

-- Índice de rango a partir del PR (0 = Explorador … 5 = Maestro Cazador). Misma regla que packages/torneo: 300 PR por rango.
create or replace function public._rank_index(p_pr int)
returns int language sql immutable as $$ select least(greatest(coalesce(p_pr, 0), 0) / 300, 5) $$;

create or replace function public._current_season()
returns int language sql stable security definer set search_path = '' as $$
  select id from public.seasons where closed_at is null and now() between starts_at and ends_at order by id desc limit 1
$$;

create or replace function public._user_pr(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select pr from public.player_seasons where user_id = p_user and season_id = public._current_season()), 0)
$$;

-- Contraseña de 8 caracteres sin letras que se confunden (0/O, 1/I/L).
create or replace function public._gen_password()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '' order by i)
  from (select extensions.gen_random_bytes(8) b) x, generate_series(0, 7) i
$$;

create or replace function public._gen_code(p_name text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  base text := upper(left(regexp_replace(translate(p_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^A-Za-z]', '', 'g'), 4));
  c text;
begin
  if char_length(base) < 2 then base := 'RETA'; end if;
  loop
    c := base || '-' || lpad((floor(random() * 100))::int::text, 2, '0');
    exit when not exists (select 1 from public.tournaments where code = c);
    base := base || substr('ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 23)::int, 1);
  end loop;
  return c;
end $$;

-- Filtro sencillo de groserías para usuarios (se amplía con datos reales).
create or replace function public._username_ok(p text)
returns boolean language sql immutable as $$
  select p ~ '^[A-Za-z0-9._]{3,16}$'
     and lower(p) !~ '(pendej|puto|puta|verga|chinga|culer|mierda|nazi|hitler|fuck|shit|bitch|nigg|marica|joto|admin|reta_?staff|juez)'
$$;

create or replace function public._require_staff(p_tournament uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._me();
  if not public.is_staff(p_tournament) then raise exception 'Solo el staff del torneo puede hacer esto.' using errcode = '42501'; end if;
end $$;

-- ───────────── Cuenta ─────────────

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public._username_ok(p_username)
     and not exists (select 1 from public.profiles where lower(username::text) = lower(p_username) and id <> coalesce(auth.uid(), gen_random_uuid()))
$$;

-- Beta solo para mayores de 18: si no cumple, la app llama a delete_minor_account y no se guarda nada.
create or replace function public.complete_onboarding(
  p_username text, p_birthdate date, p_pocket_name text, p_friend_id text, p_timezone text default 'America/Mexico_City'
) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicia sesión para continuar.'; end if;
  if exists (select 1 from public.profiles where id = uid) then raise exception 'Tu cuenta ya está creada.'; end if;
  if p_birthdate is null or p_birthdate > (current_date - interval '18 years')::date then
    raise exception 'La beta de Reta es solo para mayores de 18 años.' using errcode = 'P0018';
  end if;
  if p_birthdate < date '1900-01-01' then raise exception 'Revisa tu fecha de nacimiento.'; end if;
  if not public._username_ok(p_username) then
    raise exception 'El usuario debe tener de 3 a 16 caracteres: letras, números, punto o guion bajo.';
  end if;
  if exists (select 1 from public.profiles where lower(username::text) = lower(p_username)) then
    raise exception 'Ese usuario ya está ocupado.';
  end if;
  p_friend_id := regexp_replace(coalesce(p_friend_id, ''), '\D', '', 'g');
  if p_friend_id !~ '^[0-9]{16}$' then raise exception 'El ID de amigo tiene 16 números.'; end if;
  if char_length(trim(coalesce(p_pocket_name, ''))) not between 1 and 20 then raise exception 'Escribe tu nombre en Pocket.'; end if;

  insert into public.profiles (id, username) values (uid, p_username);
  insert into public.profile_private (user_id, birthdate, pocket_name, friend_id, timezone, terms_accepted_at)
  values (uid, p_birthdate, trim(p_pocket_name), p_friend_id, coalesce(nullif(p_timezone, ''), 'America/Mexico_City'), now());
  insert into public.player_seasons (season_id, user_id)
  select s, uid from (select public._current_season() s) x where s is not null;
end $$;

-- Quien no cumple la edad sale sin dejar datos: se borra el usuario de acceso.
create or replace function public.delete_minor_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if exists (select 1 from public.profiles where id = uid) then raise exception 'Esta cuenta ya está creada.'; end if;
  delete from auth.users where id = uid;
end $$;

create or replace function public.update_username(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); last timestamptz;
begin
  select username_changed_at into last from public.profiles where id = uid;
  if last is not null and last > now() - interval '30 days' then
    raise exception 'Puedes cambiar tu usuario de nuevo el %.', to_char(last + interval '30 days', 'DD/MM');
  end if;
  if not public.username_available(p_username) then raise exception 'Ese usuario no está disponible.'; end if;
  update public.profiles set username = p_username, username_changed_at = now() where id = uid;
end $$;

create or replace function public.set_title(p_medal text, p_form text default 'a')
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  if p_medal is not null and not exists (select 1 from public.titles where user_id = uid and medal = p_medal) then
    raise exception 'Todavía no desbloqueas ese título.';
  end if;
  update public.profiles set title_medal = p_medal, title_form = coalesce(p_form, 'a') where id = uid;
end $$;

create or replace function public.set_private_profile(p_private boolean)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set is_private = p_private where id = public._me();
$$;

create or replace function public.update_private_data(
  p_pocket_name text, p_friend_id text, p_timezone text, p_notify jsonb default null, p_reduce_motion boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  p_friend_id := regexp_replace(coalesce(p_friend_id, ''), '\D', '', 'g');
  if p_friend_id !~ '^[0-9]{16}$' then raise exception 'El ID de amigo tiene 16 números.'; end if;
  update public.profile_private set
    pocket_name = trim(p_pocket_name), friend_id = p_friend_id,
    timezone = coalesce(nullif(p_timezone, ''), timezone),
    notify = coalesce(p_notify, notify), reduce_motion = coalesce(p_reduce_motion, reduce_motion)
  where user_id = uid;
end $$;

create or replace function public.request_account_deletion()
returns timestamptz language sql security definer set search_path = '' as $$
  update public.profiles set deleting_at = now() + interval '7 days' where id = public._me() returning deleting_at;
$$;

create or replace function public.cancel_account_deletion()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set deleting_at = null where id = public._me();
$$;

-- Todo lo que Reta guarda de ti, para descargarlo.
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'perfil', (select to_jsonb(p) from public.profiles p where id = public._me()),
    'privado', (select to_jsonb(x) from public.profile_private x where user_id = auth.uid()),
    'temporadas', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.player_seasons s where user_id = auth.uid()),
    'titulos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.titles t where user_id = auth.uid()),
    'torneos', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.results r where user_id = auth.uid()),
    'sanciones', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.sanctions s where user_id = auth.uid()),
    'seguidos', (select coalesce(jsonb_agg(followee), '[]') from public.follows where follower = auth.uid())
  )
$$;

-- ───────────── Comunidad ─────────────

create or replace function public.follow(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.follows (follower, followee) values (public._me(), p_user) on conflict do nothing;
$$;
create or replace function public.unfollow(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.follows where follower = public._me() and followee = p_user;
$$;
create or replace function public.block_user(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.blocks (blocker, blocked) values (public._me(), p_user) on conflict do nothing;
  delete from public.follows where (follower = auth.uid() and followee = p_user) or (follower = p_user and followee = auth.uid());
$$;
create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = public._me() and blocked = p_user;
$$;
create or replace function public.report_user(p_user uuid, p_kind text, p_detail text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.mod_reports (reporter, target_user, kind, detail) values (public._me(), p_user, p_kind, left(p_detail, 300));
$$;
create or replace function public.follow_counts(p_user uuid)
returns table (followers bigint, following bigint) language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.follows where followee = p_user), (select count(*) from public.follows where follower = p_user)
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = public._me() and read_at is null and (p_ids is null or id = any (p_ids));
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (public._me(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
$$;
create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- ───────────── Torneos: organizador ─────────────

create or replace function public._apply_tournament_fields(t public.tournaments, p jsonb)
returns public.tournaments language plpgsql stable as $$
begin
  if p ? 'name' then t.name := trim(p->>'name'); end if;
  if p ? 'club' then t.club := nullif(trim(p->>'club'), ''); end if;
  if p ? 'category' then t.category := p->>'category'; end if;
  if p ? 'format' then t.format := p->>'format'; end if;
  if p ? 'swiss_rounds' then t.swiss_rounds := (p->>'swiss_rounds')::int; end if;
  if p ? 'top_cut' then t.top_cut := (p->>'top_cut')::int; end if;
  if p ? 'swiss_best_of' then t.swiss_best_of := (p->>'swiss_best_of')::int; end if;
  if p ? 'top_best_of' then t.top_best_of := (p->>'top_best_of')::int; end if;
  if p ? 'pace' then t.pace := p->'pace'; end if;
  if p ? 'deck_policy' then t.deck_policy := p->>'deck_policy'; end if;
  if p ? 'restrictions' then t.restrictions := coalesce(p->'restrictions', '{}'::jsonb); end if;
  if p ? 'capacity' then t.capacity := (p->>'capacity')::int; end if;
  if p ? 'starts_at' then t.starts_at := (p->>'starts_at')::timestamptz; end if;
  if p ? 'checkin_minutes' then t.checkin_minutes := (p->>'checkin_minutes')::int; end if;
  if p ? 'round_minutes' then t.round_minutes := nullif(p->>'round_minutes', '')::int; end if;
  if p ? 'confirm_minutes' then t.confirm_minutes := nullif(p->>'confirm_minutes', '')::int; end if;
  if p ? 'min_rank' then t.min_rank := (p->>'min_rank')::int; end if;
  if p ? 'prizes' then t.prizes := nullif(trim(p->>'prizes'), ''); end if;
  if p ? 'notes' then t.notes := nullif(trim(p->>'notes'), ''); end if;
  if t.format = 'swiss' then t.top_cut := 0; end if;
  if t.format = 'single_elim' then t.swiss_rounds := 0; t.top_cut := 0; end if;
  return t;
end $$;

create or replace function public._check_tournament(t public.tournaments)
returns void language plpgsql immutable as $$
begin
  if t.pace->>'kind' not in ('en_vivo', 'jornadas', 'ventana') then raise exception 'Elige un ritmo válido.'; end if;
  if t.pace->>'kind' = 'ventana' and coalesce((t.pace->>'windowHours')::int, 0) not in (24, 48) then
    raise exception 'El plazo por ronda es de 24 o 48 horas.';
  end if;
  if t.pace->>'kind' = 'jornadas' and jsonb_array_length(coalesce(t.pace->'sessions', '[]')) = 0 then
    raise exception 'Agrega al menos una jornada.';
  end if;
  if t.format in ('swiss_topcut', 'swiss') and t.swiss_rounds < 1 then raise exception 'Elige cuántas rondas suizas.'; end if;
  if t.format = 'swiss_topcut' and t.top_cut < 2 then raise exception 'Elige el tamaño del top cut.'; end if;
end $$;

create or replace function public.create_tournament(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments;
begin
  if not public.is_organizer(uid) then raise exception 'Necesitas el rol de organizador para crear torneos.'; end if;
  t.id := gen_random_uuid();
  t.organizer_id := uid;
  t.status := 'draft';
  t.category := 'comunitario';
  t.format := 'swiss_topcut';
  t.swiss_rounds := 4; t.top_cut := 4; t.swiss_best_of := 1; t.top_best_of := 3;
  t.pace := '{"kind":"en_vivo"}'; t.deck_policy := 'por_ronda'; t.restrictions := '{}';
  t.capacity := 32; t.checkin_minutes := 30; t.min_rank := 0;
  t.starts_at := now() + interval '1 day';
  t := public._apply_tournament_fields(t, p);
  perform public._check_tournament(t);
  t.code := public._gen_code(t.name);
  t.lot_seed := encode(extensions.gen_random_bytes(8), 'hex');
  t.created_at := now(); t.current_round := 0;
  t.season_id := public._current_season();
  insert into public.tournaments select t.*;
  insert into public.tournament_staff (tournament_id, user_id, role) values (t.id, uid, 'organizer');
  perform public._audit(t.id, 'Creó el torneo', jsonb_build_object('nombre', t.name));
  return t.id;
end $$;

create or replace function public.update_tournament(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments;
begin
  perform public._require_staff(p_id);
  select * into t from public.tournaments where id = p_id for update;
  if t.status not in ('draft', 'pending_approval', 'registration') then raise exception 'El torneo ya empezó; ya no se puede editar.'; end if;
  if t.status = 'registration' and (p ? 'format' or p ? 'category' or p ? 'deck_policy' or p ? 'restrictions') then
    raise exception 'Con la inscripción abierta ya no se cambian formato, categoría ni reglas de mazo.';
  end if;
  t := public._apply_tournament_fields(t, p);
  perform public._check_tournament(t);
  update public.tournaments x set
    name = t.name, club = t.club, category = t.category, format = t.format, swiss_rounds = t.swiss_rounds,
    top_cut = t.top_cut, swiss_best_of = t.swiss_best_of, top_best_of = t.top_best_of, pace = t.pace,
    deck_policy = t.deck_policy, restrictions = t.restrictions, capacity = t.capacity, starts_at = t.starts_at,
    checkin_minutes = t.checkin_minutes, round_minutes = t.round_minutes, confirm_minutes = t.confirm_minutes,
    min_rank = t.min_rank, prizes = t.prizes, notes = t.notes
  where x.id = p_id;
  perform public._audit(p_id, 'Editó el torneo', p);
end $$;

-- Clasificatorios y Mayores esperan aprobación del superadmin.
create or replace function public.publish_tournament(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; next_status text;
begin
  perform public._require_staff(p_id);
  select * into t from public.tournaments where id = p_id for update;
  if t.status <> 'draft' then raise exception 'El torneo ya está publicado.'; end if;
  next_status := case when t.category in ('clasificatorio', 'mayor') and not public.is_superadmin() then 'pending_approval' else 'registration' end;
  update public.tournaments set status = next_status where id = p_id;
  perform public._audit(p_id, case when next_status = 'registration' then 'Abrió la inscripción' else 'Pidió aprobación' end);
  return next_status;
end $$;

create or replace function public.approve_tournament(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments;
begin
  perform public._me();
  if not public.is_superadmin() then raise exception 'Solo el superadmin aprueba torneos.'; end if;
  select * into t from public.tournaments where id = p_id for update;
  if t.status <> 'pending_approval' then raise exception 'Este torneo no está esperando aprobación.'; end if;
  update public.tournaments set status = case when p_approve then 'registration' else 'draft' end,
    approved_by = case when p_approve then auth.uid() end, approved_at = case when p_approve then now() end
  where id = p_id;
  perform public._notify(t.organizer_id, 'torneo',
    case when p_approve then 'Aprobamos ' || t.name else 'No aprobamos ' || t.name end,
    case when p_approve then 'La inscripción ya está abierta.' else 'Revisa la categoría y vuelve a enviarlo.' end,
    '/staff/torneo/' || p_id);
  perform public._audit(p_id, case when p_approve then 'Aprobó el torneo' else 'Rechazó el torneo' end);
end $$;

create or replace function public.cancel_tournament(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record;
begin
  perform public._require_staff(p_id);
  select * into t from public.tournaments where id = p_id for update;
  if t.status in ('finished', 'cancelled') then raise exception 'El torneo ya terminó.'; end if;
  update public.tournaments set status = 'cancelled' where id = p_id;
  for r in select user_id from public.registrations where tournament_id = p_id and status in ('registered', 'checked_in', 'waitlist') loop
    perform public._notify(r.user_id, 'torneo', t.name || ' se canceló', 'El organizador canceló el torneo.', '/torneo/' || t.code);
  end loop;
  perform public._audit(p_id, 'Canceló el torneo');
end $$;

create or replace function public.add_staff(p_tournament uuid, p_username text, p_role text default 'judge')
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  perform public._require_staff(p_tournament);
  select id into target from public.profiles where lower(username::text) = lower(p_username);
  if target is null then raise exception 'No encontramos a %.', p_username; end if;
  insert into public.tournament_staff (tournament_id, user_id, role) values (p_tournament, target, p_role)
  on conflict (tournament_id, user_id) do update set role = excluded.role;
  perform public._notify(target, 'torneo', 'Eres ' || case when p_role = 'judge' then 'juez' else 'organizador' end || ' de un torneo',
    (select name from public.tournaments where id = p_tournament), '/staff/torneo/' || p_tournament);
  perform public._audit(p_tournament, 'Agregó staff', jsonb_build_object('usuario', p_username, 'rol', p_role));
end $$;

create or replace function public.remove_staff(p_tournament uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_staff(p_tournament);
  if p_user = (select organizer_id from public.tournaments where id = p_tournament) then
    raise exception 'El organizador principal no se puede quitar.';
  end if;
  delete from public.tournament_staff where tournament_id = p_tournament and user_id = p_user;
  perform public._audit(p_tournament, 'Quitó staff', jsonb_build_object('usuario', p_user));
end $$;

create or replace function public.set_announcement(p_tournament uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record;
begin
  perform public._require_staff(p_tournament);
  select * into t from public.tournaments where id = p_tournament;
  update public.tournaments set announcement = nullif(trim(left(p_text, 280)), ''), announcement_at = now() where id = p_tournament;
  if nullif(trim(p_text), '') is not null then
    for r in select distinct user_id from public.registrations
             where tournament_id = p_tournament and user_id is not null and status in ('registered', 'checked_in', 'waitlist') loop
      perform public._notify(r.user_id, 'anuncio', t.name, left(trim(p_text), 280), '/torneo/' || t.code);
    end loop;
  end if;
  perform public._audit(p_tournament, 'Publicó un anuncio', jsonb_build_object('texto', p_text));
end $$;

create or replace function public.add_guest(p_tournament uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare id uuid;
begin
  perform public._require_staff(p_tournament);
  if (select status from public.tournaments where id = p_tournament) not in ('registration', 'running') then
    raise exception 'Solo se agregan invitados antes de terminar el torneo.';
  end if;
  insert into public.registrations (tournament_id, guest_name, status) values (p_tournament, trim(p_name), 'checked_in') returning registrations.id into id;
  perform public._audit(p_tournament, 'Agregó un invitado', jsonb_build_object('nombre', p_name));
  return id;
end $$;

create or replace function public._promote_waitlist(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record;
begin
  select * into t from public.tournaments where id = p_tournament;
  while (select count(*) from public.registrations where tournament_id = p_tournament and status in ('registered', 'checked_in')) < t.capacity loop
    select * into r from public.registrations where tournament_id = p_tournament and status = 'waitlist' order by created_at limit 1 for update;
    exit when not found;
    update public.registrations set status = 'registered' where id = r.id;
    perform public._notify(r.user_id, 'torneo', 'Entraste a ' || t.name, 'Se liberó un lugar y ya estás inscrito.', '/torneo/' || t.code);
  end loop;
end $$;

create or replace function public.staff_registration(p_registration uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.registrations;
begin
  select * into r from public.registrations where id = p_registration for update;
  if not found then raise exception 'No encontramos esa inscripción.'; end if;
  perform public._require_staff(r.tournament_id);
  case p_action
    when 'checkin' then update public.registrations set status = 'checked_in', checked_in_at = now() where id = r.id;
    when 'drop' then update public.registrations set status = 'dropped', dropped_at = now() where id = r.id;
    when 'remove' then
      if (select status from public.tournaments where id = r.tournament_id) = 'running' then
        update public.registrations set status = 'dropped', dropped_at = now() where id = r.id;
      else
        update public.registrations set status = 'removed' where id = r.id;
        perform public._promote_waitlist(r.tournament_id);
      end if;
    else raise exception 'Acción desconocida.';
  end case;
  perform public._audit(r.tournament_id, 'Inscripción: ' || p_action,
    jsonb_build_object('jugador', coalesce((select username::text from public.profiles where id = r.user_id), r.guest_name)));
end $$;

-- ───────────── Torneos: jugador ─────────────

create or replace function public.register(p_tournament uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments; r public.registrations; st text; taken int;
begin
  select * into t from public.tournaments where id = p_tournament for update;
  if not found or t.status <> 'registration' then raise exception 'La inscripción no está abierta.'; end if;
  if t.starts_at <= now() and t.pace->>'kind' = 'en_vivo' then raise exception 'El torneo ya empezó.'; end if;
  if exists (select 1 from public.sanctions where user_id = uid and suspended_until > now()) then
    raise exception 'Tu cuenta está suspendida para torneos hasta el %.',
      to_char((select max(suspended_until) from public.sanctions where user_id = uid), 'DD/MM');
  end if;
  if public._rank_index(public._user_pr(uid)) < t.min_rank then raise exception 'Este torneo pide un rango más alto.'; end if;
  if (select friend_id from public.profile_private where user_id = uid) is null then
    raise exception 'Agrega tu ID de amigo antes de inscribirte.';
  end if;
  select * into r from public.registrations where tournament_id = p_tournament and user_id = uid;
  if found and r.status in ('registered', 'checked_in', 'waitlist') then return r.status; end if;
  select count(*) into taken from public.registrations where tournament_id = p_tournament and status in ('registered', 'checked_in');
  st := case when taken >= t.capacity then 'waitlist' else 'registered' end;
  insert into public.registrations (tournament_id, user_id, status) values (p_tournament, uid, st)
  on conflict (tournament_id, user_id) do update set status = excluded.status, created_at = now(), checked_in_at = null, dropped_at = null;
  return st;
end $$;

create or replace function public.unregister(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  if (select status from public.tournaments where id = p_tournament) <> 'registration' then
    raise exception 'El torneo ya empezó: usa "Retirarme" en lugar de cancelar.';
  end if;
  update public.registrations set status = 'removed' where tournament_id = p_tournament and user_id = uid;
  perform public._promote_waitlist(p_tournament);
end $$;

-- Check-in del torneo: abre checkin_minutes antes del inicio.
create or replace function public.checkin(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments;
begin
  select * into t from public.tournaments where id = p_tournament;
  if t.status <> 'registration' then raise exception 'El check-in no está abierto.'; end if;
  if now() < t.starts_at - make_interval(mins => t.checkin_minutes) then
    raise exception 'El check-in abre a las %.', to_char((t.starts_at - make_interval(mins => t.checkin_minutes)) at time zone 'America/Mexico_City', 'HH24:MI');
  end if;
  update public.registrations set status = 'checked_in', checked_in_at = now()
  where tournament_id = p_tournament and user_id = uid and status = 'registered';
  if not found then raise exception 'No tienes un lugar en este torneo.'; end if;
end $$;

create or replace function public.drop_tournament(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  update public.registrations set status = 'dropped', dropped_at = now()
  where tournament_id = p_tournament and user_id = uid and status in ('registered', 'checked_in');
  if not found then raise exception 'No estás jugando este torneo.'; end if;
  perform public._audit(p_tournament, 'Se retiró', jsonb_build_object('usuario', uid));
end $$;

create or replace function public.declare_deck(p_tournament uuid, p_round int, p_archetype text, p_screenshot text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); t public.tournaments; reg uuid; eff text;
begin
  select * into t from public.tournaments where id = p_tournament;
  select id into reg from public.registrations where tournament_id = p_tournament and user_id = uid and status in ('registered', 'checked_in', 'waitlist');
  if reg is null then raise exception 'No estás inscrito en este torneo.'; end if;
  eff := case when t.deck_policy = 'libre' and t.restrictions <> '{}'::jsonb then 'por_ronda' else t.deck_policy end;
  if eff = 'libre' then raise exception 'Este torneo no pide declarar mazo.'; end if;
  if eff = 'fijo' and (p_round <> 0 or t.status <> 'registration') then raise exception 'El mazo fijo se declara al inscribirte.'; end if;
  if eff = 'por_ronda' and p_round <= t.current_round and t.status = 'running' then
    raise exception 'La ronda % ya está emparejada; declara para la siguiente.', p_round;
  end if;
  if p_screenshot !~ ('^' || p_tournament || '/' || uid || '/') then raise exception 'Sube la captura de tu mazo.'; end if;
  insert into public.deck_declarations (tournament_id, registration_id, round, archetype, screenshot)
  values (p_tournament, reg, greatest(p_round, 0), trim(p_archetype), p_screenshot)
  on conflict (registration_id, round) do update set archetype = excluded.archetype, screenshot = excluded.screenshot,
    status = 'unreviewed', reviewed_by = null, reviewed_at = null, created_at = now();
end $$;

-- ───────────── La mesa ─────────────

create or replace function public._my_side(m public.matches)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.registrations where id = m.a and user_id = auth.uid()) then 'a'
    when exists (select 1 from public.registrations where id = m.b and user_id = auth.uid()) then 'b'
  end
$$;

create or replace function public._load_my_match(p_match uuid)
returns public.matches language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
  perform public._me();
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'No encontramos esa mesa.'; end if;
  if public._my_side(m) is null then raise exception 'No juegas en esta mesa.'; end if;
  if (select status from public.rounds where id = m.round_id) = 'closed' then raise exception 'Esta ronda ya cerró.'; end if;
  return m;
end $$;

create or replace function public._event(p_match uuid, p_kind text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.match_events (match_id, actor, kind, data) values (p_match, auth.uid(), p_kind, p_data);
$$;

create or replace function public._rival_user(m public.matches, side text)
returns uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.registrations where id = case when side = 'a' then m.b else m.a end
$$;

-- Datos de la mesa que solo ven los dos jugadores: nombre en Pocket e ID de amigo del rival.
create or replace function public.table_private(p_match uuid)
returns table (registration_id uuid, username text, pocket_name text, friend_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_see_match_private(p_match) then raise exception 'No juegas en esta mesa.'; end if;
  return query
    select r.id, coalesce(p.username::text, r.guest_name), x.pocket_name, x.friend_id
    from public.matches m join public.registrations r on r.id in (m.a, m.b)
    left join public.profiles p on p.id = r.user_id
    left join public.profile_private x on x.user_id = r.user_id
    where m.id = p_match;
end $$;

create or replace function public.table_checkin(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if side = 'a' then update public.matches set a_checkin_at = coalesce(a_checkin_at, now()) where id = m.id;
  else update public.matches set b_checkin_at = coalesce(b_checkin_at, now()) where id = m.id; end if;
  update public.matches set status = 'playing'
  where id = m.id and status in ('pending', 'scheduled') and a_checkin_at is not null and b_checkin_at is not null;
  perform public._event(m.id, 'checkin');
  perform public._notify(public._rival_user(m, side), 'mesa', 'Tu rival ya está en la mesa', 'Mesa ' || m.table_no, '/mesa/' || m.id);
end $$;

-- Mensajes rápidos fijos: no hay chat libre. Uno cada 10 segundos.
create or replace function public.quick_message(p_match uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; msg text;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  msg := case p_code
    when 'buscando' then 'Ya estoy buscando partida'
    when 'no_conecta' then 'No conecta: regenero la contraseña'
    when 'dame_2' then 'Dame 2 minutos'
    when 'se_cayo' then 'Se cayó mi conexión, vuelvo a buscar'
    when 'listo' then 'Listo para el siguiente juego'
    when 'gg' then 'Buena partida'
  end;
  if msg is null then raise exception 'Mensaje no válido.'; end if;
  if exists (select 1 from public.match_events where match_id = m.id and actor = auth.uid() and kind = 'mensaje' and at > now() - interval '10 seconds') then
    raise exception 'Espera unos segundos antes de enviar otro mensaje.';
  end if;
  perform public._event(m.id, 'mensaje', jsonb_build_object('code', p_code, 'texto', msg));
  perform public._notify(public._rival_user(m, side), 'mesa', (select username::text from public.profiles where id = auth.uid()) || ': ' || msg,
    'Mensaje rápido · Mesa ' || m.table_no, '/mesa/' || m.id);
end $$;

create or replace function public.regen_password(p_match uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; pw text := public._gen_password();
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  update public.match_secrets set password = pw, generation = generation + 1, updated_at = now() where match_id = m.id;
  perform public._event(m.id, 'contraseña', jsonb_build_object('generacion', (select generation from public.match_secrets where match_id = m.id)));
  perform public._notify(public._rival_user(m, side), 'mesa', 'Contraseña nueva en tu mesa', 'Mesa ' || m.table_no, '/mesa/' || m.id);
  return pw;
end $$;

create or replace function public._valid_score(p_best_of int, p_stage text, ga int, gb int, gd int)
returns boolean language sql immutable as $$
  select ga >= 0 and gb >= 0 and gd >= 0
     and ga <= (p_best_of + 1) / 2 and gb <= (p_best_of + 1) / 2
     and ga + gb + gd between 1 and p_best_of + 2
     and (p_stage <> 'top' or ga <> gb)
     and (ga = (p_best_of + 1) / 2 or gb = (p_best_of + 1) / 2 or p_stage <> 'top')
$$;

create or replace function public._confirm(p_match uuid, p_how text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; t public.tournaments; pending int; s record;
begin
  update public.matches set status = 'confirmed', confirmed_at = now(), confirmed_how = p_how,
    winner = case when double_loss then null when games_a > games_b then a when games_b > games_a then b end
  where id = p_match returning * into m;
  select count(*) into pending from public.matches where round_id = m.round_id and status <> 'confirmed';
  if pending = 0 then
    select * into t from public.tournaments where id = m.tournament_id;
    for s in select distinct user_id from public.tournament_staff where tournament_id = t.id loop
      perform public._notify(s.user_id, 'staff', 'Ronda ' || t.current_round || ' lista', 'Todas las mesas confirmaron. ' || t.name, '/staff/torneo/' || t.id);
    end loop;
  end if;
end $$;

-- Reporte desde tu lado: tus juegos, los del rival y empates.
create or replace function public.report_result(p_match uuid, p_mine int, p_theirs int, p_draws int default 0)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; r public.rounds; ga int; gb int; prev uuid;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if m.b is null then raise exception 'Esta ronda es bye: no hay que reportar.'; end if;
  if m.status = 'confirmed' then raise exception 'El resultado ya está confirmado.'; end if;
  if m.status = 'disputed' then raise exception 'Hay una disputa abierta: el juez decide.'; end if;
  select * into r from public.rounds where id = m.round_id;
  ga := case when side = 'a' then p_mine else p_theirs end;
  gb := case when side = 'a' then p_theirs else p_mine end;
  if not public._valid_score(r.best_of, r.stage, ga, gb, coalesce(p_draws, 0)) then
    raise exception 'Ese marcador no es válido para un Bo%.', r.best_of;
  end if;
  prev := m.reported_by;
  if prev is not null and prev <> (case when side = 'a' then m.a else m.b end) then
    -- El rival ya había reportado: si coincide se confirma; si no, disputa.
    if m.games_a = ga and m.games_b = gb and m.game_draws = coalesce(p_draws, 0) then
      perform public._event(m.id, 'reporte', jsonb_build_object('a', ga, 'b', gb, 'empates', p_draws));
      perform public._confirm(m.id, 'ambos');
      return 'confirmed';
    end if;
    update public.matches set status = 'disputed' where id = m.id;
    perform public._event(m.id, 'disputa', jsonb_build_object('a', ga, 'b', gb, 'empates', p_draws));
    insert into public.cases (tournament_id, match_id, kind, opened_by) values (m.tournament_id, m.id, 'marcador', auth.uid());
    return 'disputed';
  end if;
  update public.matches set games_a = ga, games_b = gb, game_draws = coalesce(p_draws, 0), double_loss = false,
    status = 'reported', reported_by = case when side = 'a' then a else b end, reported_at = now()
  where id = m.id;
  perform public._event(m.id, 'reporte', jsonb_build_object('a', ga, 'b', gb, 'empates', p_draws));
  perform public._notify(public._rival_user(m, side), 'mesa', 'Confirma el resultado de tu mesa',
    'Tu rival reportó ' || p_theirs || '-' || p_mine || '.', '/mesa/' || m.id);
  return 'reported';
end $$;

create or replace function public.confirm_result(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if m.status <> 'reported' then raise exception 'No hay un reporte por confirmar.'; end if;
  if m.reported_by = (case when side = 'a' then m.a else m.b end) then raise exception 'Tu rival es quien confirma tu reporte.'; end if;
  perform public._event(m.id, 'confirmó');
  perform public._confirm(m.id, 'rival');
end $$;

create or replace function public.dispute_result(p_match uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; c bigint;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if m.status <> 'reported' then raise exception 'No hay un reporte que disputar.'; end if;
  update public.matches set status = 'disputed' where id = m.id;
  perform public._event(m.id, 'disputa');
  insert into public.cases (tournament_id, match_id, kind, opened_by) values (m.tournament_id, m.id, 'marcador', auth.uid()) returning id into c;
  return c;
end $$;

-- Desconexión: la primera con regreso se repite la partida; la segunda, o no volver en 5 minutos, va al juez.
create or replace function public.report_disconnect(p_match uuid, p_who text, p_returned boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; who_side text; n int; c bigint;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  who_side := case when p_who = 'yo' then side else (case when side = 'a' then 'b' else 'a' end) end;
  perform public._event(m.id, 'desconexion', jsonb_build_object('lado', who_side, 'volvio', p_returned));
  select count(*) into n from public.match_events where match_id = m.id and kind = 'desconexion' and data->>'lado' = who_side;
  if n <= 1 and p_returned then
    perform public._notify(public._rival_user(m, side), 'mesa', 'Desconexión en tu mesa', 'La partida se repite con contraseña nueva.', '/mesa/' || m.id);
    perform public.regen_password(m.id);
    return 'repetir';
  end if;
  insert into public.cases (tournament_id, match_id, kind, opened_by) values (m.tournament_id, m.id, 'desconexion', auth.uid()) returning id into c;
  insert into public.case_messages (case_id, role, body) values (c, 'system',
    case when p_returned then 'Segunda desconexión en el mismo encuentro.' else 'No volvió en 5 minutos.' end
    || ' La partida en curso es para quien se quedó; el juez revisa si hay sanción.');
  return 'juez';
end $$;

create or replace function public.call_judge(p_match uuid, p_kind text default 'juez')
returns bigint language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; c bigint; s record;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if p_kind not in ('ausente', 'conducta', 'juez') then p_kind := 'juez'; end if;
  insert into public.cases (tournament_id, match_id, kind, opened_by) values (m.tournament_id, m.id, p_kind, auth.uid()) returning id into c;
  perform public._event(m.id, 'juez', jsonb_build_object('caso', c, 'motivo', p_kind));
  for s in select user_id from public.tournament_staff where tournament_id = m.tournament_id loop
    perform public._notify(s.user_id, 'staff', 'Caso #' || c || ' · Mesa ' || m.table_no, 'Un jugador llamó al juez.', '/staff/torneo/' || m.tournament_id || '/casos/' || c);
  end loop;
  return c;
end $$;

-- Respuestas fijas del jugador en un caso, con captura opcional.
create or replace function public.case_reply(p_case bigint, p_code text, p_attachment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cases;
begin
  perform public._me();
  select * into c from public.cases where id = p_case;
  if not found or not (c.opened_by = auth.uid() or (c.match_id is not null and public.is_match_player(c.match_id))) then
    raise exception 'No participas en este caso.';
  end if;
  if c.status = 'resolved' then raise exception 'El caso ya está resuelto.'; end if;
  if p_code not in ('envio_captura', 'no_tengo_captura', 'entendido', 'sigo_esperando') then raise exception 'Respuesta no válida.'; end if;
  if p_attachment is not null and p_attachment !~ ('^' || c.tournament_id || '/' || auth.uid() || '/') then raise exception 'Captura no válida.'; end if;
  insert into public.case_messages (case_id, author, role, code, attachment) values (p_case, auth.uid(), 'player', p_code, p_attachment);
end $$;

-- ───────────── Ritmo por ventana ─────────────

create or replace function public.set_availability(p_match uuid, p_slots timestamptz[])
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text; theirs timestamptz[]; common timestamptz; deadline timestamptz;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  select ends_at + make_interval(hours => m.extension_hours) into deadline from public.rounds where id = m.round_id;
  insert into public.availability (match_id, user_id, slots, updated_at) values (m.id, auth.uid(), p_slots, now())
  on conflict (match_id, user_id) do update set slots = excluded.slots, updated_at = now();
  perform public._event(m.id, 'disponibilidad', jsonb_build_object('bloques', coalesce(array_length(p_slots, 1), 0)));
  select slots into theirs from public.availability where match_id = m.id and user_id = public._rival_user(m, side);
  select min(s) into common from unnest(p_slots) s where s = any (coalesce(theirs, '{}')) and s >= date_trunc('hour', now()) and s + interval '1 hour' <= deadline;
  return common;
end $$;

create or replace function public.propose_time(p_match uuid, p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if m.status not in ('pending', 'scheduled') then raise exception 'Esta mesa ya está jugando o reportada.'; end if;
  update public.matches set proposed_at = p_at, proposed_by = case when side = 'a' then a else b end where id = m.id;
  perform public._event(m.id, 'propuesta', jsonb_build_object('hora', p_at));
  perform public._notify(public._rival_user(m, side), 'mesa', 'Tu rival propone jugar', to_char(p_at at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), '/mesa/' || m.id);
end $$;

create or replace function public.accept_time(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; side text;
begin
  m := public._load_my_match(p_match); side := public._my_side(m);
  if m.proposed_at is null then raise exception 'No hay una propuesta pendiente.'; end if;
  if m.proposed_by = (case when side = 'a' then m.a else m.b end) then raise exception 'Tu rival es quien acepta tu propuesta.'; end if;
  update public.matches set scheduled_at = proposed_at, proposed_at = null, proposed_by = null, status = 'scheduled' where id = m.id;
  perform public._event(m.id, 'acordada', jsonb_build_object('hora', m.proposed_at));
  perform public._notify(public._rival_user(m, side), 'mesa', 'Partida agendada', to_char(m.proposed_at at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), '/mesa/' || m.id);
end $$;

-- ───────────── Staff: ronda, casos, mazos, sanciones ─────────────

create or replace function public.staff_round_clock(p_round uuid, p_action text, p_minutes int default 5)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rounds;
begin
  select * into r from public.rounds where id = p_round for update;
  perform public._require_staff(r.tournament_id);
  if r.status = 'closed' then raise exception 'La ronda ya cerró.'; end if;
  case p_action
    when 'pausar' then
      if r.status = 'paused' then return; end if;
      update public.rounds set status = 'paused', paused_remaining = greatest(ends_at - now(), interval '0') where id = r.id;
    when 'reanudar' then
      if r.status <> 'paused' then return; end if;
      update public.rounds set status = 'active', ends_at = now() + paused_remaining, paused_remaining = null where id = r.id;
    when 'agregar' then
      if r.status = 'paused' then update public.rounds set paused_remaining = paused_remaining + make_interval(mins => p_minutes) where id = r.id;
      else update public.rounds set ends_at = ends_at + make_interval(mins => p_minutes) where id = r.id; end if;
    else raise exception 'Acción desconocida.';
  end case;
  perform public._audit(r.tournament_id, 'Reloj de ronda: ' || p_action, jsonb_build_object('ronda', r.number, 'minutos', p_minutes));
end $$;

create or replace function public.staff_match(p_match uuid, p_action text, p_hours int default 12)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; u record;
begin
  select * into m from public.matches where id = p_match for update;
  perform public._require_staff(m.tournament_id);
  case p_action
    when 'recordar' then
      for u in select user_id from public.registrations where id in (m.a, m.b) loop
        perform public._notify(u.user_id, 'mesa', 'El organizador te recuerda jugar tu mesa', 'Coordina con tu rival antes del cierre.', '/mesa/' || m.id);
      end loop;
    when 'extender' then
      if m.extension_hours + p_hours > 24 then raise exception 'La extensión máxima es de 24 horas.'; end if;
      update public.matches set extension_hours = extension_hours + p_hours where id = m.id;
    when 'repetir' then
      update public.matches set status = 'playing', games_a = 0, games_b = 0, game_draws = 0, double_loss = false, winner = null,
        reported_by = null, reported_at = null, confirmed_at = null, confirmed_how = null where id = m.id;
      update public.match_secrets set password = public._gen_password(), generation = generation + 1, updated_at = now() where match_id = m.id;
    else raise exception 'Acción desconocida.';
  end case;
  perform public._audit(m.tournament_id, 'Mesa ' || m.table_no || ': ' || p_action, jsonb_build_object('horas', p_hours));
end $$;

-- Resultado puesto por el staff (decisión de juez o corrección). Siempre con motivo en la auditoría.
create or replace function public.staff_set_result(p_match uuid, p_games_a int, p_games_b int, p_draws int, p_double_loss boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches; r public.rounds; before jsonb;
begin
  select * into m from public.matches where id = p_match for update;
  perform public._require_staff(m.tournament_id);
  select * into r from public.rounds where id = m.round_id;
  if nullif(trim(p_reason), '') is null then raise exception 'Escribe el motivo del cambio.'; end if;
  if not p_double_loss and not public._valid_score(r.best_of, r.stage, p_games_a, p_games_b, p_draws) then
    raise exception 'Ese marcador no es válido para un Bo%.', r.best_of;
  end if;
  if p_double_loss and r.stage = 'top' then raise exception 'En el top cut no hay derrota doble.'; end if;
  if r.status = 'closed' and exists (select 1 from public.rounds where tournament_id = m.tournament_id and number > r.number) then
    raise exception 'La ronda siguiente ya está emparejada; este cambio ya no se puede hacer.';
  end if;
  before := jsonb_build_object('a', m.games_a, 'b', m.games_b, 'empates', m.game_draws, 'doble', m.double_loss, 'estado', m.status);
  update public.matches set games_a = case when p_double_loss then 0 else p_games_a end, games_b = case when p_double_loss then 0 else p_games_b end,
    game_draws = case when p_double_loss then 0 else p_draws end, double_loss = p_double_loss where id = m.id;
  perform public._confirm(m.id, 'juez');
  perform public._audit(m.tournament_id, 'Puso el resultado de la mesa ' || m.table_no,
    jsonb_build_object('antes', before, 'despues', jsonb_build_object('a', p_games_a, 'b', p_games_b, 'empates', p_draws, 'doble', p_double_loss), 'motivo', p_reason));
end $$;

create or replace function public.judge_message(p_case bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cases; u record;
begin
  select * into c from public.cases where id = p_case;
  perform public._require_staff(c.tournament_id);
  update public.cases set status = 'review', judge_id = coalesce(judge_id, auth.uid()) where id = p_case and status = 'open';
  insert into public.case_messages (case_id, author, role, body) values (p_case, auth.uid(), 'judge', left(trim(p_body), 500));
  for u in select r.user_id from public.matches m join public.registrations r on r.id in (m.a, m.b) where m.id = c.match_id loop
    perform public._notify(u.user_id, 'caso', 'El juez respondió en el caso #' || p_case, left(p_body, 120), '/caso/' || p_case);
  end loop;
end $$;

create or replace function public.resolve_case(p_case bigint, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cases; u record;
begin
  select * into c from public.cases where id = p_case for update;
  perform public._require_staff(c.tournament_id);
  if c.status = 'resolved' then raise exception 'El caso ya está resuelto.'; end if;
  if c.match_id is not null and (select status from public.matches where id = c.match_id) = 'disputed' then
    raise exception 'Pon el resultado de la mesa antes de cerrar el caso.';
  end if;
  update public.cases set status = 'resolved', resolution = p_resolution, resolved_at = now(), judge_id = coalesce(judge_id, auth.uid()) where id = p_case;
  insert into public.case_messages (case_id, author, role, body) values (p_case, auth.uid(), 'judge', 'Resuelto: ' || left(p_resolution, 480));
  for u in select r.user_id from public.matches m join public.registrations r on r.id in (m.a, m.b) where m.id = c.match_id loop
    perform public._notify(u.user_id, 'caso', 'Tu caso #' || p_case || ' se resolvió', left(p_resolution, 120), '/caso/' || p_case);
  end loop;
  perform public._audit(c.tournament_id, 'Resolvió el caso #' || p_case, jsonb_build_object('resolucion', p_resolution));
end $$;

create or replace function public.add_sanction(p_user uuid, p_tournament uuid, p_kind text, p_reason text, p_pr_penalty int default 0, p_days int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare season int := public._current_season();
begin
  perform public._require_staff(p_tournament);
  if p_kind in ('suspension', 'revision_expulsion', 'expulsion') and not public.is_superadmin() and p_days > 14 then
    raise exception 'Suspensiones de más de 14 días las pone el superadmin.';
  end if;
  insert into public.sanctions (user_id, tournament_id, season_id, kind, pr_penalty, reason, is_public, suspended_until, created_by)
  values (p_user, p_tournament, season, p_kind, least(p_pr_penalty, 0), p_reason, p_kind in ('suspension', 'revision_expulsion', 'expulsion'),
    case when p_days > 0 then now() + make_interval(days => p_days) end, auth.uid());
  if p_pr_penalty < 0 then
    update public.player_seasons set pr = greatest(0, pr + p_pr_penalty) where user_id = p_user and season_id = season;
  end if;
  perform public._notify(p_user, 'sancion', 'Recibiste una sanción: ' || replace(p_kind, '_', ' '), left(p_reason, 140), '/perfil');
  perform public._audit(p_tournament, 'Sanción', jsonb_build_object('usuario', p_user, 'tipo', p_kind, 'motivo', p_reason, 'pr', p_pr_penalty, 'dias', p_days));
end $$;

create or replace function public.review_deck(p_declaration uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.deck_declarations; uid uuid;
begin
  select * into d from public.deck_declarations where id = p_declaration for update;
  perform public._require_staff(d.tournament_id);
  update public.deck_declarations set status = case when p_approve then 'approved' else 'infraction' end,
    reviewed_by = auth.uid(), reviewed_at = now(), note = p_note where id = d.id;
  if not p_approve then
    select user_id into uid from public.registrations where id = d.registration_id;
    perform public._notify(uid, 'mazo', 'Tu mazo no cumple las reglas del torneo', coalesce(p_note, 'Declara un mazo corregido para la siguiente ronda.'),
      '/torneo/' || (select code from public.tournaments where id = d.tournament_id) || '/mazo');
  end if;
  perform public._audit(d.tournament_id, case when p_approve then 'Aprobó un mazo' else 'Marcó infracción de mazo' end,
    jsonb_build_object('declaracion', d.id, 'nota', p_note));
end $$;

-- ───────────── Plataforma ─────────────

create or replace function public.set_platform_role(p_username text, p_role text, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  perform public._me();
  if not public.is_superadmin() then raise exception 'Solo el superadmin da roles.'; end if;
  select id into target from public.profiles where lower(username::text) = lower(p_username);
  if target is null then raise exception 'No encontramos a %.', p_username; end if;
  if p_grant then
    insert into public.platform_roles (user_id, role, granted_by) values (target, p_role, auth.uid()) on conflict do nothing;
    perform public._notify(target, 'rol', 'Ya puedes organizar torneos en Reta', null, '/staff');
  else
    if target = auth.uid() and p_role = 'superadmin' then raise exception 'No puedes quitarte el rol de superadmin.'; end if;
    delete from public.platform_roles where user_id = target and role = p_role;
  end if;
  perform public._audit(null, case when p_grant then 'Dio rol ' else 'Quitó rol ' end || p_role, jsonb_build_object('usuario', p_username));
end $$;

create or replace function public.handle_mod_report(p_report bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._me();
  if not public.is_superadmin() then raise exception 'Solo el superadmin modera.'; end if;
  update public.mod_reports set status = p_status, handled_by = auth.uid() where id = p_report;
end $$;

-- Moderación: renombrar a un usuario ofensivo.
create or replace function public.moderate_rename(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  perform public._me();
  if not public.is_superadmin() then raise exception 'Solo el superadmin modera.'; end if;
  loop
    n := 'jugador' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.profiles where lower(username::text) = lower(n));
  end loop;
  update public.profiles set username = n, username_changed_at = null where id = p_user;
  perform public._notify(p_user, 'moderacion', 'Cambiamos tu usuario', 'Tu usuario anterior no cumplía las reglas. Elige uno nuevo en tu perfil.', '/perfil/editar');
  perform public._audit(null, 'Renombró por moderación', jsonb_build_object('usuario', p_user, 'nuevo', n));
  return n;
end $$;

-- ───────────── Permisos ─────────────

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_superadmin(uuid), public.is_organizer(uuid), public.is_staff(uuid, uuid),
  public.is_match_player(uuid, uuid), public.can_see_match_private(uuid, uuid)
to anon, authenticated;
grant execute on function
  public.username_available(text), public.complete_onboarding(text, date, text, text, text), public.delete_minor_account(),
  public.update_username(text), public.set_title(text, text), public.set_private_profile(boolean),
  public.update_private_data(text, text, text, jsonb, boolean), public.request_account_deletion(), public.cancel_account_deletion(),
  public.export_my_data(), public.follow(uuid), public.unfollow(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.report_user(uuid, text, text), public.follow_counts(uuid), public.mark_notifications_read(bigint[]),
  public.save_push_subscription(text, text, text), public.delete_push_subscription(text),
  public.create_tournament(jsonb), public.update_tournament(uuid, jsonb), public.publish_tournament(uuid),
  public.approve_tournament(uuid, boolean), public.cancel_tournament(uuid), public.add_staff(uuid, text, text),
  public.remove_staff(uuid, uuid), public.set_announcement(uuid, text), public.add_guest(uuid, text),
  public.staff_registration(uuid, text), public.register(uuid), public.unregister(uuid), public.checkin(uuid),
  public.drop_tournament(uuid), public.declare_deck(uuid, int, text, text), public.table_private(uuid),
  public.table_checkin(uuid), public.quick_message(uuid, text), public.regen_password(uuid),
  public.report_result(uuid, int, int, int), public.confirm_result(uuid), public.dispute_result(uuid),
  public.report_disconnect(uuid, text, boolean), public.call_judge(uuid, text), public.case_reply(bigint, text, text),
  public.set_availability(uuid, timestamptz[]), public.propose_time(uuid, timestamptz), public.accept_time(uuid),
  public.staff_round_clock(uuid, text, int), public.staff_match(uuid, text, int),
  public.staff_set_result(uuid, int, int, int, boolean, text), public.judge_message(bigint, text),
  public.resolve_case(bigint, text), public.add_sanction(uuid, uuid, text, text, int, int),
  public.review_deck(uuid, boolean, text), public.set_platform_role(text, text, boolean),
  public.handle_mod_report(bigint, text), public.moderate_rename(uuid)
to authenticated;
