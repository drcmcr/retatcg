"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  acceptTime, callJudge, confirmResult, disputeResult, proposeTime, quickMessage, regenPassword, reportDisconnect, reportResult,
  setAvailability, tableCheckin,
} from "@/actions/match";
import { Countdown, CopyButton, useAction } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Status } from "@/components/ui";
import { fmtDateTime, fmtTime, relTime } from "@/lib/format";

type Props = {
  match: {
    id: string; status: string; side: "a" | "b"; table: number; gamesA: number; gamesB: number; draws: number; reportedBy: string | null; myReg: string | null;
    scheduledAt: string | null; proposedAt: string | null; proposedBy: string | null; aCheckin: string | null; bCheckin: string | null;
  };
  round: { number: number; bestOf: number; stage: string; endsAt: string | null; extension: number };
  pace: string;
  rival: { name: string; pocket: string | null; friendId: string | null; userId: string | null };
  password: string | null;
  events: { id: number; at: string; mine: boolean; kind: string; text: string | null }[];
  availability: { mine: string[]; theirs: string[] };
  openCase: number | null;
  readOnly: boolean;
  confirmMinutes: number;
};

const QUICK = [
  ["buscando", "Ya estoy buscando partida"],
  ["no_conecta", "No conecta: regenero la contraseña"],
  ["dame_2", "Dame 2 minutos"],
  ["se_cayo", "Se cayó mi conexión, vuelvo a buscar"],
  ["listo", "Listo para el siguiente juego"],
  ["gg", "Buena partida"],
] as const;

type Sheet = null | "msg" | "drop" | "judge";

export function MesaClient(p: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reporting, setReporting] = useState(false);
  const { run, pending } = useAction();
  const m = p.match;
  const myCheckin = m.side === "a" ? m.aCheckin : m.bCheckin;
  const rivalCheckin = m.side === "a" ? m.bCheckin : m.aCheckin;
  const iReported = m.reportedBy !== null && m.reportedBy === m.myReg;
  const rivalReported = m.reportedBy !== null && m.reportedBy !== m.myReg;
  const mine = m.side === "a" ? m.gamesA : m.gamesB;
  const theirs = m.side === "a" ? m.gamesB : m.gamesA;
  const coordinating = p.pace === "ventana" && ["pending", "scheduled"].includes(m.status) && !myCheckin;
  const fid = p.rival.friendId?.replace(/(\d{4})(?=\d)/g, "$1 ");

  return (
    <>
      <div className="box n4 col" style={{ gap: 8 }}>
        <div className="row between sm">
          <span>Nombre en Pocket</span>
          <span className="row" style={{ gap: 6, color: "var(--ink)" }}><b>{p.rival.pocket ?? "—"}</b>{p.rival.pocket && <CopyButton text={p.rival.pocket} label="Copiar" className="btn s sm" />}</span>
        </div>
        <div className="row between sm">
          <span>ID de amigo</span>
          <span className="row" style={{ gap: 6, color: "var(--ink)" }}><b className="mono nw" style={{ fontSize: 14 }}>{fid ?? "—"}</b>{p.rival.friendId && <CopyButton text={p.rival.friendId} label="Copiar" className="btn s sm" />}</span>
        </div>
      </div>

      {coordinating ? (
        <Coordinate {...p} />
      ) : (
        <>
          {p.password && (
            <div className="chk n6" style={{ padding: 12 }}>
              <div className="panel n4 col" style={{ gap: 6 }}>
                <span className="lbl" style={{ fontSize: 16 }}>Contraseña de partida</span>
                <div className="row between">
                  <span className="mono lime" style={{ fontSize: 30, fontWeight: 700, letterSpacing: ".04em" }}>{p.password}</span>
                  <CopyButton text={p.password} label="Copiar" className="btn p sm" />
                </div>
                <span className="xs">En Pocket: Batalla, Partida privada. Escribe la contraseña tal cual, en mayúsculas.</span>
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <div className={`box n4 grow row sm ${myCheckin ? "ok" : ""}`} style={{ padding: 10, fontWeight: 700 }}>
              <Icon name={myCheckin ? "check" : "clock"} size={16} weight={2.5} />{myCheckin ? "Tú en mesa" : "Tú: pendiente"}
            </div>
            <div className={`box n4 grow row sm ${rivalCheckin ? "ok" : ""}`} style={{ padding: 10, fontWeight: 700 }}>
              <Icon name={rivalCheckin ? "check" : "clock"} size={16} weight={2.5} />{rivalCheckin ? `${p.rival.name} en mesa` : "Rival: pendiente"}
            </div>
          </div>
          {!p.readOnly && !myCheckin && ["pending", "scheduled", "playing"].includes(m.status) && (
            <button className="btn p" disabled={pending} onClick={() => run(() => tableCheckin(m.id), { ok: "Listo: tu rival ya sabe que estás en la mesa." })}>Estoy en la mesa</button>
          )}
        </>
      )}

      {!p.readOnly && !coordinating && m.status !== "disputed" && (
        <div className="grid3" style={{ gap: 8 }}>
          <button className="btn s sm" style={{ width: "100%" }} onClick={() => setSheet("msg")}><Icon name="msg" size={18} />Mensajes</button>
          <button className="btn s sm" style={{ width: "100%" }} onClick={() => setSheet("drop")}><Icon name="wifioff" size={18} />Se cayó</button>
          <button className="btn s sm" style={{ width: "100%" }} onClick={() => setSheet("judge")}><Icon name="judge" size={18} />Juez</button>
        </div>
      )}

      {m.status === "disputed" && (
        <Link href={p.openCase ? `/caso/${p.openCase}` : "#"} className="box n4 row edge-e" style={{ color: "inherit", textDecoration: "none" }}>
          <Icon name="flag" />
          <span className="grow col" style={{ gap: 0 }}><b className="err">Disputa abierta</b><span className="xs">El juez revisa el caso{p.openCase ? ` #${p.openCase}` : ""}. Toca para responder.</span></span>
          <Icon name="right" size={20} />
        </Link>
      )}

      {!p.readOnly && rivalReported && m.status === "reported" && (
        <div className="chk n6" style={{ padding: 12 }}>
          <div className="panel n4 col" style={{ alignItems: "center", textAlign: "center", gap: 8 }}>
            <span className="sm">{p.rival.name} reportó</span>
            <span className="mono" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>{mine}-{theirs}</span>
            <b>{mine > theirs ? "Ganaste" : mine < theirs ? `Ganó ${p.rival.name}` : "Empate"}</b>
            <span className="xs row" style={{ gap: 4 }}><Icon name="clock" size={14} />Se confirma solo en {p.confirmMinutes} min si no respondes.</span>
            <button className="btn p" disabled={pending} onClick={() => run(() => confirmResult(m.id), { ok: "Resultado confirmado." })}>Confirmar</button>
            <button className="btn d" disabled={pending} onClick={() => run(() => disputeResult(m.id), { ok: "Abrimos un caso. El juez lo revisa." })}>No es correcto</button>
          </div>
        </div>
      )}

      {!p.readOnly && iReported && m.status === "reported" && (
        <div className="box n4 col" style={{ gap: 4 }}>
          <Status tone="warn" icon="clock">Esperando que {p.rival.name} confirme {mine}-{theirs}</Status>
          <span className="xs">Si no responde en {p.confirmMinutes} min, se confirma solo.</span>
        </div>
      )}

      {!p.readOnly && ["pending", "scheduled", "playing"].includes(m.status) && !coordinating && (
        reporting ? (
          <Report bestOf={p.round.bestOf} stage={p.round.stage} onCancel={() => setReporting(false)} onSend={(a, b, d) =>
            run(() => reportResult(m.id, a, b, d), { ok: "Reporte enviado. Tu rival tiene que confirmarlo.", then: () => setReporting(false) })} pending={pending} />
        ) : (
          <button className="btn p" onClick={() => setReporting(true)}>Reportar resultado</button>
        )
      )}

      {p.events.length > 0 && (
        <details className="box n4">
          <summary className="lbl" style={{ cursor: "pointer" }}>Registro de la mesa</summary>
          <ul className="col" style={{ listStyle: "none", padding: 0, margin: "10px 0 0", gap: 6 }}>
            {p.events.map((e) => (
              <li key={e.id} className="row sm" style={{ alignItems: "flex-start" }}>
                <span className="mono" style={{ width: 44, flex: "none" }}>{fmtTime(e.at)}</span>
                <span style={{ color: "var(--ink)" }}>{e.mine ? "Tú" : e.kind.includes("autom") || e.kind.includes("plazo") ? "Reta" : p.rival.name}: {e.text ?? EVENT[e.kind] ?? e.kind}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sheet && (
        <div className="sheet-back" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="sheet fade-in" role="dialog" aria-modal="true" aria-label="Opciones de la mesa">
            <div className="grab" />
            {sheet === "msg" && (
              <>
                <b className="t2">Mensaje para {p.rival.name}</b>
                <div className="list">
                  {QUICK.map(([code, text]) => (
                    <button key={code} className="li n4" disabled={pending} onClick={() => run(() => quickMessage(m.id, code), { ok: "Mensaje enviado.", then: () => setSheet(null) })}>
                      <Icon name="msg" size={20} /><span className="grow">{text}</span>
                    </button>
                  ))}
                </div>
                <span className="xs">Puedes enviar otro en 10 segundos. No hay chat libre.</span>
              </>
            )}
            {sheet === "drop" && <DropSheet onDone={() => setSheet(null)} matchId={m.id} rival={p.rival.name} />}
            {sheet === "judge" && (
              <>
                <b className="t2">Llamar al juez</b>
                <div className="list">
                  {([["ausente", "Mi rival no se presenta", "clock"], ["conducta", "Problema de conducta", "flag"], ["juez", "Otra cosa", "judge"]] as const).map(([k, l, ic]) => (
                    <button key={k} className="li n4" disabled={pending} onClick={() => run(() => callJudge(m.id, k), { ok: "Avisamos al juez. Te responde en el caso.", then: (id) => { setSheet(null); if (id) window.location.assign(`/caso/${id}`); } })}>
                      <Icon name={ic} size={20} /><span className="grow">{l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="btn s" onClick={() => setSheet(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

const EVENT: Record<string, string> = {
  checkin: "está en la mesa", reporte: "reportó el resultado", "confirmó": "confirmó el resultado", disputa: "disputó el resultado",
  "contraseña": "generó una contraseña nueva", desconexion: "reportó una desconexión", juez: "llamó al juez", disponibilidad: "marcó su disponibilidad",
  propuesta: "propuso una hora", acordada: "aceptó la hora", "confirmación automática": "confirmó el resultado automáticamente", "plazo vencido": "aplicó el plazo vencido",
};

function Report({ bestOf, stage, onSend, onCancel, pending }: { bestOf: number; stage: string; onSend: (a: number, b: number, d: number) => void; onCancel: () => void; pending: boolean }) {
  const opts: [number, number, number, string][] = bestOf === 1
    ? [[1, 0, 0, "Gané"], [0, 1, 0, "Perdí"]]
    : [[2, 0, 0, "Gané"], [2, 1, 0, "Gané"], [1, 2, 0, "Perdí"], [0, 2, 0, "Perdí"]];
  const draws: [number, number, number, string][] = stage === "swiss" ? (bestOf === 1 ? [[0, 0, 1, "Empate"]] : [[1, 1, 0, "Empate por tiempo"], [1, 0, 1, "Gané 1-0 + empate"], [0, 1, 1, "Perdí 0-1 + empate"]]) : [];
  const [pick, setPick] = useState<number | null>(null);
  const [showDraws, setShowDraws] = useState(false);
  const all = [...opts, ...draws];
  return (
    <div className="box n4 col" style={{ gap: 10 }}>
      <b className="t2">¿Cómo quedó?</b>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        {opts.map((o, i) => (
          <button key={i} className="box card n4 col" aria-pressed={pick === i} onClick={() => setPick(i)}
            style={{ border: 0, cursor: "pointer", alignItems: "center", gap: 2, background: pick === i ? "var(--lime)" : undefined, color: pick === i ? "var(--bg)" : "var(--ink)" }}>
            <span className="mono" style={{ fontSize: 30, fontWeight: 700 }}>{o[0]}-{o[1]}</span>
            <span style={{ fontWeight: 700 }}>{o[3]}</span>
          </button>
        ))}
      </div>
      {draws.length > 0 && !showDraws && <button className="link" onClick={() => setShowDraws(true)}>Hubo un juego empatado</button>}
      {showDraws && draws.map((o, j) => {
        const i = opts.length + j;
        return <button key={i} className={`chip ${pick === i ? "on" : "o"}`} aria-pressed={pick === i} onClick={() => setPick(i)}>{o[3]}</button>;
      })}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn s" onClick={onCancel}>Cancelar</button>
        <button className="btn p" disabled={pick === null || pending} onClick={() => { const o = all[pick!]!; onSend(o[0], o[1], o[2]); }}>
          {pick === null ? "Elige el marcador" : `Enviar ${all[pick]![0]}-${all[pick]![1]}`}
        </button>
      </div>
    </div>
  );
}

function DropSheet({ matchId, rival, onDone }: { matchId: string; rival: string; onDone: () => void }) {
  const [who, setWho] = useState<"yo" | "rival">("yo");
  const [returned, setReturned] = useState(true);
  const { run, pending } = useAction();
  return (
    <>
      <b className="t2">¿Quién se desconectó?</b>
      <div className="seg">
        <button aria-selected={who === "yo"} onClick={() => setWho("yo")}>Yo</button>
        <button aria-selected={who === "rival"} onClick={() => setWho("rival")}>{rival}</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={returned} onChange={(e) => setReturned(e.target.checked)} />
        <span className="cb">{returned && <Icon name="check" size={16} weight={3} />}</span>
        <span>Ya volvió a buscar partida (dentro de 5 minutos)</span>
      </label>
      <ul className="xs col" style={{ margin: 0, paddingLeft: 18, gap: 4 }}>
        <li>La primera vez, la partida se repite con contraseña nueva.</li>
        <li>Si se cae otra vez o no vuelve en 5 minutos, la partida es para quien se quedó y el juez revisa.</li>
      </ul>
      <button className="btn p" disabled={pending} onClick={() => run(() => reportDisconnect(matchId, who, returned), {
        then: (r) => { onDone(); if (r === "juez") window.location.reload(); },
        ok: returned ? "Contraseña nueva: repitan la partida." : "Avisamos al juez.",
      })}>Avisar a mi rival</button>
    </>
  );
}

/** Ritmo por ventana: disponibilidad en bloques de una hora y propuesta de horario. */
function Coordinate(p: Props) {
  const m = p.match;
  const { run, pending } = useAction();
  const deadline = p.round.endsAt ? new Date(p.round.endsAt).getTime() + p.round.extension * 3_600_000 : Date.now() + 24 * 3_600_000;
  const slots = useMemo(() => {
    const out: Date[] = [];
    const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
    for (let t = start.getTime(); t + 3_600_000 <= deadline && out.length < 48; t += 3_600_000) out.push(new Date(t));
    return out;
  }, [deadline]);
  const [mine, setMine] = useState<Set<string>>(() => new Set(p.availability.mine.map((s) => new Date(s).toISOString())));
  const theirs = new Set(p.availability.theirs.map((s) => new Date(s).toISOString()));
  const common = slots.find((s) => mine.has(s.toISOString()) && theirs.has(s.toISOString()));
  const byDay = new Map<string, Date[]>();
  for (const s of slots) {
    const k = s.toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const proposalMine = m.proposedAt && m.proposedBy === m.myReg;
  const proposalTheirs = m.proposedAt && m.proposedBy !== m.myReg;
  return (
    <div className="col" style={{ gap: 12 }}>
      {m.scheduledAt ? (
        <div className="box n4 row edge-c"><Icon name="cal" /><span className="grow"><b>Agendada {fmtDateTime(m.scheduledAt)}</b><br /><span className="xs">Llega a tiempo: hay 10 min de tolerancia.</span></span></div>
      ) : proposalTheirs ? (
        <div className="box n4 col edge-l" style={{ gap: 8 }}>
          <b>{p.rival.name} propone {fmtDateTime(m.proposedAt!)}</b>
          {!p.readOnly && <button className="btn p" disabled={pending} onClick={() => run(() => acceptTime(m.id), { ok: "¡Agendada!" })}>Aceptar</button>}
        </div>
      ) : proposalMine ? (
        <div className="box n4"><Status tone="warn" icon="clock">Propusiste {fmtDateTime(m.proposedAt!)}. Esperando respuesta.</Status></div>
      ) : common ? (
        <div className="box n4 row edge-l" style={{ justifyContent: "space-between" }}>
          <span><b>{fmtDateTime(common)}</b><br /><span className="xs">Primer bloque en común</span></span>
          {!p.readOnly && <button className="btn p sm" disabled={pending} onClick={() => run(() => proposeTime(m.id, common.toISOString()), { ok: "Propuesta enviada." })}>Proponer</button>}
        </div>
      ) : null}
      <div className="row between">
        <span className="lbl">Tu disponibilidad</span>
        <span className="xs row" style={{ gap: 10 }}><span className="row" style={{ gap: 4 }}><i style={{ width: 12, height: 12, background: "var(--lime)", display: "inline-block" }} />Tú</span><span className="row" style={{ gap: 4 }}><i style={{ width: 12, height: 12, boxShadow: "inset 0 0 0 2px var(--cyan)", display: "inline-block" }} />{p.rival.name}</span></span>
      </div>
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="col" style={{ gap: 6 }}>
          <span className="xs">{new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short" }).format(list[0]!)}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
            {list.map((s) => {
              const k = s.toISOString();
              const on = mine.has(k);
              return (
                <button key={k} type="button" aria-pressed={on} disabled={p.readOnly}
                  onClick={() => setMine((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                  style={{ minHeight: 40, border: 0, cursor: "pointer", fontWeight: 700, background: on ? "var(--lime)" : "var(--surface)", color: on ? "var(--bg)" : "var(--ink)", boxShadow: theirs.has(k) ? "inset 0 0 0 2px var(--cyan)" : undefined }}>
                  {fmtTime(s)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!p.readOnly && (
        <>
          <button className="btn s" disabled={pending} onClick={() => run(() => setAvailability(m.id, [...mine]), { ok: "Disponibilidad guardada." })}>Guardar disponibilidad</button>
          <button className="btn g" disabled={pending} onClick={() => run(() => tableCheckin(m.id), { ok: "Avisamos a tu rival que estás listo." })}>
            <Icon name="zap" size={18} />Jugar ahora{p.rival.name ? ` · avisar a ${p.rival.name}` : ""}
          </button>
          <span className="xs">Marcar disponibilidad o proponer cuenta como estar activo si el rival no responde antes del cierre ({relTime(new Date(deadline).toISOString()) === "ahora" ? "ya" : fmtDateTime(new Date(deadline))}).</span>
          <Countdown to={new Date(deadline).toISOString()} className="sr-only" />
        </>
      )}
    </div>
  );
}
