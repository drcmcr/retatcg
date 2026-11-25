"use client";
import { useState } from "react";
import { addGuest, addStaff } from "@/actions/staff";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";

export function AddGuest({ id }: { id: string }) {
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="box n4 col" style={{ gap: 8 }}>
      <b>Agregar invitado</b>
      <span className="sm">Para quien juega sin cuenta (no suma PR). Entra con check-in hecho.</span>
      <div className="row"><input className="inp" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Nombre" aria-label="Nombre del invitado" />
        <button className="btn p sm" disabled={pending || name.trim().length < 2} onClick={() => run(() => addGuest(id, name), { ok: "Invitado agregado.", then: () => setName("") })}><Icon name="plus" size={18} />Agregar</button></div>
    </div>
  );
}

export function AddJudge({ id }: { id: string }) {
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="row">
      <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Usuario de Reta" aria-label="Usuario del juez" />
      <button className="btn g sm" disabled={pending || name.trim().length < 3} onClick={() => run(() => addStaff(id, name.trim(), "judge"), { ok: "Juez agregado.", then: () => setName("") })}>Invitar juez</button>
    </div>
  );
}
