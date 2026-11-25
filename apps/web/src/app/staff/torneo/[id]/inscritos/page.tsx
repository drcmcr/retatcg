import { ActionButton, LiveRefresh } from "@/components/client";
import { Identicon } from "@/components/Identicon";
import { removeStaff, staffRegistration } from "@/actions/staff";
import { RANK_NAMES } from "@/lib/ranks";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, regName } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { AddGuest, AddJudge } from "./Forms";

export const metadata = { title: "Inscritos y staff" };

const ST: Record<string, string> = { registered: "Inscrito", checked_in: "Check-in listo", waitlist: "En espera", dropped: "Retirado", removed: "Fuera", no_show: "No se presentó" };

export default async function Inscritos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const regs = (await loadRegs(t.id)).filter((r) => r.status !== "removed");
  const supabase = await supabaseServer();
  const { data: staff } = await supabase.from("tournament_staff").select("user_id,role,profile:profiles(username)").eq("tournament_id", t.id);
  const ids = regs.map((r) => r.user_id).filter(Boolean) as string[];
  const { data: prs } = ids.length ? await supabase.from("player_seasons").select("user_id,pr").in("user_id", ids).eq("season_id", t.season_id ?? 1) : { data: [] };
  const pr = new Map((prs ?? []).map((p) => [p.user_id, p.pr]));
  const { data: att } = await supabase.rpc("tournament_attendance", { p_tournament: t.id });
  const attendance = new Map(((att ?? []) as { user_id: string; played: number; no_shows: number }[]).map((a) => [a.user_id, a]));
  const attLabel = (uid: string | null) => {
    const a = uid ? attendance.get(uid) : undefined;
    if (!a || a.played + a.no_shows === 0) return "Nuevo";
    return `${a.played} jugados · ${a.no_shows} ${a.no_shows === 1 ? "falta" : "faltas"}`;
  };
  return (
    <>
      <LiveRefresh channel={`ins-${t.id}`} watch={[{ table: "registrations", filter: `tournament_id=eq.${t.id}` }]} />
      <h1 className="t1">Inscritos</h1>
      <div className="grid2">
        <table className="tbl stack" style={{ fontSize: 15 }}>
          <thead><tr><th>Jugador</th><th>Rango</th><th>Asistencia</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td className="lead"><span className="row" style={{ gap: 8 }}><Identicon seed={r.user_id ?? r.id} size={24} /><b>{regName(r)}</b>{!r.user_id && <span className="xs">invitado</span>}</span></td>
                <td data-label="Rango">{r.user_id ? RANK_NAMES[Math.min(5, Math.floor((pr.get(r.user_id) ?? 0) / 300))] : "—"}</td>
                <td data-label="Asistencia" className={r.user_id && (attendance.get(r.user_id)?.no_shows ?? 0) > 0 ? "warn" : undefined}>{r.user_id ? attLabel(r.user_id) : "—"}</td>
                <td data-label="Estado">{ST[r.status]}</td>
                <td className="r nw act">
                  {r.status === "registered" && t.status === "registration" && <ActionButton className="link" action={() => staffRegistration(r.id, "checkin")} ok="Check-in hecho.">Hacer check-in</ActionButton>}{" "}
                  {!["dropped", "no_show"].includes(r.status) && <ActionButton className="link" action={() => staffRegistration(r.id, "remove")} confirm={`¿Quitar a ${regName(r)}?`} ok="Listo.">{t.status === "running" ? "Retirar" : "Quitar"}</ActionButton>}
                </td>
              </tr>
            ))}
            {!regs.length && <tr><td colSpan={4} className="sm">Aún no hay inscritos.</td></tr>}
          </tbody>
        </table>
        <div className="col" style={{ gap: 12 }}>
          {["registration", "running"].includes(t.status) && <AddGuest id={t.id} />}
          <div className="box n4 col" style={{ gap: 8 }}>
            <b>Staff del torneo</b>
            {(staff ?? []).map((s) => (
              <div key={s.user_id} className="li n4">
                <Identicon seed={s.user_id} size={28} />
                <span className="grow"><span className="ttl">{(s.profile as { username?: string } | null)?.username}</span><span className="xs">{s.role === "judge" ? "Juez" : "Organizador"}</span></span>
                {s.user_id !== t.organizer_id && <ActionButton className="link" action={() => removeStaff(t.id, s.user_id)} ok="Quitado.">Quitar</ActionButton>}
              </div>
            ))}
            <AddJudge id={t.id} />
          </div>
        </div>
      </div>
    </>
  );
}
