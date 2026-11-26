-- Reta · cuando el juez pone el resultado de una mesa, sus casos de marcador se cierran solos.
-- Antes había que cerrarlos a mano y, si se olvidaba, quedaban abiertos aunque el torneo terminara.
-- Los casos de conducta (y las llamadas generales al juez) siguen abiertos: van aparte del marcador.

create or replace function public._close_match_cases(p_match uuid, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; u record;
begin
  for c in update public.cases set status = 'resolved', resolution = p_resolution, resolved_at = now(), judge_id = coalesce(judge_id, auth.uid())
           where match_id = p_match and status <> 'resolved' and kind in ('marcador', 'desconexion', 'plazo', 'ausente')
           returning id loop
    insert into public.case_messages (case_id, author, role, body) values (c.id, auth.uid(), 'judge', 'Resuelto: ' || left(p_resolution, 480));
    for u in select r.user_id from public.matches m join public.registrations r on r.id in (m.a, m.b) where m.id = p_match and r.user_id is not null loop
      perform public._notify(u.user_id, 'caso', 'Tu caso #' || c.id || ' se resolvió', left(p_resolution, 120), '/caso/' || c.id);
    end loop;
  end loop;
end $$;

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
  perform public._close_match_cases(m.id, 'El juez puso el resultado: ' || trim(p_reason));
  perform public._audit(m.tournament_id, 'Puso el resultado de la mesa ' || m.table_no,
    jsonb_build_object('antes', before, 'despues', jsonb_build_object('a', p_games_a, 'b', p_games_b, 'empates', p_draws, 'doble', p_double_loss), 'motivo', p_reason));
end $$;

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
  perform public._close_match_cases(m.id, 'El juez marcó que un jugador no se presentó.');
  perform public._audit(m.tournament_id, 'No se presentó en la mesa ' || m.table_no,
    jsonb_build_object('jugador', (select coalesce(p.username::text, g.guest_name) from public.registrations g left join public.profiles p on p.id = g.user_id where g.id = p_absent)));
end $$;

revoke execute on function public._close_match_cases(uuid, text) from public, anon, authenticated;
