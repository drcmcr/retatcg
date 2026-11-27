import Link from "next/link";
import { ActionButton } from "@/components/client";
import { Icon } from "@/components/Icon";
import { TournamentCard } from "@/components/TournamentCard";
import { publishTournament } from "@/actions/staff";
import { requireTournamentStaff } from "@/lib/staff";
import { publishConfirm } from "@/lib/game";
import { loadRegs } from "@/lib/tournament";

export const metadata = { title: "Vista previa" };

/** Cómo verán los jugadores el torneo: la tarjeta de la lista y la página antes de inscribirse. */
export default async function VistaPrevia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const regs = await loadRegs(t.id);
  const taken = regs.filter((r) => r.status === "registered" || r.status === "checked_in").length;
  // En borrador se muestra como quedará al publicarlo: con la inscripción abierta.
  const status = ["draft", "pending_approval"].includes(t.status) ? "registration" : t.status;
  const url = `/torneo/${t.code}?vista=jugador`;

  return (
    <>
      <div className="row between wrap">
        <div className="col" style={{ gap: 2 }}>
          <h1 className="t1">Vista previa</h1>
          <span className="sm">Así verán los jugadores <b style={{ color: "var(--ink)" }}>{t.name}</b>.{t.status === "draft" ? " Nadie más lo ve hasta que lo publiques." : ""}</span>
        </div>
        <div className="row wrap">
          <Link href={`/staff/torneo/${t.id}`} className="btn g sm"><Icon name="back" size={18} />Panel</Link>
          {["draft", "pending_approval", "registration"].includes(t.status) && <Link href={`/staff/torneo/${t.id}/editar`} className="btn g sm"><Icon name="edit" size={18} />Editar</Link>}
          {t.status === "draft" && <ActionButton className="btn p sm" action={publishTournament} args={[t.id]} ok="Publicado." confirm={publishConfirm(t)}>Publicar torneo</ActionButton>}
        </div>
      </div>

      <div className="pv">
        <section className="col" style={{ gap: 10 }} aria-labelledby="pv1">
          <span id="pv1" className="lbl">1 · En la lista de torneos</span>
          <TournamentCard t={{ ...t, status, taken }} href={url} />
          {t.invite_only
            ? <p className="xs" style={{ margin: 0 }}>Es solo con invitación: no sale en la lista pública. Los jugadores entran directo a la página (2) con el código o el QR.</p>
            : <p className="xs" style={{ margin: 0 }}>Toca la tarjeta para abrir la página como jugador.</p>}
        </section>
        <section className="col" style={{ gap: 10 }} aria-labelledby="pv2">
          <span id="pv2" className="lbl">2 · Al abrirlo, antes de inscribirse</span>
          <div className="pv-phone"><iframe src={url} title="Página del torneo como la ve un jugador" /></div>
          <Link href={url} className="btn s pv-open"><Icon name="eye" size={18} />Abrir como jugador</Link>
        </section>
      </div>
    </>
  );
}
