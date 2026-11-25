"use client";
import { caseReply } from "@/actions/match";
import { useAction } from "@/components/client";
import { CaptureUpload } from "@/components/Upload";

export function CaseReply({ caseId, tournamentId, userId }: { caseId: number; tournamentId: string; userId: string }) {
  const { run, pending } = useAction();
  return (
    <div className="col stick-bottom" style={{ gap: 8, marginTop: "auto" }}>
      <span className="lbl">Responder</span>
      <div className="chips">
        {[["no_tengo_captura", "No tengo captura"], ["entendido", "Entendido"], ["sigo_esperando", "Sigo esperando"]].map(([k, l]) => (
          <button key={k} className="chip o" disabled={pending} onClick={() => run(() => caseReply(caseId, k!), { ok: "Respuesta enviada." })}>{l}</button>
        ))}
      </div>
      <CaptureUpload tournamentId={tournamentId} userId={userId} label="Adjuntar captura"
        onUploaded={(path) => run(() => caseReply(caseId, "envio_captura", path), { ok: "Captura enviada al juez." })} />
    </div>
  );
}
