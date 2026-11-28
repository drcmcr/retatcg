"use client";
import { useState } from "react";
import { setPlatformRole } from "@/actions/staff";
import { useAction } from "@/components/client";
import { PlayerPicker } from "@/components/PlayerPicker";

export function RoleForm() {
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="col" style={{ gap: 6 }}>
      <PlayerPicker value={name} onChange={setName} label="Usuario de Reta" />
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn p sm" disabled={pending || name.length < 3} onClick={() => run(() => setPlatformRole(name.trim(), "organizer", true), { ok: "Rol de organizador dado.", then: () => setName("") })}>Dar rol de organizador</button>
        <button className="btn g sm" disabled={pending || name.length < 3} onClick={() => run(() => setPlatformRole(name.trim(), "organizer", false), { ok: "Rol quitado." })}>Quitar</button>
      </div>
    </div>
  );
}
