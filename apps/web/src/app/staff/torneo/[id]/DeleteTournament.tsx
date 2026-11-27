"use client";
import { useRouter } from "next/navigation";
import { deleteTournament } from "@/actions/staff";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";

/** Eliminar un borrador o un cancelado que nunca se jugó; al terminar regresa a Mis torneos. */
export function DeleteTournament({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <button type="button" className="btn d sm" disabled={pending} onClick={() => {
      if (!window.confirm(`¿Eliminar "${name}"? Se borra con sus inscripciones e invitaciones y no se puede deshacer.`)) return;
      run(() => deleteTournament(id), { ok: "Torneo eliminado.", then: () => router.push("/staff") });
    }}>
      <Icon name="trash" size={18} />{pending ? "Eliminando…" : "Eliminar torneo"}
    </button>
  );
}
