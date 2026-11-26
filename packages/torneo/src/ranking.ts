import type { TournamentCategory } from "./types";

/** Rangos con divisiones III, II, I; cada rango abarca 300 PR (100 por división). */
export const RANKS = ["Explorador", "Rastreador", "Trampero", "Cazador", "Cazador Experto", "Maestro Cazador"] as const;
export const LEGEND = "Leyenda" as const;
export type RankName = (typeof RANKS)[number] | typeof LEGEND;

export const PR_PER_DIVISION = 100;
export const PR_PER_RANK = 300;
/** PR mínimo para optar a Leyenda (además de estar en el top 100). */
export const LEGEND_THRESHOLD = RANKS.length * PR_PER_RANK; // 1800
export const LEGEND_SLOTS = 100;

export const PR_RULES = {
  matchWin: 15,
  matchLoss: -5,
  matchDraw: 5,
  placementBonus: { first: 60, second: 40, top4: 25, top8: 15 },
  multiplier: { casual: 0, comunitario: 1, clasificatorio: 1.5, mayor: 2 } satisfies Record<TournamentCategory, number>,
  minAccountPlayers: 8,
  /** Victorias contra el mismo rival que cuentan por semana. */
  winsPerRivalPerWeek: 2,
} as const;

export interface RankInfo {
  index: number; // 0 = Explorador … 5 = Maestro Cazador, 6 = Leyenda
  name: RankName;
  /** "III" | "II" | "I" o, para Leyenda, el lugar ("#27"). */
  division: string;
  /** PR dentro de la división actual (0–99) y lo que falta para la siguiente. */
  progress: number;
  toNext: number | null;
}

/**
 * Rango a partir del PR de temporada.
 * Leyenda exige PR ≥ 1800 y estar en el top 100 de la temporada; si no, se queda en Maestro Cazador I.
 */
export function rankFromPR(pr: number, leaderboardPosition?: number): RankInfo {
  const p = Math.max(0, Math.floor(pr));
  if (p >= LEGEND_THRESHOLD && leaderboardPosition !== undefined && leaderboardPosition <= LEGEND_SLOTS) {
    return { index: RANKS.length, name: LEGEND, division: `#${leaderboardPosition}`, progress: 0, toNext: null };
  }
  const capped = Math.min(p, LEGEND_THRESHOLD - 1);
  const index = Math.floor(capped / PR_PER_RANK);
  const within = capped - index * PR_PER_RANK;
  const div = Math.floor(within / PR_PER_DIVISION); // 0, 1, 2
  const division = (["III", "II", "I"] as const)[div]!;
  const progress = within - div * PR_PER_DIVISION;
  const isTop = index === RANKS.length - 1 && div === 2;
  return {
    index,
    name: RANKS[index]!,
    division,
    progress: p >= LEGEND_THRESHOLD ? PR_PER_DIVISION - 1 : progress,
    toNext: isTop ? Math.max(0, LEGEND_THRESHOLD - p) : PR_PER_DIVISION - progress,
  };
}

export interface TournamentPRInput {
  category: TournamentCategory;
  /** Jugadores con cuenta en el torneo (los invitados no cuentan). */
  accountPlayers: number;
  /** Victorias que cuentan para PR (ya filtradas con `countableWins`); los byes cuentan como victoria. */
  wins: number;
  losses: number;
  draws: number;
  /** Posición final (1 = campeón). */
  placement: number;
  /**
   * Rondas suizas que ya no jugó porque dejó el torneo antes de terminar (se retiró, no se presentó a su mesa
   * o lo sacó el staff). Cada una cuenta como derrota para que retirarse nunca convenga más que seguir jugando.
   */
  unplayedRounds?: number;
}

export interface PRBreakdown {
  eligible: boolean;
  reason?: string;
  wins: number;
  losses: number;
  draws: number;
  /** Puntos restados por rondas suizas que no jugó al dejar el torneo (negativo o 0). */
  unplayed: number;
  placementBonus: number;
  multiplier: number;
  total: number;
}

export function tournamentPR(input: TournamentPRInput): PRBreakdown {
  const multiplier = PR_RULES.multiplier[input.category];
  const base = { wins: 0, losses: 0, draws: 0, unplayed: 0, placementBonus: 0, multiplier, total: 0 };
  if (multiplier === 0) return { ...base, eligible: false, reason: "Los torneos casuales no dan PR." };
  if (input.accountPlayers < PR_RULES.minAccountPlayers) {
    return { ...base, eligible: false, reason: `Se necesitan al menos ${PR_RULES.minAccountPlayers} jugadores con cuenta.` };
  }
  const wins = input.wins * PR_RULES.matchWin;
  const losses = input.losses * PR_RULES.matchLoss;
  const draws = input.draws * PR_RULES.matchDraw;
  const unplayed = Math.max(0, input.unplayedRounds ?? 0) * PR_RULES.matchLoss;
  const b = PR_RULES.placementBonus;
  const placementBonus =
    input.placement === 1 ? b.first : input.placement === 2 ? b.second : input.placement <= 4 ? b.top4 : input.placement <= 8 ? b.top8 : 0;
  const total = Math.round((wins + losses + draws + unplayed + placementBonus) * multiplier);
  return { eligible: true, wins, losses, draws, unplayed, placementBonus, multiplier, total };
}

/**
 * Rondas suizas que un jugador dejó sin jugar. Solo cuenta si dejó el torneo antes de terminar; el top cut no
 * cuenta porque tampoco lo juegan quienes no clasificaron. Los byes cuentan como ronda jugada.
 */
export function unplayedSwissRounds(dropped: boolean, swissRoundsInTournament: number, swissRoundsPlayed: number): number {
  return dropped ? Math.max(0, swissRoundsInTournament - swissRoundsPlayed) : 0;
}

/**
 * Filtra victorias contra el mismo rival: solo cuentan `winsPerRivalPerWeek` por semana.
 * `priorWinsThisWeek` trae las victorias ya contadas esa semana contra cada rival.
 */
export function countableWins(
  winsAgainst: readonly string[],
  priorWinsThisWeek: Readonly<Record<string, number>> = {},
  cap: number = PR_RULES.winsPerRivalPerWeek,
): number {
  const seen: Record<string, number> = { ...priorWinsThisWeek };
  let count = 0;
  for (const rival of winsAgainst) {
    const n = seen[rival] ?? 0;
    if (n < cap) count++;
    seen[rival] = n + 1;
  }
  return count;
}

/**
 * Aplica un cambio de PR respetando el piso de la temporada:
 * se puede bajar de división, pero nunca por debajo del rango más alto alcanzado.
 */
export function applyPRDelta(current: number, delta: number, highestRankIndexReached: number): number {
  const floor = Math.min(highestRankIndexReached, RANKS.length) * PR_PER_RANK;
  return Math.max(floor, Math.max(0, current + delta));
}

/** Reinicio suave al cerrar temporada: todos bajan un rango (al inicio del rango anterior). */
export function seasonSoftReset(pr: number): number {
  const index = Math.min(Math.floor(Math.max(0, pr) / PR_PER_RANK), RANKS.length);
  return Math.max(0, (index - 1) * PR_PER_RANK);
}
