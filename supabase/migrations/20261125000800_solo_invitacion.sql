-- Reta · torneos solo con invitación: no salen en la lista pública; se entra con el código o el QR.
alter table public.tournaments add column if not exists invite_only boolean not null default false;

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
  if p ? 'notes' then t.notes := nullif(trim(p->>'notes'), ''); end if;
  if t.format = 'swiss' then t.top_cut := 0; end if;
  if t.format = 'single_elim' then t.swiss_rounds := 0; t.top_cut := 0; end if;
  return t;
end $$;
