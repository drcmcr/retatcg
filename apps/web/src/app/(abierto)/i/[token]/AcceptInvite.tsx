"use client";
import { useRouter } from "next/navigation";
import { claimInvite } from "@/actions/player";
import { useAction } from "@/components/client";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <button className="btn p" disabled={pending} onClick={() => run(() => claimInvite(token), {
      ok: "¡Listo! Tu lugar está apartado.",
      then: (code) => { router.replace(`/torneo/${code as string}`); router.refresh(); },
    })}>{pending ? "Apartando…" : "Aceptar y apartar mi lugar"}</button>
  );
}
