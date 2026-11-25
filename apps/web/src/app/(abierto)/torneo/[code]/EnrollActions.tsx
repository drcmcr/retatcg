"use client";
import Link from "next/link";
import { useState } from "react";
import { dropTournament, register, unregister } from "@/actions/player";
import { ActionButton, useAction } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Status } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

type Props = {
  t: { id: string; code: string; name: string; status: string; starts_at: string; checkin_minutes: number; pace: string; policy: string; rules: string[]; format: string; category: string };
  me: { id: string } | null;
  reg: { status: string } | null;
  matchId?: string;
};

export function EnrollActions({ t, me, reg, matchId }: Props) {
  const [sheet, setSheet] = useState(false);
  const [accept, setAccept] = useState(false);
  const { run, pending } = useAction();
  const checkinOpen = Date.now() >= new Date(t.starts_at).getTime() - t.checkin_minutes * 60_000;
  const active = reg && ["registered", "checked_in", "waitlist"].includes(reg.status);

  if (!me) {
    if (t.status !== "registration") return null;
    return (
      <div className="box card n4 col edge-l">
        <b>¿Quieres jugar?</b>
        <span className="sm">Crea tu cuenta con tu correo en un minuto.</span>
        <Link href={`/entrar?siguiente=/torneo/${t.code}`} className="btn p">Entrar para inscribirme</Link>
      </div>
    );
  }

  if (t.status === "finished") return reg ? <Link href={`/resultado/${t.id}`} className="btn p">Ver mi resultado</Link> : null;
  if (t.status === "cancelled") return null;

  if (t.status === "running") {
    if (!reg || !["checked_in"].includes(reg.status)) return null;
    return (
      <>
        {matchId && <Link href={`/mesa/${matchId}`} className="btn p"><Icon name="play" size={20} />Ir a mi mesa</Link>}
        {t.policy === "por_ronda" && <Link href={`/torneo/${t.code}/mazo`} className="btn s">Declarar mazo para la siguiente ronda</Link>}
        <ActionButton className="btn d sm" action={() => dropTournament(t.id)} confirm="¿Retirarte del torneo? Ya no te emparejarán y no puedes volver." ok="Te retiraste del torneo.">Retirarme del torneo</ActionButton>
      </>
    );
  }

  if (t.status !== "registration") return null;

  if (active) {
    return (
      <>
        <div className="row between box n4">
          {reg!.status === "checked_in" ? <Status tone="ok" icon="check">Check-in listo</Status>
            : reg!.status === "waitlist" ? <Status tone="warn" icon="clock">En lista de espera</Status>
            : <Status tone="ok" icon="check">Estás inscrito</Status>}
          <ActionButton className="link" action={() => unregister(t.id)} confirm="¿Cancelar tu inscripción?" ok="Cancelaste tu inscripción.">Cancelar</ActionButton>
        </div>
        {t.policy !== "libre" && <Link href={`/torneo/${t.code}/mazo`} className="btn s">Declarar mazo</Link>}
        {reg!.status === "registered" && t.pace !== "ventana" && checkinOpen && <Link href={`/torneo/${t.code}/checkin`} className="btn p">Hacer check-in</Link>}
        {reg!.status === "registered" && t.pace !== "ventana" && !checkinOpen && (
          <span className="xs" style={{ textAlign: "center" }}>El check-in abre {t.checkin_minutes} min antes: {fmtDateTime(new Date(new Date(t.starts_at).getTime() - t.checkin_minutes * 60_000))}</span>
        )}
      </>
    );
  }

  return (
    <>
      <button className="btn p" onClick={() => setSheet(true)}>Inscribirme</button>
      {sheet && (
        <div className="sheet-back" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div className="sheet fade-in" role="dialog" aria-modal="true" aria-labelledby="ins-title">
            <div className="grab" />
            <b id="ins-title" className="t2">Confirma tu inscripción</b>
            <div className="col" style={{ gap: 4 }}>
              {[["Torneo", t.name], ["Fecha", fmtDateTime(t.starts_at)], ["Formato", t.format], ["Da PR", t.category]].map(([k, v]) => (
                <div key={k} className="row between sm"><span>{k}</span><b style={{ color: "var(--ink)", textAlign: "right" }}>{v}</b></div>
              ))}
            </div>
            <div className="box card n4 col" style={{ gap: 6 }}>
              <span className="lbl" style={{ fontSize: 16 }}>Reglas de mazo</span>
              <span className="sm">
                {t.policy === "libre" ? "Mazo libre: puedes cambiarlo en cada encuentro." : t.policy === "por_ronda" ? "Mazo por ronda: lo declaras antes de cada emparejamiento." : "Mazo fijo: lo declaras al inscribirte y no cambia."}
                {t.rules.length ? ` ${t.rules.join(". ")}.` : ""}
              </span>
            </div>
            <label className="check">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span className="cb">{accept && <Icon name="check" size={16} weight={3} />}</span>
              <span>Acepto las reglas del torneo y de mazo.</span>
            </label>
            <button className="btn p" disabled={!accept || pending} onClick={() => run(() => register(t.id), {
              then: (st) => { setSheet(false); if (t.policy === "fijo") window.location.assign(`/torneo/${t.code}/mazo`); void st; },
              ok: "¡Listo! Estás inscrito.",
            })}>{pending ? "Inscribiendo…" : "Confirmar inscripción"}</button>
            <button className="btn s" onClick={() => setSheet(false)}>Ahora no</button>
          </div>
        </div>
      )}
    </>
  );
}
