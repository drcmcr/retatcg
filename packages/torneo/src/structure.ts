/** Rondas suizas sugeridas por número de jugadores (editable por el organizador). */
export function recommendedSwissRounds(players: number): number {
  if (players < 2) return 0;
  if (players <= 3) return players - 1;
  if (players <= 8) return 3;
  if (players <= 16) return 4;
  if (players <= 32) return 5;
  if (players <= 64) return 6;
  if (players <= 128) return 7;
  return 8;
}

/** Top cut sugerido: sin corte hasta 8, top 4 de 9 a 32, top 8 desde 33. */
export function recommendedTopCut(players: number): 0 | 4 | 8 {
  if (players <= 8) return 0;
  if (players <= 32) return 4;
  return 8;
}

/** Rondas de eliminación necesarias para un bracket de n jugadores. */
export function eliminationRounds(players: number): number {
  return players < 2 ? 0 : Math.ceil(Math.log2(players));
}

/** Tiempos por defecto, en minutos. El organizador puede cambiarlos por torneo. */
export const TIMING = {
  /** El check-in del torneo abre antes de la hora de inicio y cierra al iniciar. */
  tournamentCheckInOpensBefore: 30,
  /** Tiempo para presentarse a la mesa ("ya estoy buscando") antes de declarar no-show. */
  roundCheckIn: 5,
  /** Duración de la ronda, incluido el check-in de mesa. Una partida de Pocket dura como máximo 40 min (20 por jugador). */
  round: { bo1: 25, bo3: 50 },
  /** Tras el reporte de un jugador, el rival tiene este tiempo para confirmar o disputar; después se confirma solo. */
  autoConfirm: 5,
  /** Pausa entre que se confirma la última mesa y se publica la siguiente ronda. */
  betweenRounds: 3,
  /** Pausa entre el final del suizo y el inicio del top cut. */
  beforeTopCut: 10,
} as const;

export interface DurationInput {
  players: number;
  swissBestOf: 1 | 3;
  /** 0 = sin top cut. */
  topCut: number;
  topCutBestOf: 1 | 3;
}

/** Duración estimada en minutos (peor caso razonable: cada ronda agota su tiempo). */
export function estimateTournamentMinutes(d: DurationInput): number {
  const swiss = recommendedSwissRounds(d.players);
  const swissRound = (d.swissBestOf === 1 ? TIMING.round.bo1 : TIMING.round.bo3) + TIMING.betweenRounds;
  let total = swiss * swissRound;
  if (d.topCut >= 2) {
    const topRound = (d.topCutBestOf === 1 ? TIMING.round.bo1 : TIMING.round.bo3) + TIMING.betweenRounds;
    total += TIMING.beforeTopCut + eliminationRounds(d.topCut) * topRound;
  }
  return total;
}
