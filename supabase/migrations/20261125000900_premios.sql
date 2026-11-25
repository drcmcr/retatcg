-- Reta · premios del torneo por lugar y tipo (cartas digitales, pase, dinero, físicos, otros).
-- Reta solo los muestra; los entrega el organizador.
alter table public.tournaments add column if not exists prize_list jsonb not null default '[]'::jsonb;

create or replace function public._apply_tournament_fields(t public.tournaments, p jsonb)
returns public.tournaments language plpgsql stable set search_path = '' as $$
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
  if p ? 'invite_only' then t.invite_only := coalesce((p->>'invite_only')::boolean, false); end if;
  t.invite_only := coalesce(t.invite_only, false);
  if p ? 'prize_list' then t.prize_list := coalesce(p->'prize_list', '[]'::jsonb); end if;
  t.prize_list := coalesce(t.prize_list, '[]'::jsonb);
  if p ? 'notes' then t.notes := nullif(trim(p->>'notes'), ''); end if;
  if t.format = 'swiss' then t.top_cut := 0; end if;
  if t.format = 'single_elim' then t.swiss_rounds := 0; t.top_cut := 0; end if;
  return t;
end $$;

create or replace function public._check_tournament(t public.tournaments)
returns void language plpgsql immutable set search_path = '' as $$
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
  end loop;
end $$;
