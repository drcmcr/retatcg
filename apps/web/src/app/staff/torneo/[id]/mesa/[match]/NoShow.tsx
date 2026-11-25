"use client";
import { staffNoShow } from "@/actions/staff";
import { ActionButton } from "@/components/client";

/** El juez marca que un jugador no se presentó: gana su rival y el ausente sale del torneo. */
export function NoShow({ matchId, players }: { matchId: string; players: { id: string; name: string }[] }) {
  return (
    <div className="box n4 col" style={{ gap: 8 }}>
      <span className="lbl" style={{ fontSize: 16 }}>No se presentó</span>
      <span className="sm">Da la mesa a su rival y lo saca del torneo: ya no lo emparejan. Queda en la auditoría.</span>
      <div className="row wrap" style={{ gap: 8 }}>
        {players.map((p) => (
          <ActionButton key={p.id} className="btn d sm" action={() => staffNoShow(matchId, p.id)}
            confirm={`¿${p.name} no se presentó? Su rival gana la mesa y ${p.name} sale del torneo.`} ok={`${p.name} salió del torneo.`}>
            {p.name} no llegó
          </ActionButton>
        ))}
      </div>
    </div>
  );
}
