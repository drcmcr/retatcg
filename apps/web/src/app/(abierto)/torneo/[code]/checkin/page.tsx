import { notFound, redirect } from "next/navigation";
import { checkin } from "@/actions/player";
import { ActionButton, Countdown, LiveRefresh } from "@/components/client";
import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { fmtTime } from "@/lib/format";
import { loadRegs, loadTournamentByCode } from "@/lib/tournament";

export const metadata = { title: "Check-in" };

export default async function Checkin({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await requireMe(`/torneo/${code}/checkin`);
  const t = await loadTournamentByCode(code);
  if (!t) notFound();
  if (t.status === "running") redirect(`/torneo/${t.code}`);
  const regs = await loadRegs(t.id);
  const mine = regs.find((r) => r.user_id === me.id);
  const done = regs.filter((r) => r.status === "checked_in").length;
  const total = regs.filter((r) => ["registered", "checked_in"].includes(r.status)).length;
  return (
    <main className="screen">
      <LiveRefresh channel={`checkin-${t.id}`} watch={[{ table: "registrations", filter: `tournament_id=eq.${t.id}` }]} />
      <TopBar title="Check-in" back={`/torneo/${t.code}`} />
      <div className="chk n6" style={{ padding: 16 }}>
        <div className="panel n4 col" style={{ alignItems: "center", textAlign: "center", gap: 6 }}>
          <span className="lbl">Cierra en</span>
          <Countdown to={t.starts_at} className="px20 lime" style={{ fontSize: 72, lineHeight: 0.9 }} />
          <span className="sm">{t.name} · empieza a las {fmtTime(t.starts_at)}</span>
        </div>
      </div>
      {mine?.status === "checked_in" ? (
        <div className="btn s" role="status">Ya estás. Te avisamos cuando salga tu mesa.</div>
      ) : mine?.status === "registered" ? (
        <ActionButton action={() => checkin(t.id)} ok="Check-in listo. ¡Suerte!">Estoy aquí</ActionButton>
      ) : mine?.status === "waitlist" && mine.checked_in_at ? (
        <div className="btn s" role="status">Estás presente en la lista de espera. Si alguien falta, entras y te avisamos.</div>
      ) : mine?.status === "waitlist" ? (
        <ActionButton action={() => checkin(t.id)} ok="Listo: si alguien falta, entras tú.">Estoy aquí (lista de espera)</ActionButton>
      ) : (
        <p className="sm">No tienes un lugar en este torneo.</p>
      )}
      <div className="row between sm"><span>Ya confirmaron</span><b style={{ color: "var(--ink)" }}>{done} de {total}</b></div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      <p className="xs">Quien no hace check-in queda fuera, cuenta como falta y su lugar pasa al primero en espera que sí lo hizo. Dos faltas en la temporada: 7 días sin poder inscribirte.</p>
    </main>
  );
}
