import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, loadRounds, regName } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtTime } from "@/lib/format";
import { ResultForm } from "./ResultForm";

export const metadata = { title: "Resultado de mesa" };

export default async function StaffMesa({ params }: { params: Promise<{ id: string; match: string }> }) {
  const { id, match } = await params;
  const { t } = await requireTournamentStaff(id);
  const [regs, { rounds, matches }] = await Promise.all([loadRegs(t.id), loadRounds(t.id)]);
  const m = matches.find((x) => x.id === match);
  if (!m || !m.b) notFound();
  const round = rounds.find((r) => r.id === m.round_id)!;
  const byId = new Map(regs.map((r) => [r.id, r]));
  const supabase = await supabaseServer();
  const { data: events } = await supabase.from("match_events").select("at,kind,data,actor,profile:profiles(username)").eq("match_id", m.id).order("at");
  return (
    <>
      <Link href={`/staff/torneo/${t.id}`} className="link" style={{ padding: 0 }}>← Control de ronda</Link>
      <h1 className="t1">Mesa {m.table_no} · ronda {round.number}</h1>
      <div className="grid2">
        <ResultForm matchId={m.id} a={regName(byId.get(m.a))} b={regName(byId.get(m.b))} bestOf={round.best_of} stage={round.stage}
          current={{ a: m.games_a, b: m.games_b, d: m.game_draws, dl: m.double_loss, status: m.status }} />
        <div className="box n4 col" style={{ gap: 6 }}>
          <span className="lbl" style={{ fontSize: 16 }}>Registro de la mesa</span>
          {(events ?? []).map((e, i) => (
            <div key={i} className="row sm" style={{ alignItems: "flex-start" }}>
              <span className="mono" style={{ width: 48, flex: "none" }}>{fmtTime(e.at)}</span>
              <span style={{ color: "var(--ink)" }}>{(e.profile as { username?: string } | null)?.username ?? "Reta"}: {(e.data as { texto?: string })?.texto ?? e.kind}{(e.data as { a?: number })?.a !== undefined ? ` ${(e.data as { a: number }).a}-${(e.data as { b: number }).b}` : ""}</span>
            </div>
          ))}
          {!events?.length && <span className="sm">Sin movimientos todavía.</span>}
        </div>
      </div>
    </>
  );
}
