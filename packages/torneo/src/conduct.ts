/**
 * Desconexiones y abandono de partida ("ragequit").
 * La app no puede saber si una desconexión fue intencional: lo decide un juez con el reporte del rival,
 * y la escalera de sanciones solo cuenta desconexiones que un juez confirmó como injustificadas.
 */

export interface DisconnectSituation {
  /** Veces que este jugador se ha desconectado en este encuentro (incluida la actual). */
  disconnectsThisMatch: number;
  /** Si volvió a la partida privada dentro del tiempo de espera. */
  reconnectedInTime: boolean;
}

export type DisconnectResolution =
  | { action: "repetir_partida" }
  | { action: "partida_para_rival"; note: string };

/** Minutos que se espera a que el jugador desconectado vuelva a buscar partida. */
export const RECONNECT_WAIT_MIN = 5;

/**
 * Primera desconexión con regreso a tiempo: se repite la partida.
 * Segunda desconexión, o no volver a tiempo: la partida en curso es para quien se quedó
 * (en Bo1 eso decide el encuentro) y se abre un caso para que el juez evalúe sanción.
 */
export function resolveDisconnect(s: DisconnectSituation): DisconnectResolution {
  if (s.disconnectsThisMatch <= 1 && s.reconnectedInTime) return { action: "repetir_partida" };
  return {
    action: "partida_para_rival",
    note: s.reconnectedInTime ? "Segunda desconexión en el mismo encuentro." : `No volvió en ${RECONNECT_WAIT_MIN} minutos.`,
  };
}

export type SanctionKind = "advertencia" | "perdida_encuentro" | "suspension" | "revision_expulsion";

export interface Sanction {
  kind: SanctionKind;
  /** Penalización de PR adicional a la derrota normal. */
  prPenalty: number;
  /** Días sin poder inscribirse a torneos. */
  suspensionDays: number;
  /** Visible en el perfil público (las advertencias solo las ve el staff). */
  publicOnProfile: boolean;
}

/**
 * Escalera por desconexiones injustificadas confirmadas en la temporada.
 * 1.ª advertencia · 2.ª pérdida del encuentro y −20 PR · 3.ª suspensión de 14 días y −40 PR ·
 * 4.ª o más: el superadmin revisa la expulsión de la temporada.
 */
export function disconnectSanction(confirmedInSeason: number): Sanction {
  if (confirmedInSeason <= 1) return { kind: "advertencia", prPenalty: 0, suspensionDays: 0, publicOnProfile: false };
  if (confirmedInSeason === 2) return { kind: "perdida_encuentro", prPenalty: -20, suspensionDays: 0, publicOnProfile: false };
  if (confirmedInSeason === 3) return { kind: "suspension", prPenalty: -40, suspensionDays: 14, publicOnProfile: true };
  return { kind: "revision_expulsion", prPenalty: -40, suspensionDays: 30, publicOnProfile: true };
}
