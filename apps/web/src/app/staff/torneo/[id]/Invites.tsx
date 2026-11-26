"use client";
import { useState } from "react";
import { cancelInvite, createInvites } from "@/actions/staff";
import { ActionButton, CopyButton, useAction, useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

export type Invite = { id: string; token: string; label: string; status: string; used_by_name: string | null };

const STATE: Record<string, [string, string]> = {
  open: ["Sin usar", "cyan"], used: ["Ocupada", "ok"], cancelled: ["Cancelada", "sm"], expired: ["Venció", "sm"],
};

/** Enlaces personales: cada uno aparta un lugar seguro y se usa una sola vez. */
export function Invites({ tournamentId, origin, name, when, capacity, seated, invites, locked }: {
  tournamentId: string; origin: string; name: string; when: string; capacity: number; seated: number; invites: Invite[]; locked: boolean;
}) {
  const [text, setText] = useState("");
  const { run, pending } = useAction();
  const toast = useToast();
  const open = invites.filter((i) => i.status === "open").length;
  const free = Math.max(0, capacity - seated - open);
  const labels = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const link = (i: Invite) => `${origin}/i/${i.token}`;
  const msg = (i: Invite) => `Hola ${i.label}, te aparté un lugar en ${name} (${when}) en Reta. Este enlace es solo para ti y sirve una vez: ${link(i)}`;
  async function share(i: Invite) {
    try {
      if (navigator.share) await navigator.share({ title: "Tu lugar en Reta", text: msg(i) });
      else { await navigator.clipboard.writeText(msg(i)); toast({ tone: "ok", text: "Mensaje copiado." }); }
    } catch { /* cerró la hoja de compartir */ }
  }
  const active = invites.filter((i) => i.status === "open" || i.status === "used");
  const old = invites.filter((i) => i.status === "cancelled" || i.status === "expired");

  return (
    <div className="box n4 col" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 8 }}>
        <b className="t2">Invitaciones personales</b>
        <span className="sm"><b style={{ color: "var(--ink)" }}>{seated}</b> con lugar · <b style={{ color: "var(--ink)" }}>{open}</b> apartados · <b style={{ color: "var(--ink)" }}>{free}</b> libres de {capacity}</span>
      </div>
      <span className="xs">Cada enlace aparta un lugar y sirve una sola vez. El enlace general, el QR y el código solo dan lista de espera. Los enlaces sin usar vencen al abrir el check-in y esos lugares pasan a la espera.</span>

      {!locked && (
        <div className="col" style={{ gap: 6 }}>
          <label htmlFor="inv-names" className="sm">Para quién (un nombre por línea)</label>
          <textarea id="inv-names" className="inp" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Dave\nAna\nLuis"} />
          <button className="btn p sm" disabled={pending || !labels.length || labels.length > free}
            onClick={() => run(() => createInvites(tournamentId, labels), { ok: labels.length === 1 ? "Invitación creada." : `${labels.length} invitaciones creadas.`, then: () => setText("") })}>
            {labels.length > free ? `Solo quedan ${free} lugares` : `Crear ${labels.length || ""} ${labels.length === 1 ? "invitación" : "invitaciones"}`}
          </button>
        </div>
      )}

      {active.length > 0 && (
        <ul className="col" style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
          {active.map((i) => (
            <li key={i.id} className="box card n4 col" style={{ gap: 8 }}>
              <span className="row between wrap" style={{ gap: 6 }}>
                <b style={{ overflowWrap: "anywhere" }}>{i.label}</b>
                <span className={`xs ${STATE[i.status]![1]}`}>{i.status === "used" ? `Ocupada por @${i.used_by_name ?? "—"}` : STATE[i.status]![0]}</span>
              </span>
              {!locked && (
                <div className="row wrap" style={{ gap: 6 }}>
                  {i.status === "open" && <button type="button" className="btn p sm" onClick={() => share(i)}><Icon name="share" size={18} />Compartir</button>}
                  {i.status === "open" && <CopyButton text={link(i)} label="Copiar enlace" />}
                  <ActionButton className="btn g sm" action={cancelInvite} args={[i.id]}
                    confirm={i.status === "used" ? `¿Cancelar la invitación de ${i.label}? @${i.used_by_name} pasará a la lista de espera.` : `¿Cancelar la invitación de ${i.label}? El enlace dejará de funcionar.`}
                    ok="Invitación cancelada.">Cancelar</ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {old.length > 0 && <span className="xs">Canceladas o vencidas: {old.map((i) => i.label).join(", ")}.</span>}
      {locked && <span className="xs">El check-in ya abrió: las invitaciones ya no se pueden crear ni cancelar.</span>}
    </div>
  );
}
