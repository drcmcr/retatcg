import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { TCard } from "@/components/TournamentCard";

const COLS = "id,code,name,club,category,status,starts_at,pace,format,swiss_rounds,top_cut,swiss_best_of,top_best_of,capacity,min_rank,current_round";

/** Torneos con su conteo de lugares tomados. */
export async function tournamentCards(filter: { status: string[]; ids?: string[]; category?: string; limit?: number; ascending?: boolean }): Promise<(TCard & { id: string })[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("tournaments").select(COLS).in("status", filter.status).order("starts_at", { ascending: filter.ascending ?? true }).limit(filter.limit ?? 40);
  if (filter.ids) q = q.in("id", filter.ids.length ? filter.ids : ["00000000-0000-0000-0000-000000000000"]);
  else q = q.eq("invite_only", false);
  if (filter.category) q = q.eq("category", filter.category);
  const { data } = await q;
  const list = (data ?? []) as unknown as (TCard & { id: string })[];
  if (!list.length) return [];
  const { data: regs } = await supabase.from("registrations").select("tournament_id").in("tournament_id", list.map((t) => t.id)).in("status", ["registered", "checked_in"]);
  const counts = new Map<string, number>();
  for (const r of regs ?? []) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
  return list.map((t) => ({ ...t, taken: counts.get(t.id) ?? 0 }));
}
