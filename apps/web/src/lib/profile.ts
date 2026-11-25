import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type HistoryRow = { tournament_id: string; placement: number; wins: number; losses: number; draws: number; pr_delta: number; created_at: string; name: string; code: string; category: string; players: number };

export async function history(userId: string, limit = 50): Promise<HistoryRow[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("results")
    .select("tournament_id,placement,wins,losses,draws,pr_delta,created_at,tournament:tournaments(name,code,category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as (HistoryRow & { tournament: { name: string; code: string; category: string } })[];
  if (!rows.length) return [];
  const { data: counts } = await supabase.from("results").select("tournament_id").in("tournament_id", rows.map((r) => r.tournament_id));
  const n = new Map<string, number>();
  for (const c of counts ?? []) n.set(c.tournament_id, (n.get(c.tournament_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, name: r.tournament.name, code: r.tournament.code, category: r.tournament.category, players: n.get(r.tournament_id) ?? 0 }));
}

export async function leaderboardPosition(userId: string, seasonId: number, pr: number): Promise<number> {
  const supabase = await supabaseServer();
  const { count } = await supabase.from("player_seasons").select("user_id", { count: "exact", head: true }).eq("season_id", seasonId).gt("pr", pr);
  return (count ?? 0) + 1;
}

export async function loadProfileByUsername(username: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profiles").select("*").ilike("username", username.replace(/[%_]/g, "\\$&")).maybeSingle();
  return data;
}
