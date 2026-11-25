"use client";
import { useState } from "react";
import { blockUser, follow, reportUser, unfollow } from "@/actions/profile";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";

export function PlayerActions({ userId, username, following }: { userId: string; username: string; following: boolean }) {
  const { run, pending } = useAction();
  const [more, setMore] = useState(false);
  return (
    <>
      <div className="row stick-bottom" style={{ gap: 8 }}>
        {following
          ? <button className="btn g" disabled={pending} onClick={() => run(() => unfollow(userId), { ok: `Dejaste de seguir a ${username}.` })}>Siguiendo</button>
          : <button className="btn p" disabled={pending} onClick={() => run(() => follow(userId), { ok: `Ahora sigues a ${username}.` })}>Seguir</button>}
        <button className="ib" aria-label="Más opciones" onClick={() => setMore(true)}><Icon name="list" /></button>
      </div>
      {more && (
        <div className="sheet-back" onClick={(e) => { if (e.target === e.currentTarget) setMore(false); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Opciones para ${username}`}>
            <div className="grab" />
            <b className="t2">{username}</b>
            {[["usuario_ofensivo", "Usuario ofensivo"], ["suplantacion", "Se hace pasar por otra persona"], ["trampa", "Hace trampa"]].map(([k, l]) => (
              <button key={k} className="li n4" disabled={pending} onClick={() => run(() => reportUser(userId, k!), { ok: "Reporte enviado. Gracias.", then: () => setMore(false) })}><Icon name="flag" size={20} /><span className="grow">Reportar: {l}</span></button>
            ))}
            <button className="li n4" disabled={pending} onClick={() => run(() => blockUser(userId), { ok: `Bloqueaste a ${username}.`, then: () => setMore(false) })}><Icon name="ban" size={20} /><span className="grow">Bloquear</span></button>
            <span className="xs">Bloquear evita que te siga, pero en un torneo el suizo puede emparejarlos igual.</span>
            <button className="btn s" onClick={() => setMore(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
