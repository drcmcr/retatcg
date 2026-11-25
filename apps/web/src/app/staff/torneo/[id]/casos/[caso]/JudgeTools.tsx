"use client";
import { useState } from "react";
import { addSanction, judgeMessage, resolveCase } from "@/actions/staff";
import { useAction } from "@/components/client";

const TEMPLATES = [
  "Revisé el caso. ¿Pueden enviar la captura de la pantalla de resultado?",
  "Gracias. Estoy revisando el registro de la mesa.",
  "Repitan el encuentro con la contraseña nueva.",
  "Decisión tomada con el registro de la mesa y las capturas.",
];
const SANCTIONS: [string, string, number, number][] = [
  ["advertencia", "Advertencia", 0, 0], ["perdida_encuentro", "Pérdida del encuentro · −20 PR", -20, 0], ["suspension", "Suspensión 14 días · −40 PR", -40, 14],
];

export function JudgeTools({ caseId, tournamentId, resolved, players }: { caseId: number; tournamentId: string; resolved: boolean; players: { id: string; name: string }[] }) {
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState("");
  const [who, setWho] = useState(players[0]?.id ?? "");
  const [kind, setKind] = useState(0);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  if (resolved) return <div className="box n4 sm">Caso resuelto.</div>;
  return (
    <>
      <div className="box n4 col" style={{ gap: 8 }}>
        <b>Mensaje a los jugadores</b>
        <div className="chips">{TEMPLATES.map((tpl) => <button key={tpl} className="chip o" style={{ whiteSpace: "normal", textAlign: "left", minHeight: 36, padding: "6px 10px" }} onClick={() => setMsg(tpl)}>{tpl}</button>)}</div>
        <textarea className="inp" maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Mensaje del juez" />
        <button className="btn s sm" disabled={pending || !msg.trim()} onClick={() => run(() => judgeMessage(caseId, msg), { ok: "Mensaje enviado.", then: () => setMsg("") })}>Enviar</button>
      </div>
      {players.length > 0 && (
        <div className="box n4 col" style={{ gap: 8 }}>
          <b>Sanción (opcional)</b>
          <div className="row"><select className="inp" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Jugador">{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select className="inp" value={kind} onChange={(e) => setKind(Number(e.target.value))} aria-label="Tipo de sanción">{SANCTIONS.map((s, i) => <option key={s[0]} value={i}>{s[1]}</option>)}</select></div>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo de la sanción" />
          <button className="btn d sm" disabled={pending || !reason.trim()} onClick={() => { const s = SANCTIONS[kind]!; run(() => addSanction(who, tournamentId, s[0], reason, s[2], s[3]), { ok: "Sanción aplicada.", then: () => setReason("") }); }}>Aplicar sanción</button>
        </div>
      )}
      <div className="box n4 col" style={{ gap: 8 }}>
        <b>Cerrar el caso</b>
        <input className="inp" value={res} maxLength={300} onChange={(e) => setRes(e.target.value)} placeholder="Ej. Gana sofi.p 2-1 con la captura del juego 3" aria-label="Resolución" />
        <button className="btn p" disabled={pending || !res.trim()} onClick={() => run(() => resolveCase(caseId, res), { ok: "Caso resuelto." })}>Resolver caso</button>
      </div>
    </>
  );
}
