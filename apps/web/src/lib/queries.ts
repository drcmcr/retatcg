import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type Center = { label: string; href: string; icon: "play" | "check" | "qr" | "clock" | "cal"; pulse?: boolean; idle?: boolean };

/** Qué le toca ahora al jugador: alimenta el botón central y el banner de inicio. */
export async function whatsNow(userId: string): Promise<{ center: Center; banner: null | { text: string; href: string; ends?: string | null } }> {
  const supabase = await supabaseServer();
  const { data: regs } = await supabase
    .from("registrations")
    .select("id,status,checked_in_at,tournament:tournaments!inner(id,code,name,status,current_round,starts_at,checkin_minutes,pace)")
    .eq("user_id", userId)
    .in("status", ["registered", "checked_in", "waitlist"])
    .in("tournament.status", ["registration", "running"]);
  const list = (regs ?? []) as unknown as { id: string; status: string; checked_in_at: string | null; tournament: { id: string; code: string; name: string; status: string; current_round: number; starts_at: string; checkin_minutes: number; pace: { kind: string } } }[];

  for (const r of list.filter((x) => x.tournament.status === "running" && x.status === "checked_in")) {
    const { data: m } = await supabase
      .from("matches")
      .select("id,table_no,status,b,round:rounds!inner(number,ends_at,status)")
      .eq("tournament_id", r.tournament.id)
      .eq("round.number", r.tournament.current_round)
      .or(`a.eq.${r.id},b.eq.${r.id}`)
      .maybeSingle();
    const match = m as unknown as { id: string; table_no: number; status: string; b: string | null; round: { number: number; ends_at: string | null } } | null;
    if (!match) continue;
    if (match.b === null) {
      return { center: { label: "Bye", href: `/mesa/${match.id}`, icon: "clock" }, banner: { text: `Ronda ${match.round.number} · Bye`, href: `/mesa/${match.id}` } };
    }
    if (match.status === "confirmed") {
      return { center: { label: `Ronda ${match.round.number + 1}`, href: `/mesa/${match.id}`, icon: "clock", idle: true }, banner: { text: `Esperando ronda ${match.round.number + 1}`, href: `/mesa/${match.id}` } };
    }
    const coordinate = r.tournament.pace.kind === "ventana" && ["pending", "scheduled"].includes(match.status);
    return {
      center: { label: coordinate ? "Coordinar" : `Mesa ${match.table_no}`, href: `/mesa/${match.id}`, icon: coordinate ? "cal" : "play", pulse: true },
      banner: { text: `Ronda ${match.round.number} · Mesa ${match.table_no}`, href: `/mesa/${match.id}`, ends: match.round.ends_at },
    };
  }
  const now = Date.now();
  for (const r of list.filter((x) => x.tournament.status === "registration" && (x.status === "registered" || (x.status === "waitlist" && !x.checked_in_at)) && x.tournament.pace.kind !== "ventana")) {
    const opens = new Date(r.tournament.starts_at).getTime() - r.tournament.checkin_minutes * 60_000;
    if (now >= opens) {
      return { center: { label: "Check-in", href: `/torneo/${r.tournament.code}/checkin`, icon: "check", pulse: true }, banner: { text: `Check-in abierto · ${r.tournament.name}`, href: `/torneo/${r.tournament.code}/checkin`, ends: r.tournament.starts_at } };
    }
  }
  return { center: { label: "Unirse", href: "/unirse", icon: "qr", idle: true }, banner: null };
}

export async function unreadCount(userId: string): Promise<number> {
  const supabase = await supabaseServer();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
