-- Reta · esquema base
-- Todas las escrituras de la app pasan por funciones (RPC) con sus reglas; las tablas solo se leen con RLS.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ───────────── Personas ─────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username ~ '^[A-Za-z0-9._]{3,16}$'),
  username_changed_at timestamptz,
  -- Título en uso: el código de la medalla que lo desbloqueó y su forma ('a' o 'b').
  title_medal text,
  title_form text not null default 'a' check (title_form in ('a', 'b')),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  -- Eliminación programada: 7 días para arrepentirse.
  deleting_at timestamptz
);

-- Datos que nunca son públicos.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birthdate date not null,
  pocket_name text check (char_length(pocket_name) between 1 and 20),
  friend_id text check (friend_id ~ '^[0-9]{16}$'),
  timezone text not null default 'America/Mexico_City',
  terms_accepted_at timestamptz not null,
  notify jsonb not null default '{"torneo": true, "social": false}'::jsonb,
  reduce_motion boolean not null default false
);

create table public.platform_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('organizer', 'superadmin')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ───────────── Temporadas y progresión ─────────────

create table public.seasons (
  id int primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz
);

create table public.player_seasons (
  season_id int not null references public.seasons (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pr int not null default 0 check (pr >= 0),
  highest_rank int not null default 0,
  medals text[] not null default '{}',
  primary key (season_id, user_id)
);

-- Títulos desbloqueados: se quedan para siempre.
create table public.titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  medal text not null,
  season_id int references public.seasons (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, medal)
);

-- ───────────── Torneos ─────────────

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 3 and 60),
  organizer_id uuid not null references public.profiles (id),
  club text check (char_length(club) <= 40),
  category text not null check (category in ('casual', 'comunitario', 'clasificatorio', 'mayor')),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'registration', 'running', 'finished', 'cancelled')),
  format text not null default 'swiss_topcut' check (format in ('swiss_topcut', 'swiss', 'single_elim')),
  swiss_rounds int not null default 0 check (swiss_rounds between 0 and 12),
  top_cut int not null default 0 check (top_cut in (0, 2, 4, 8, 16)),
  swiss_best_of int not null default 1 check (swiss_best_of in (1, 3)),
  top_best_of int not null default 3 check (top_best_of in (1, 3)),
  -- {kind:'en_vivo'} | {kind:'jornadas', sessions:[{startsAt, rounds:[..]}]} | {kind:'ventana', windowHours}
  pace jsonb not null default '{"kind":"en_vivo"}'::jsonb,
  deck_policy text not null default 'por_ronda' check (deck_policy in ('libre', 'por_ronda', 'fijo')),
  restrictions jsonb not null default '{}'::jsonb,
  capacity int not null default 32 check (capacity between 2 and 256),
  starts_at timestamptz not null,
  checkin_minutes int not null default 30 check (checkin_minutes between 5 and 180),
  -- Minutos por ronda en vivo (null = 25 en Bo1, 50 en Bo3).
  round_minutes int check (round_minutes between 10 and 120),
  -- Minutos que tiene el rival para confirmar un reporte (null = 5 en vivo, 60 por ventana).
  confirm_minutes int check (confirm_minutes between 1 and 240),
  min_rank int not null default 0,
  prizes text check (char_length(prizes) <= 200),
  notes text check (char_length(notes) <= 1000),
  announcement text check (char_length(announcement) <= 280),
  announcement_at timestamptz,
  lot_seed text not null default encode(extensions.gen_random_bytes(8), 'hex'),
  season_id int references public.seasons (id),
  stage text check (stage in ('swiss', 'top')),
  current_round int not null default 0,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.profiles (lower(username::text));
create index on public.tournaments (status, starts_at);
create index on public.tournaments (organizer_id);

create table public.tournament_staff (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('organizer', 'judge')),
  primary key (tournament_id, user_id)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  guest_name text check (char_length(guest_name) between 2 and 24),
  status text not null default 'registered'
    check (status in ('registered', 'waitlist', 'checked_in', 'dropped', 'removed')),
  -- Rango al empezar el torneo (para la medalla Relámpago).
  rank_at_start int,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  dropped_at timestamptz,
  check (user_id is not null or guest_name is not null),
  unique (tournament_id, user_id)
);
create index on public.registrations (tournament_id, status);
create index on public.registrations (user_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  number int not null check (number >= 1),
  stage text not null check (stage in ('swiss', 'top')),
  best_of int not null check (best_of in (1, 3)),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  seed text not null,
  started_at timestamptz not null default now(),
  -- En vivo y jornadas: fin del reloj. Por ventana: fecha límite.
  ends_at timestamptz,
  paused_remaining interval,
  closed_at timestamptz,
  unique (tournament_id, number)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  table_no int not null,
  a uuid not null references public.registrations (id),
  b uuid references public.registrations (id),
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'playing', 'reported', 'disputed', 'confirmed')),
  games_a int not null default 0,
  games_b int not null default 0,
  game_draws int not null default 0,
  double_loss boolean not null default false,
  winner uuid references public.registrations (id),
  reported_by uuid references public.registrations (id),
  reported_at timestamptz,
  confirmed_at timestamptz,
  confirmed_how text check (confirmed_how in ('rival', 'ambos', 'auto', 'juez', 'plazo', 'bye')),
  a_checkin_at timestamptz,
  b_checkin_at timestamptz,
  -- Por ventana: hora acordada, propuesta pendiente y extensión del organizador.
  scheduled_at timestamptz,
  proposed_at timestamptz,
  proposed_by uuid references public.registrations (id),
  extension_hours int not null default 0 check (extension_hours between 0 and 24),
  created_at timestamptz not null default now(),
  unique (round_id, table_no)
);
create index on public.matches (tournament_id);
create index on public.matches (a);
create index on public.matches (b);

-- Contraseña de la partida privada: solo la ven los dos jugadores y el staff.
create table public.match_secrets (
  match_id uuid primary key references public.matches (id) on delete cascade,
  password text not null,
  generation int not null default 1,
  updated_at timestamptz not null default now()
);

-- Registro de la mesa: check-in, mensajes rápidos, reportes, desconexiones.
create table public.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid references public.profiles (id) on delete set null,
  kind text not null,
  data jsonb not null default '{}'::jsonb
);
create index on public.match_events (match_id, at);

-- Por ventana: bloques de disponibilidad de cada jugador.
create table public.availability (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slots timestamptz[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- ───────────── Jueces y conducta ─────────────

create table public.cases (
  id bigint generated always as identity (start with 100) primary key,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  kind text not null check (kind in ('marcador', 'ausente', 'desconexion', 'conducta', 'juez', 'plazo')),
  status text not null default 'open' check (status in ('open', 'review', 'resolved')),
  opened_by uuid references public.profiles (id) on delete set null,
  judge_id uuid references public.profiles (id),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.cases (tournament_id, status);

create table public.case_messages (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases (id) on delete cascade,
  author uuid references public.profiles (id) on delete set null,
  role text not null check (role in ('player', 'judge', 'system')),
  -- Los jugadores solo responden con códigos fijos; el juez puede escribir.
  code text,
  body text check (char_length(body) <= 500),
  attachment text,
  at timestamptz not null default now()
);

create table public.deck_declarations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  registration_id uuid not null references public.registrations (id) on delete cascade,
  round int not null default 0,
  archetype text not null check (char_length(archetype) between 2 and 40),
  screenshot text not null,
  status text not null default 'unreviewed' check (status in ('unreviewed', 'approved', 'infraction')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (registration_id, round)
);

create table public.sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete set null,
  season_id int references public.seasons (id),
  kind text not null check (kind in ('advertencia', 'perdida_encuentro', 'suspension', 'revision_expulsion', 'expulsion')),
  pr_penalty int not null default 0,
  reason text not null,
  is_public boolean not null default false,
  suspended_until timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ───────────── Resultados ─────────────

create table public.results (
  registration_id uuid primary key references public.registrations (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  placement int not null,
  wins int not null,
  losses int not null,
  draws int not null,
  pr_delta int not null default 0,
  pr_breakdown jsonb not null default '{}'::jsonb,
  new_medals text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.results (user_id);

-- ───────────── Comunidad y avisos ─────────────

create table public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);
create index on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.mod_reports (
  id bigint generated always as identity primary key,
  reporter uuid references public.profiles (id) on delete set null,
  target_user uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('usuario_ofensivo', 'suplantacion', 'captura', 'trampa', 'otro')),
  detail text check (char_length(detail) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tournament_id uuid references public.tournaments (id) on delete cascade,
  actor uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index on public.audit_log (tournament_id, at desc);

-- Temporada 1 de la beta.
insert into public.seasons (id, name, starts_at, ends_at)
values (1, 'Temporada 1', '2026-11-01T00:00:00-06', '2027-01-31T23:59:59-06');
