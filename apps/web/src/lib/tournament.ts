import "server-only";
import { computeStandings, type MatchRecord } from "@reta/torneo";
import { supabaseServer } from "@/lib/supabase/server";

export type T = {
  id: string; code: string; name: string; club: string | null; category: string; status: string; format: string;
  swiss_rounds: number; top_cut: number; swiss_best_of: number; top_best_of: number;
  pace: { kind: string; windowHours?: number; sessions?: { startsAt: string; rounds: number[] }[] };
  deck_policy: string; restrictions: Record<string, unknown>; capacity: number; starts_at: string; checkin_minutes: number;
  min_rank: number; confirm_minutes: number | null; round_minutes: number | null; prizes: string | null; notes: string | null; announcement: string | null; announcement_at: string | null;
  lot_seed: string; stage: string | null; current_round: number; organizer_id: string; season_id: number | null;
};
export type Reg = { id: string; user_id: string | null; guest_name: string | null; status: string; created_at: string; checked_in_at: string | null; username: string | null; rank_at_start: number | null };
export type Round = { id: string; number: number; stage: string; best_of: number; status: string; started_at: string; ends_at: string | null; paused_remaining: string | null };
export type Match = {
  id: string; round_id: string; table_no: number; a: string; b: string | null; status: string; games_a: number; games_b: number;
  game_draws: number; double_loss: boolean; winner: string | null; reported_by: string | null; reported_at: string | null;
  confirmed_how: string | null; scheduled_at: string | null; proposed_at: string | null; proposed_by: string | null; extension_hours: number;
  a_checkin_at: string | null; b_checkin_at: string | null;
};

export async function loadTournamentByCode(code: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tournaments").select("*").eq("code", code.toUpperCase()).maybeSingle();
  return data as T | null;
}

export async function loadTournament(id: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  return data as T | null;
}

export async function loadRegs(tournamentId: string): Promise<Reg[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("registrations")
    .select("id,user_id,guest_name,status,created_at,checked_in_at,rank_at_start,profile:profiles(username)")
    .eq("tournament_id", tournamentId)
    .order("created_at");
  return ((data ?? []) as unknown as (Reg & { profile: { username: string } | null })[]).map((r) => ({ ...r, username: r.profile?.username ?? null }));
}

export async function loadRounds(tournamentId: string) {
  const supabase = await supabaseServer();
  const [{ data: rounds }, { data: matches }] = await Promise.all([
    supabase.from("rounds").select("*").eq("tournament_id", tournamentId).order("number"),
    supabase.from("matches").select("*").eq("tournament_id", tournamentId).order("table_no"),
  ]);
  return { rounds: (rounds ?? []) as Round[], matches: (matches ?? []) as Match[] };
}

export function regName(r: Reg | undefined | null): string {
  return r?.username ?? r?.guest_name ?? "Jugador";
}

/** Tabla con los mismos desempates del motor (solo rondas suizas). */
export function standings(t: T, regs: Reg[], rounds: Round[], matches: Match[]) {
  const swissRounds = new Set(rounds.filter((r) => r.stage === "swiss").map((r) => r.id));
  const roundNo = new Map(rounds.map((r) => [r.id, r.number]));
  const playing = regs.filter((r) => r.status === "checked_in" || r.status === "dropped");
  const ids = new Set(playing.map((r) => r.id));
  const recs: MatchRecord[] = matches
    .filter((m) => m.status === "confirmed" && swissRounds.has(m.round_id) && ids.has(m.a) && (m.b === null || ids.has(m.b)))
    .map((m) => ({ round: roundNo.get(m.round_id) ?? 0, a: m.a, b: m.b, gamesA: m.games_a, gamesB: m.games_b, gameDraws: m.game_draws, doubleLoss: m.double_loss }));
  return computeStandings(playing.map((r) => ({ id: r.id, dropped: r.status === "dropped" })), recs, { lotSeed: t.lot_seed });
}

export function bestOfFor(t: T, stage: string) {
  return stage === "top" ? t.top_best_of : t.swiss_best_of;
}
