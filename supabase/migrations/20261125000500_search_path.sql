-- Reta · funciones auxiliares sin acceso a tablas: también con search_path fijo.
alter function public._rank_index(int) set search_path = '';
alter function public._gen_password() set search_path = '';
alter function public._username_ok(text) set search_path = '';
alter function public._apply_tournament_fields(public.tournaments, jsonb) set search_path = '';
alter function public._check_tournament(public.tournaments) set search_path = '';
alter function public._valid_score(int, text, int, int, int) set search_path = '';
