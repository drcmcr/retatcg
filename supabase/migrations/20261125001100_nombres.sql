-- Reta · nombres y textos permitidos
-- Un solo filtro en el servidor para usuarios, invitados, torneos, clubes y textos públicos (notas, premios, anuncios).
-- Bloquea groserías, datos de contacto externos (protección de menores), nombres reservados y marcas que hagan
-- parecer oficial un torneo. La lista la edita el superadmin desde Plataforma.

create table public.blocked_terms (
  id bigint generated always as identity primary key,
  term text not null check (char_length(term) between 2 and 40),
  -- Forma normalizada con la que se compara (sin acentos, sin separadores, sin letras repetidas).
  norm text not null check (char_length(norm) >= 2),
  -- ofensivo | reservado | marca | contacto | permitido (excepción: se quita del texto antes de revisar).
  kind text not null check (kind in ('ofensivo', 'reservado', 'marca', 'contacto', 'permitido')),
  -- Dónde aplica: usuario, invitado, torneo (nombre), club (nombre), texto (notas, premios, anuncios).
  fields text[] not null default '{usuario,invitado,torneo,club,texto}'
    check (fields <@ '{usuario,invitado,torneo,club,texto}'::text[] and cardinality(fields) > 0),
  -- true: solo cuenta como palabra completa; false: cuenta aunque esté dentro de otra palabra.
  whole_word boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (norm, kind)
);
alter table public.blocked_terms enable row level security;
create policy "blocked_terms: lo ve el superadmin" on public.blocked_terms for select to authenticated using (public.is_superadmin());
grant select on public.blocked_terms to authenticated;

-- ───────────── Normalización ─────────────

-- Minúsculas, sin acentos y con los cambios típicos para esquivar filtros (p0k3m0n, $h1t).
create or replace function public._norm_base(p text)
returns text language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(p, '')),
    'áàäâãéèëêíìïîóòöôõúùüûñç4@3€1!|0$57',
    'aaaaaeeeeiiiiooooouuuuncaaeeiiioosst')
$$;

-- Palabras separadas por un espacio, con espacio al inicio y al final. Une letras sueltas ("p u t o" → "puto")
-- y quita letras repetidas ("puuuto" → "puto").
create or replace function public._norm_words(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(' ' || trim(regexp_replace(public._norm_base(p), '[^a-z0-9]+', ' ', 'g')) || ' ',
                          '(?<= [a-z0-9]) (?=[a-z0-9] )', '', 'g'),
           '([a-z0-9])\1+', '\1', 'g')
$$;

create or replace function public._norm_term(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(replace(public._norm_words(p), ' ', ''), '([a-z0-9])\1+', '\1', 'g')
$$;

-- Teléfonos, correos, enlaces y usuarios de redes. Se revisa sobre el texto original.
create or replace function public._has_contact(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
      or coalesce(p, '') ~* '(https?://|www\.|wa\.me|t\.me/)'
      or coalesce(p, '') ~* '[a-z0-9-]+\.(com|mx|net|org|gg|io|me|ly|app|link|xyz|co|tv|lat|info|site|store)(/|\y)'
      or coalesce(p, '') ~* '(^|[^a-z0-9])@[a-z0-9_.]{3,}'
      or coalesce(p, '') ~ '(\+?\d{1,3}[ -]?)?\(?\d{2,3}\)?[ -]?\d{3,4}[ -]?\d{4}'
$$;

-- Devuelve el tipo de problema (contacto, ofensivo, marca, reservado) o null si el texto se puede usar.
create or replace function public._text_issue(p_text text, p_field text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare words text; compact text; t record;
begin
  if nullif(trim(coalesce(p_text, '')), '') is null then return null; end if;
  if public._has_contact(p_text) then return 'contacto'; end if;
  words := public._norm_words(p_text);
  for t in select norm from public.blocked_terms where kind = 'permitido' loop
    words := replace(words, t.norm, '');
  end loop;
  compact := regexp_replace(replace(words, ' ', ''), '([a-z0-9])\1+', '\1', 'g');
  for t in select kind, norm, whole_word from public.blocked_terms
           where kind <> 'permitido' and p_field = any (fields)
           order by case kind when 'contacto' then 0 when 'ofensivo' then 1 when 'marca' then 2 else 3 end loop
    if (t.whole_word and position(' ' || t.norm || ' ' in words) > 0)
       or (not t.whole_word and position(t.norm in compact) > 0) then
      return t.kind;
    end if;
  end loop;
  return null;
end $$;

-- Lanza el error en español que ve el usuario. No dice qué palabra fue, solo el tipo de problema.
create or replace function public._require_clean(p_text text, p_field text, p_label text)
returns void language plpgsql stable set search_path = '' as $$
declare issue text := public._text_issue(p_text, p_field);
begin
  if issue is null then return; end if;
  if issue = 'contacto' then
    raise exception '% no puede incluir teléfonos, correos, enlaces ni usuarios de otras redes.', p_label;
  elsif issue = 'ofensivo' then
    raise exception '% tiene palabras que no se permiten en Reta.', p_label;
  elsif issue = 'marca' and p_field = 'club' then
    raise exception '% no puede usar marcas como Nintendo o The Pokémon Company, ni palabras como "oficial", "regional" o "mundial".', p_label;
  elsif issue = 'marca' then
    raise exception '% no puede usar marcas como Pokémon o Nintendo, ni palabras que lo hagan parecer oficial.', p_label;
  else
    raise exception '% está reservado. Elige otro.', p_label;
  end if;
end $$;

-- ───────────── Lista inicial ─────────────

insert into public.blocked_terms (term, norm, kind, fields, whole_word)
select term, public._norm_term(term), kind, fields::text[], whole_word from (values
  -- Groserías y discurso de odio: en todos lados.
  ('pendej', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('puto', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('puta', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('verga', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('chinga', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('culer', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('culo', 'ofensivo', '{usuario,invitado,torneo,club,texto}', true),
  ('mierda', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('cabron', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('pinche', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('marica', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('joto', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('idiota', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('estupid', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('imbecil', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('mongol', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('nazi', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('hitler', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('nigga', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('fuck', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('shit', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('bitch', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('porn', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('sexo', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('sexy', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('violad', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('pedofil', 'ofensivo', '{usuario,invitado,torneo,club,texto}', false),
  ('kys', 'ofensivo', '{usuario,invitado,torneo,club,texto}', true),
  -- Excepciones: palabras normales que contienen una de arriba.
  ('computa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('computo', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('disputa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('disputo', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('reputa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('imputa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('diputa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('amputa', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('converg', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('diverg', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('vergara', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('maricarmen', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  ('mongolia', 'permitido', '{usuario,invitado,torneo,club,texto}', false),
  -- Contacto fuera de Reta.
  ('whatsapp', 'contacto', '{usuario,invitado,torneo,club,texto}', false),
  ('telegram', 'contacto', '{usuario,invitado,torneo,club,texto}', false),
  ('onlyfans', 'contacto', '{usuario,invitado,torneo,club,texto}', false),
  ('whats', 'contacto', '{usuario,invitado,torneo,club,texto}', true),
  ('wsp', 'contacto', '{usuario,invitado,torneo,club,texto}', true),
  ('inbox', 'contacto', '{usuario,invitado,torneo,club,texto}', true),
  ('md', 'contacto', '{texto}', true),
  ('dm', 'contacto', '{texto}', true),
  -- Hacerse pasar por el equipo de Reta o por un juez.
  ('admin', 'reservado', '{usuario}', false),
  ('soporte', 'reservado', '{usuario}', false),
  ('moderador', 'reservado', '{usuario}', false),
  ('staff', 'reservado', '{usuario}', false),
  ('juez', 'reservado', '{usuario}', false),
  ('retatcg', 'reservado', '{usuario}', false),
  ('reta oficial', 'reservado', '{usuario}', false),
  ('reta app', 'reservado', '{usuario}', false),
  -- Marcas y palabras que hacen parecer oficial un torneo. "Pokémon" sí se permite en el nombre del club.
  ('pokemon', 'marca', '{usuario,torneo}', false),
  ('ptcg', 'marca', '{usuario,torneo}', false),
  ('nintendo', 'marca', '{usuario,torneo,club}', false),
  ('pokemon company', 'marca', '{usuario,torneo,club}', false),
  ('play pokemon', 'marca', '{usuario,torneo,club}', false),
  ('game freak', 'marca', '{usuario,torneo,club}', false),
  ('oficial', 'marca', '{usuario,torneo,club}', false),
  ('regional', 'marca', '{torneo,club}', false),
  ('nacional', 'marca', '{torneo,club}', false),
  ('mundial', 'marca', '{torneo,club}', false),
  ('worlds', 'marca', '{torneo,club}', false)
) as s (term, kind, fields, whole_word)
on conflict do nothing;

-- ───────────── Dónde se aplica ─────────────

create or replace function public._username_ok(p text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(p, '') ~ '^[A-Za-z0-9._]{3,16}$' and public._text_issue(p, 'usuario') is null
$$;

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
  if coalesce(p_username, '') !~ '^[A-Za-z0-9._]{3,16}$' then
    raise exception 'El usuario debe tener de 3 a 16 caracteres: letras, números, punto o guion bajo.';
  end if;
  perform public._require_clean(p_username, 'usuario', 'El usuario');
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

create or replace function public.update_username(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._me(); last timestamptz;
begin
  select username_changed_at into last from public.profiles where id = uid;
  if last is not null and last > now() - interval '30 days' then
    raise exception 'Puedes cambiar tu usuario de nuevo el %.', to_char(last + interval '30 days', 'DD/MM');
  end if;
  if coalesce(p_username, '') !~ '^[A-Za-z0-9._]{3,16}$' then
    raise exception 'El usuario debe tener de 3 a 16 caracteres: letras, números, punto o guion bajo.';
  end if;
  perform public._require_clean(p_username, 'usuario', 'El usuario');
  if not public.username_available(p_username) then raise exception 'Ese usuario no está disponible.'; end if;
  update public.profiles set username = p_username, username_changed_at = now() where id = uid;
end $$;

create or replace function public._check_tournament(t public.tournaments)
returns void language plpgsql stable set search_path = '' as $$
declare x jsonb;
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
  -- Premios: lista corta y cerrada; el detalle es texto libre corto.
  if jsonb_typeof(t.prize_list) <> 'array' or jsonb_array_length(t.prize_list) > 12 then
    raise exception 'Puedes poner hasta 12 premios.';
  end if;
  for x in select * from jsonb_array_elements(t.prize_list) loop
    if coalesce(x->>'place', '') not in ('1', '2', '3', 'top4', 'top8', 'todos', 'mencion') then raise exception 'Elige para qué lugar es cada premio.'; end if;
    if coalesce(x->>'kind', '') not in ('carta', 'pase', 'dinero', 'fisico', 'otro') then raise exception 'Elige el tipo de cada premio.'; end if;
    if length(trim(coalesce(x->>'detail', ''))) not between 1 and 80 then raise exception 'Describe cada premio en 80 caracteres o menos.'; end if;
    perform public._require_clean(x->>'detail', 'texto', 'El detalle de un premio');
  end loop;
  -- Nombres y textos públicos.
  perform public._require_clean(t.name, 'torneo', 'El nombre del torneo');
  perform public._require_clean(t.club, 'club', 'El nombre del club');
  perform public._require_clean(t.prizes, 'texto', 'La entrega de premios');
  perform public._require_clean(t.notes, 'texto', 'Las notas');
end $$;

create or replace function public.set_announcement(p_tournament uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; r record;
begin
  perform public._require_staff(p_tournament);
  perform public._require_clean(p_text, 'texto', 'El anuncio');
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
declare new_id uuid;
begin
  perform public._require_staff(p_tournament);
  if (select t.status from public.tournaments t where t.id = p_tournament) not in ('registration', 'running') then
    raise exception 'Solo se agregan invitados antes de terminar el torneo.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 24 then raise exception 'El nombre del invitado lleva de 2 a 24 caracteres.'; end if;
  perform public._require_clean(p_name, 'invitado', 'El nombre del invitado');
  insert into public.registrations (tournament_id, guest_name, status) values (p_tournament, trim(p_name), 'checked_in') returning registrations.id into new_id;
  perform public._audit(p_tournament, 'Agregó un invitado', jsonb_build_object('nombre', p_name));
  return new_id;
end $$;

-- ───────────── Superadmin ─────────────

create or replace function public._require_superadmin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public._me();
begin
  if not public.is_superadmin(uid) then raise exception 'Solo el superadmin puede hacer esto.' using errcode = '42501'; end if;
  return uid;
end $$;

create or replace function public.admin_add_term(p_term text, p_kind text, p_fields text[], p_whole_word boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := public._require_superadmin(); n text := public._norm_term(p_term); new_id bigint;
begin
  if char_length(n) < 2 then raise exception 'Escribe una palabra de al menos 2 letras.'; end if;
  if p_kind not in ('ofensivo', 'reservado', 'marca', 'contacto', 'permitido') then raise exception 'Elige un tipo válido.'; end if;
  if coalesce(cardinality(p_fields), 0) = 0 or not (p_fields <@ '{usuario,invitado,torneo,club,texto}'::text[]) then
    raise exception 'Elige dónde aplica.';
  end if;
  insert into public.blocked_terms (term, norm, kind, fields, whole_word, created_by)
  values (trim(p_term), n, p_kind, p_fields, coalesce(p_whole_word, false), uid)
  on conflict (norm, kind) do update set fields = excluded.fields, whole_word = excluded.whole_word, term = excluded.term
  returning id into new_id;
  perform public._audit(null, 'Agregó una palabra al filtro', jsonb_build_object('palabra', trim(p_term), 'tipo', p_kind, 'aplica', p_fields));
  return new_id;
end $$;

create or replace function public.admin_remove_term(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.blocked_terms;
begin
  perform public._require_superadmin();
  delete from public.blocked_terms where id = p_id returning * into t;
  if t.id is null then raise exception 'Esa palabra ya no está en la lista.'; end if;
  perform public._audit(null, 'Quitó una palabra del filtro', jsonb_build_object('palabra', t.term, 'tipo', t.kind));
end $$;

-- Prueba un texto contra el filtro sin guardar nada (para revisar la lista).
create or replace function public.admin_test_text(p_text text, p_field text)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_superadmin();
  return public._text_issue(p_text, p_field);
end $$;

-- Renombrar un torneo por queja de un titular de derechos o por moderación. Aplica el mismo filtro al nombre nuevo.
create or replace function public.admin_rename_tournament(p_code text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tournaments;
begin
  perform public._require_superadmin();
  select * into t from public.tournaments where upper(code) = upper(trim(p_code));
  if t.id is null then raise exception 'No encontramos un torneo con ese código.'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 60 then raise exception 'El nombre lleva de 3 a 60 caracteres.'; end if;
  perform public._require_clean(p_name, 'torneo', 'El nombre del torneo');
  update public.tournaments set name = trim(p_name) where id = t.id;
  perform public._notify(t.organizer_id, 'moderacion', 'Cambiamos el nombre de tu torneo',
    '"' || t.name || '" ahora se llama "' || trim(p_name) || '" porque no cumplía las reglas de nombres.', '/staff/torneo/' || t.id);
  perform public._audit(t.id, 'Renombró el torneo por moderación', jsonb_build_object('antes', t.name, 'ahora', trim(p_name)));
end $$;

-- Renombra un club en todos sus torneos. Nombre vacío = quitar el club.
create or replace function public.admin_rename_club(p_old text, p_new text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int; r record; nuevo text := nullif(trim(coalesce(p_new, '')), '');
begin
  perform public._require_superadmin();
  if nullif(trim(coalesce(p_old, '')), '') is null then raise exception 'Escribe el nombre actual del club.'; end if;
  if char_length(coalesce(nuevo, '')) > 40 then raise exception 'El nombre del club lleva hasta 40 caracteres.'; end if;
  perform public._require_clean(nuevo, 'club', 'El nombre del club');
  for r in select distinct organizer_id from public.tournaments where lower(club) = lower(trim(p_old)) loop
    perform public._notify(r.organizer_id, 'moderacion', 'Cambiamos el nombre de tu club',
      case when nuevo is null then 'Quitamos el club "' || trim(p_old) || '" de tus torneos porque no cumplía las reglas de nombres.'
           else '"' || trim(p_old) || '" ahora se llama "' || nuevo || '" porque no cumplía las reglas de nombres.' end, '/staff');
  end loop;
  update public.tournaments set club = nuevo where lower(club) = lower(trim(p_old));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No encontramos torneos con ese club.'; end if;
  perform public._audit(null, 'Renombró un club por moderación', jsonb_build_object('antes', trim(p_old), 'ahora', nuevo, 'torneos', n));
  return n;
end $$;

-- Nombres que ya existían y no pasan el filtro actual (para revisarlos después de cambiar la lista).
create or replace function public.admin_flagged_names()
returns table (kind text, ref text, value text, issue text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_superadmin();
  return query
    select 'usuario'::text, p.id::text, p.username::text, public._text_issue(p.username::text, 'usuario')
      from public.profiles p where public._text_issue(p.username::text, 'usuario') is not null
    union all
    select 'torneo', t.code, t.name, public._text_issue(t.name, 'torneo')
      from public.tournaments t where t.status <> 'cancelled' and public._text_issue(t.name, 'torneo') is not null
    union all
    select 'club', min(t.club), min(t.club), public._text_issue(min(t.club), 'club')
      from public.tournaments t where t.club is not null and t.status <> 'cancelled'
      group by lower(t.club) having public._text_issue(min(t.club), 'club') is not null
    limit 100;
end $$;

-- ───────────── Permisos ─────────────

revoke all on public.blocked_terms from anon;
revoke insert, update, delete on public.blocked_terms from authenticated;
revoke execute on function public._text_issue(text, text), public._require_clean(text, text, text), public._require_superadmin()
  from public, anon, authenticated;
revoke execute on function public.admin_add_term(text, text, text[], boolean), public.admin_remove_term(bigint), public.admin_test_text(text, text),
  public.admin_rename_tournament(text, text), public.admin_rename_club(text, text), public.admin_flagged_names() from public, anon;
grant execute on function public.admin_add_term(text, text, text[], boolean), public.admin_remove_term(bigint), public.admin_test_text(text, text),
  public.admin_rename_tournament(text, text), public.admin_rename_club(text, text), public.admin_flagged_names() to authenticated;
