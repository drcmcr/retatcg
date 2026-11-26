-- Reta · rendimiento (avisos del analizador de Supabase)
-- 1) Las reglas de acceso evalúan auth.uid() una sola vez por consulta, no una vez por fila.
-- 2) Índices en las relaciones que más se consultan.

alter policy "bloqueos" on public.blocks using (blocker = (select auth.uid()));
alter policy "mensajes de caso" on public.case_messages using (exists (
  select 1 from public.cases c where c.id = case_messages.case_id
    and (public.is_staff(c.tournament_id) or c.opened_by = (select auth.uid()) or (c.match_id is not null and public.is_match_player(c.match_id)))));
alter policy "casos" on public.cases using (
  public.is_staff(tournament_id) or opened_by = (select auth.uid()) or (match_id is not null and public.is_match_player(match_id)));
alter policy "mazos" on public.deck_declarations using (
  public.is_staff(tournament_id) or exists (select 1 from public.registrations r where r.id = deck_declarations.registration_id and r.user_id = (select auth.uid())));
alter policy "seguidos" on public.follows using (follower = (select auth.uid()) or followee = (select auth.uid()));
alter policy "reportes" on public.mod_reports using (reporter = (select auth.uid()) or public.is_superadmin());
alter policy "avisos" on public.notifications using (user_id = (select auth.uid()));
alter policy "mis roles" on public.platform_roles using (user_id = (select auth.uid()) or public.is_superadmin());
alter policy "pr de temporada" on public.player_seasons using (
  user_id = (select auth.uid()) or not exists (
    select 1 from public.profiles p where p.id = player_seasons.user_id and (p.is_private or p.deleting_at is not null)));
alter policy "solo yo" on public.profile_private using (user_id = (select auth.uid()));
alter policy "perfiles públicos" on public.profiles using (deleting_at is null or id = (select auth.uid()));
alter policy "suscripciones" on public.push_subscriptions using (user_id = (select auth.uid()));
alter policy "sanciones" on public.sanctions using (
  user_id = (select auth.uid()) or is_public or public.is_staff(tournament_id) or public.is_superadmin());

create index if not exists player_seasons_user_id_idx on public.player_seasons (user_id);
create index if not exists results_tournament_id_idx on public.results (tournament_id);
create index if not exists sanctions_user_id_idx on public.sanctions (user_id);
create index if not exists sanctions_tournament_id_idx on public.sanctions (tournament_id);
create index if not exists tournament_staff_user_id_idx on public.tournament_staff (user_id);
create index if not exists deck_declarations_tournament_id_idx on public.deck_declarations (tournament_id);
create index if not exists cases_match_id_idx on public.cases (match_id);
create index if not exists case_messages_case_id_idx on public.case_messages (case_id);
create index if not exists follows_followee_idx on public.follows (followee);
create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists tournament_invites_registration_id_idx on public.tournament_invites (registration_id);
