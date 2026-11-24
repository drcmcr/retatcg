/** Identificador estable de una inscripción (jugador con cuenta o invitado). */
export type PlayerId = string;

export interface Player {
  id: PlayerId;
  /** Se retiró del torneo: ya no se empareja, pero sus resultados cuentan para los desempates de sus rivales. */
  dropped?: boolean;
}

/**
 * Resultado de un encuentro ya confirmado (por ambos jugadores o por un juez).
 * `b === null` significa bye.
 * El marcador va en partidas: Bo1 → 1-0 / 0-1 / 0-0 con 1 empate; Bo3 → 2-0, 2-1, 1-1 por tiempo, etc.
 */
export interface MatchRecord {
  round: number;
  a: PlayerId;
  b: PlayerId | null;
  gamesA: number;
  gamesB: number;
  gameDraws: number;
  /**
   * Derrota para los dos (ritmo por ventana: ninguno estuvo activo antes del plazo).
   * Cuenta como derrota para ambos y no suma partidas; el marcador debe ir en 0-0.
   */
  doubleLoss?: boolean;
}

export type MatchOutcome = "A" | "B" | "DRAW" | "BOTH_LOSE";

export interface Pairing {
  /** Número de mesa, empezando en 1. El bye siempre va al final. */
  table: number;
  a: PlayerId;
  b: PlayerId | null;
}

export type TournamentCategory = "casual" | "comunitario" | "clasificatorio" | "mayor";
