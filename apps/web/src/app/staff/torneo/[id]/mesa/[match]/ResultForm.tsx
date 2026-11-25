"use client";
import { useState } from "react";
import { setResult, staffMatch } from "@/actions/staff";
import { ActionButton, useAction } from "@/components/client";
import { Icon } from "@/components/Icon";

export function ResultForm({ matchId, a, b, bestOf, stage, current }: { matchId: string; a: string; b: string; bestOf: number; stage: string; current: { a: number; b: number; d: number; dl: boolean; status: string } }) {
  const [ga, setGa] = useState(current.a);
  const [gb, setGb] = useState(current.b);
  const [gd, setGd] = useState(current.d);
  const [dl, setDl] = useState(current.dl);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const max = Math.ceil(bestOf / 2);
  const num = (v: number, set: (n: number) => void, label: string, top = max) => (
    <div className="fld" style={{ width: 110 }}><label>{label}</label>
      <input className="inp mono" type="number" min={0} max={top} value={v} onChange={(e) => set(Math.max(0, Math.min(top, Number(e.target.value))))} disabled={dl} />
    </div>
  );
  return (
    <div className="box n4 col" style={{ gap: 12 }}>
      <b className="t2">Poner resultado</b>
      <span className="sm">Bo{bestOf}{stage === "top" ? " · eliminación: debe haber ganador" : ""}. Estado actual: {current.status}.</span>
      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        {num(ga, setGa, a)}{num(gb, setGb, b)}{stage === "swiss" && num(gd, setGd, "Empates", 3)}
      </div>
      {stage === "swiss" && (
        <label className="check"><input type="checkbox" checked={dl} onChange={(e) => setDl(e.target.checked)} /><span className="cb">{dl && <Icon name="check" size={16} weight={3} />}</span><span>Derrota para los dos</span></label>
      )}
      <div className="fld"><label htmlFor="mot">Motivo (queda en la auditoría)</label><input id="mot" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. captura del juego 3" /></div>
      <button className="btn p" disabled={pending || !reason.trim()} onClick={() => run(() => setResult(matchId, ga, gb, gd, dl, reason), { ok: "Resultado guardado." })}>Guardar resultado</button>
      <ActionButton className="btn g" action={() => staffMatch(matchId, "repetir")} confirm="¿Repetir el encuentro? Se borra el reporte y se genera otra contraseña." ok="El encuentro se repite.">Repetir encuentro</ActionButton>
    </div>
  );
}
