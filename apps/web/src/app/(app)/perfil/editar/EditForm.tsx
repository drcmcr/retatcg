"use client";
import { useState } from "react";
import { updatePrivateData, updateUsername } from "@/actions/profile";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { fmtDate } from "@/lib/format";

export function EditForm({ seed, username, nextChange, pocketName, friendId, timezone }: { seed: string; username: string; nextChange: string | null; pocketName: string; friendId: string; timezone: string }) {
  const [u, setU] = useState(username);
  const [pn, setPn] = useState(pocketName);
  const [fid, setFid] = useState(friendId);
  const { run, pending } = useAction();
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="fld">
        <label htmlFor="u">Usuario</label>
        <input id="u" className="inp" value={u} maxLength={16} disabled={!!nextChange} onChange={(e) => setU(e.target.value.trim())} autoCapitalize="none" />
        <span className="hint"><Icon name="info" size={15} />{nextChange ? `Puedes cambiarlo de nuevo el ${fmtDate(nextChange)}` : "Un cambio cada 30 días."}</span>
        {u !== username && !nextChange && <button className="btn s sm" disabled={pending} onClick={() => run(() => updateUsername(u), { ok: "Usuario actualizado." })}>Guardar usuario</button>}
      </div>
      <div className="fld">
        <span className="flabel">Tu ícono</span>
        <div className="row" style={{ gap: 12 }}><Identicon seed={seed} size={56} /><span className="hint" style={{ margin: 0 }}>Se genera de tu cuenta. No cambia aunque cambies de usuario.</span></div>
      </div>
      <div className="sep" />
      <span className="lbl">Datos de Pocket · privados</span>
      <div className="fld"><label htmlFor="pn">Nombre en Pocket</label><input id="pn" className="inp" value={pn} maxLength={20} onChange={(e) => setPn(e.target.value)} /></div>
      <div className="fld"><label htmlFor="fid">ID de amigo</label><input id="fid" className="inp mono" inputMode="numeric" value={fid.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")} onChange={(e) => setFid(e.target.value)} /></div>
      <button className="btn p" disabled={pending} onClick={() => run(() => updatePrivateData(pn, fid, timezone), { ok: "Datos guardados." })}>Guardar</button>
      <p className="xs">Sin biografía de texto libre: te expresas con tu título y tu tarjeta.</p>
    </div>
  );
}
