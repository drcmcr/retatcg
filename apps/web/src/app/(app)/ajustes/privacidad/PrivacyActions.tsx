"use client";
import { cancelDeletion, exportMyData, requestDeletion } from "@/actions/profile";
import { useAction, useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

export function PrivacyActions({ deletingAt }: { deletingAt: string | null }) {
  const { run, pending } = useAction();
  const toast = useToast();
  return (
    <>
      <div className="box n4 col" style={{ gap: 8 }}>
        <span className="row"><Icon name="dl" size={20} /><b>Descargar mis datos</b></span>
        <span className="sm">Perfil, torneos, resultados, títulos y sanciones en un archivo.</span>
        <button className="btn g sm" disabled={pending} onClick={async () => {
          const r = await exportMyData();
          if (!r.ok) return toast({ tone: "err", text: r.error });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
          a.download = "mis-datos-reta.json";
          a.click();
        }}>Descargar archivo</button>
      </div>
      <div className="box n4 col edge-e" style={{ gap: 8 }}>
        <span className="row err"><Icon name="trash" size={20} /><b>Eliminar mi cuenta</b></span>
        {deletingAt ? (
          <>
            <span className="sm">Tu cuenta se borra el {deletingAt}. Hasta entonces puedes arrepentirte.</span>
            <button className="btn g" disabled={pending} onClick={() => run(() => cancelDeletion(), { ok: "Cancelaste la eliminación." })}>No borrar mi cuenta</button>
          </>
        ) : (
          <>
            <span className="sm">Se borran tus datos. Tus resultados quedan como “Jugador eliminado” para no romper las tablas de otros. Tienes 7 días para arrepentirte.</span>
            <button className="btn d" disabled={pending} onClick={() => { if (confirm("¿Eliminar tu cuenta? Tienes 7 días para arrepentirte.")) run(() => requestDeletion(), { ok: "Tu cuenta se borrará en 7 días." }); }}>Eliminar cuenta</button>
          </>
        )}
      </div>
    </>
  );
}
