import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { loadTournament } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";

/** Torneos donde la persona es organizadora o jueza. */
export async function myStaffTournaments(userId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tournament_staff").select("role,tournament:tournaments(*)").eq("user_id", userId);
  return ((data ?? []) as unknown as { role: string; tournament: Record<string, unknown> & { id: string } }[]).filter((x) => x.tournament);
}

export async function requireStaffArea() {
  const me = await requireMe("/staff");
  if (me.isOrganizer) return me;
  const list = await myStaffTournaments(me.id);
  if (!list.length) redirect("/inicio");
  return me;
}

export async function requireTournamentStaff(id: string) {
  const me = await requireMe(`/staff/torneo/${id}`);
  const t = await loadTournament(id);
  if (!t) notFound();
  const supabase = await supabaseServer();
  const { data: ok } = await supabase.rpc("is_staff", { t: id, uid: me.id });
  if (!ok) notFound();
  return { me, t };
}
