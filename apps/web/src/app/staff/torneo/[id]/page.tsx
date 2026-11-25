import Link from "next/link";
import { ActionButton, Countdown, LiveRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Stat } from "@/components/ui";
import { cancelTournament, nextRound, publishTournament, roundClock, staffMatch, startTournament } from "@/actions/staff";
import { CATEGORY, PACE_LABEL, formatLabel } from "@/lib/game";
import { fmtDateTime } from "@/lib/format";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, loadRounds, regName } from "@/lib/tournament";
import { Announcement } from "./Announcement";
import { now } from "@/lib/time";

export const metadata = { title: "Control del torneo" };

const ST: Record<string, [string, string, "check" | "play" | "clock" | "flag" | "cal"]> = {
  confirmed: ["var(--ok)", "Confirmada", "check"], playing: ["var(--cyan)", "Jugando", "play"], reported: ["var(--warn)", "Por confirmar", "clock"],
  disputed: ["var(--err)", "Disputa", "flag"], pending: ["var(--line)", "Sin empezar", "clock"], scheduled: ["var(--cyan)", "Agendada", "cal"],
};

export default async function Control({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const [regs, { rounds, matches }] = await Promise.all([loadRegs(t.id), loadRounds(t.id)]);
  const byId = new Map(regs.map((r) => [r.id, r]));
  const round = rounds.find((r) => r.number === t.current_round);
  const current = round ? matches.filter((m) => m.round_id === round.id) : [];
  const pending = current.filter((m) => m.status !== "confirmed").length;
  const checked = regs.filter((r) => r.status === "checked_in").length;
  const registered = regs.filter((r) => ["registered", "checked_in"].includes(r.status)).length;
  const late = round?.ends_at && new Date(round.ends_at).getTime() < now();
  const order = (s: string) => ["disputed", "reported", "pending", "scheduled", "playing", "confirmed"].indexOf(s);
  const sorted = [...current].sort((a, b) => order(a.status) - order(b.status) || a.table_no - b.table_no);

  return (
    <>
      <LiveRefresh channel={`staff-${t.id}`} watch={[{ table: "matches", filter: `tournament_id=eq.${t.id}` }, { table: "registrations", filter: `tournament_id=eq.${t.id}` }, { table: "tournaments", filter: `id=eq.${t.id}` }, { table: "rounds", filter: `tournament_id=eq.${t.id}` }, { table: "cases", filter: `tournament_id=eq.${t.id}` }]} />
      <div className="row between wrap">
        <div className="col" style={{ gap: 2 }}>
          <h1 className="t1">{t.status === "running" && round ? `Ronda ${round.number}${round.stage === "swiss" && t.format !== "single_elim" ? ` de ${t.swiss_rounds}` : " · eliminación"}` : t.name}</h1>
          <span className="sm">{t.name} · {CATEGORY[t.category]?.label} · {formatLabel(t)} · {PACE_LABEL[t.pace.kind]} · código <span className="mono">{t.code}</span></span>
        </div>
        <div className="row">
          <Link href={`/torneo/${t.code}`} className="btn g sm"><Icon name="eye" size={18} />Vista pública</Link>
          {["draft", "pending_approval", "registration"].includes(t.status) && <Link href={`/staff/torneo/${t.id}/editar`} className="btn g sm"><Icon name="edit" size={18} />Editar</Link>}
        </div>
      </div>

      {t.status === "draft" && (
        <div className="box n6 col" style={{ gap: 10, maxWidth: 560 }}>
          <b className="t2">Borrador</b>
          <span className="sm">Nadie lo ve todavía. Al publicarlo se abre la inscripción{["clasificatorio", "mayor"].includes(t.category) ? " (o se pide aprobación al superadmin)" : ""}.</span>
          <ActionButton action={() => publishTournament(t.id)} ok="Publicado.">Publicar torneo</ActionButton>
        </div>
      )}
      {t.status === "pending_approval" && <div className="banner warn n4"><Icon name="clock" size={18} />Esperando la aprobación del superadmin.</div>}

      {t.status === "registration" && (
        <div className="grid2">
          <div className="col" style={{ gap: 14 }}>
            <div className="grid3">
              <Stat value={registered} label={`Inscritos de ${t.capacity}`} />
              <Stat value={checked} label="Con check-in" tone="ok" />
              <Stat value={regs.filter((r) => r.status === "waitlist").length} label="En espera" />
            </div>
            <div className="box n4 col" style={{ gap: 10 }}>
              <b>Empezar el torneo</b>
              <span className="sm">
                {t.pace.kind === "ventana" ? `Empieza solo el ${fmtDateTime(t.starts_at)}: todos los inscritos juegan. También puedes empezarlo ahora.`
                  : `Juegan quienes hicieron check-in (${checked}). Los demás quedan fuera. Inicio programado: ${fmtDateTime(t.starts_at)}.`}
              </span>
              <ActionButton action={() => startTournament(t.id)} ok="¡Empezó! Ronda 1 emparejada." confirm={`¿Empezar con ${t.pace.kind === "ventana" ? registered : checked} jugadores?`}
                disabled={(t.pace.kind === "ventana" ? registered : checked) < 2}>Empezar y emparejar ronda 1</ActionButton>
            </div>
            <Link href={`/staff/torneo/${t.id}/inscritos`} className="btn g">Ver inscritos, invitados y jueces</Link>
          </div>
          <div className="col" style={{ gap: 12 }}>
            <Announcement id={t.id} current={t.announcement} />
            <ActionButton className="btn d" action={() => cancelTournament(t.id)} confirm="¿Cancelar el torneo? Se avisa a todos los inscritos." ok="Torneo cancelado.">Cancelar torneo</ActionButton>
          </div>
        </div>
      )}

      {t.status === "running" && round && (
        <div className="grid2">
          <div className="col" style={{ gap: 12 }}>
            <div className="tables">
              {sorted.map((m) => {
                const st = m.status === "pending" && late && t.pace.kind !== "ventana" ? (["var(--err)", "Atrasada", "clock"] as const) : ST[m.status]!;
                return (
                  <div key={m.id} className="tcell n4" style={{ boxShadow: `inset 3px 0 0 ${st[0]}` }}>
                    <div className="row between"><b className="mono">Mesa {m.table_no}</b><span className="st" style={{ color: st[0] }}><Icon name={st[2]} size={14} weight={2.5} />{st[1]}</span></div>
                    <span>{regName(byId.get(m.a))}</span>
                    <span className="muted">{m.b ? `vs ${regName(byId.get(m.b))}` : "Bye"}</span>
                    {m.status === "confirmed" && m.b && <span className="mono xs ok">{m.double_loss ? "Derrota doble" : `${m.games_a}-${m.games_b}`}</span>}
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      {m.b && <Link className="link xs" style={{ padding: 0 }} href={`/mesa/${m.id}`}>Ver mesa</Link>}
                      {m.b && <Link className="link xs" style={{ padding: 0 }} href={`/staff/torneo/${t.id}/mesa/${m.id}`}>Poner resultado</Link>}
                    </div>
                    {t.pace.kind === "ventana" && m.status !== "confirmed" && m.b && (
                      <div className="row" style={{ gap: 6 }}>
                        <ActionButton className="btn s sm" action={() => staffMatch(m.id, "recordar")} ok="Recordatorio enviado.">Recordar</ActionButton>
                        <ActionButton className="btn s sm" action={() => staffMatch(m.id, "extender", 12)} ok="Plazo extendido 12 h." disabled={m.extension_hours >= 24}>+12 h</ActionButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col" style={{ gap: 12, position: "sticky", top: 22 }}>
            {round.ends_at && (
              <div className="box n4 row between">
                <div className="col" style={{ gap: 0 }}>
                  <span className="lbl" style={{ fontSize: 16 }}>{t.pace.kind === "ventana" ? "Cierra" : round.status === "paused" ? "En pausa" : "Tiempo"}</span>
                  {t.pace.kind === "ventana" ? <span className="px20 warn" style={{ fontSize: 30 }}>{fmtDateTime(round.ends_at)}</span>
                    : <Countdown to={round.ends_at} paused={round.status === "paused" ? round.paused_remaining : null} className="px20 warn" style={{ fontSize: 44, lineHeight: 1 }} />}
                </div>
                {t.pace.kind !== "ventana" && (
                  <div className="col" style={{ gap: 6 }}>
                    {round.status === "paused"
                      ? <ActionButton className="btn g sm" action={() => roundClock(round.id, "reanudar")}>Reanudar</ActionButton>
                      : <ActionButton className="btn g sm" action={() => roundClock(round.id, "pausar")}>Pausar</ActionButton>}
                    <ActionButton className="btn g sm" action={() => roundClock(round.id, "agregar", 5)} ok="+5 minutos.">+5 min</ActionButton>
                  </div>
                )}
              </div>
            )}
            <div className="row" style={{ gap: 10 }}>
              <Stat value={current.length - pending} label="Confirmadas" tone="ok" />
              <Stat value={current.filter((m) => m.status === "disputed").length} label="En disputa" tone="err" />
            </div>
            <div className="box n4 col" style={{ gap: 8 }}>
              <b>{t.pace.kind === "ventana" ? "Cerrar ronda" : "Siguiente ronda"}</b>
              <span className="sm">{pending ? `Faltan ${pending} mesas. Se activa cuando todas estén confirmadas.` : "Todas las mesas confirmaron."}{t.pace.kind === "ventana" ? " Al vencer el plazo, Reta aplica las reglas y avanza sola." : ""}</span>
              <ActionButton action={() => nextRound(t.id)} disabled={pending > 0} ok="Listo.">
                {round.stage === "swiss" && round.number >= t.swiss_rounds ? (t.format === "swiss_topcut" ? "Empezar top cut" : "Terminar torneo") : current.filter((m) => m.b).length === 1 && round.stage === "top" ? "Terminar torneo" : `Emparejar ronda ${round.number + 1}`}
              </ActionButton>
            </div>
            <Announcement id={t.id} current={t.announcement} />
          </div>
        </div>
      )}

      {t.status === "finished" && (
        <div className="col" style={{ gap: 10, maxWidth: 560 }}>
          <div className="banner n4" style={{ background: "var(--surface)" }}><Icon name="trophy" />El torneo terminó. PR, medallas y títulos ya se aplicaron.</div>
          <Link href={`/torneo/${t.code}?pestana=tabla`} className="btn p">Ver la tabla final</Link>
        </div>
      )}
      {t.status === "cancelled" && <div className="banner err n4">Torneo cancelado.</div>}
    </>
  );
}
