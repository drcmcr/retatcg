"use server";
import { redirect } from "next/navigation";
import { callRpc, type ActionResult } from "@/lib/server-action";
import { supabaseServer } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;
const ok = (id: string) => uuid.test(id);

export async function register(tournamentId: string) {
  if (!ok(tournamentId)) return { ok: false, error: "Torneo no válido." } as ActionResult;
  return callRpc<string>("register", { p_tournament: tournamentId });
}
export async function unregister(tournamentId: string) { return callRpc("unregister", { p_tournament: tournamentId }); }
export async function checkin(tournamentId: string) { return callRpc("checkin", { p_tournament: tournamentId }); }
export async function dropTournament(tournamentId: string) { return callRpc("drop_tournament", { p_tournament: tournamentId }); }
export async function declareDeck(tournamentId: string, round: number, archetype: string, screenshot: string) {
  return callRpc("declare_deck", { p_tournament: tournamentId, p_round: round, p_archetype: archetype, p_screenshot: screenshot });
}

/** Unirse por código: TORN-12 o el código del QR. */
export async function findByCode(raw: string): Promise<ActionResult> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]+)(\d{2})$/, "$1-$2");
  if (!/^[A-Z]{2,8}-\d{2}$/.test(code)) return { ok: false, error: "El código tiene letras, guion y dos números. Ejemplo: NOCT-12." };
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tournaments").select("code").eq("code", code).maybeSingle();
  if (!data) return { ok: false, error: "No encontramos un torneo con ese código." };
  redirect(`/torneo/${data.code}`);
}
