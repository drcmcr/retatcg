import { PR_RULES } from "./ranking";
import type { TournamentCategory } from "./types";

export const MEDALS = ["geoda", "cauce", "relampago", "savia", "vortice", "ponzona", "volcan", "astro"] as const;
export type MedalCode = (typeof MEDALS)[number];

export const MEDAL_INFO: Record<MedalCode, { name: string; how: string }> = {
  geoda: { name: "Geoda", how: "Jugar tu primer torneo de la temporada" },
  cauce: { name: "Cauce", how: "Jugar 5 torneos en la temporada" },
  relampago: { name: "Relámpago", how: "Ganar un encuentro contra un rival de rango superior" },
  savia: { name: "Savia", how: "5 victorias de encuentro seguidas" },
  vortice: { name: "Vórtice", how: "Terminar las rondas suizas sin derrotas" },
  ponzona: { name: "Ponzoña", how: "Top 4 en un torneo Comunitario o superior" },
  volcan: { name: "Volcán", how: "Top 8 en un torneo Clasificatorio o Mayor" },
  astro: { name: "Astro", how: "Ganar un torneo Comunitario o superior" },
};

/** Medallas necesarias para la invitación a la Final de Temporada (ajustable con datos reales). */
export const FINAL_INVITE_MEDALS = 6;

export interface SeasonMatch {
  /** Momento del encuentro, para ordenar la racha. */
  at: number;
  result: "win" | "loss" | "draw" | "bye";
  ownRankIndex: number;
  opponentRankIndex: number | null;
}

export interface SeasonTournament {
  category: TournamentCategory;
  accountPlayers: number;
  placement: number;
  /** Rondas suizas jugadas por este jugador y derrotas en ellas (null si el torneo no tuvo suizo). */
  swissRounds: number | null;
  swissLosses: number | null;
  matches: SeasonMatch[];
}

/** Solo cuentan los torneos que también dan PR: no casuales y con al menos 8 jugadores con cuenta. */
export function isEligible(t: SeasonTournament): boolean {
  return t.category !== "casual" && t.accountPlayers >= PR_RULES.minAccountPlayers;
}

/** Medallas que el jugador cumple con su historial de la temporada. */
export function earnedMedals(history: readonly SeasonTournament[]): Set<MedalCode> {
  const eligible = history.filter(isEligible);
  const out = new Set<MedalCode>();
  if (eligible.length >= 1) out.add("geoda");
  if (eligible.length >= 5) out.add("cauce");

  const allMatches = eligible.flatMap((t) => t.matches).sort((x, y) => x.at - y.at);
  if (allMatches.some((m) => m.result === "win" && m.opponentRankIndex !== null && m.opponentRankIndex > m.ownRankIndex)) {
    out.add("relampago");
  }
  let streak = 0;
  for (const m of allMatches) {
    if (m.result === "bye") continue; // el bye ni suma ni corta la racha
    streak = m.result === "win" ? streak + 1 : 0;
    if (streak >= 5) {
      out.add("savia");
      break;
    }
  }
  if (eligible.some((t) => t.swissRounds !== null && t.swissRounds >= 3 && t.swissLosses === 0)) out.add("vortice");
  if (eligible.some((t) => t.placement <= 4)) out.add("ponzona");
  if (eligible.some((t) => (t.category === "clasificatorio" || t.category === "mayor") && t.placement <= 8)) out.add("volcan");
  if (eligible.some((t) => t.placement === 1)) out.add("astro");
  return out;
}

/** Medallas nuevas respecto a las que ya tenía, en el orden oficial. */
export function newMedals(before: Iterable<MedalCode>, history: readonly SeasonTournament[]): MedalCode[] {
  const had = new Set(before);
  const now = earnedMedals(history);
  return MEDALS.filter((m) => now.has(m) && !had.has(m));
}

/**
 * Títulos: cada medalla desbloquea uno, que se queda para siempre (las medallas se reinician cada temporada).
 * El jugador muestra uno a la vez y, si el título tiene dos formas, elige cuál mostrar. La app no pide género.
 */
export type TitleForm = "a" | "b";
export interface TitleInfo {
  /** Forma principal y, si existe, la alternativa (p. ej. Invicto / Invicta). */
  forms: readonly [string] | readonly [string, string];
}

export const MEDAL_TITLES: Record<MedalCode, TitleInfo> = {
  geoda: { forms: ["Debutante"] },
  cauce: { forms: ["Constante"] },
  relampago: { forms: ["Matagigantes"] },
  savia: { forms: ["En racha"] },
  vortice: { forms: ["Invicto", "Invicta"] },
  ponzona: { forms: ["Podio"] },
  volcan: { forms: ["Élite"] },
  astro: { forms: ["Campeón", "Campeona"] },
};

/** Títulos de temporada (llegan cuando exista la Final de Temporada). */
export const SEASON_TITLES = {
  finalista: { forms: ["Finalista"] },
  campeonTemporada: { forms: ["Campeón", "Campeona"] },
} as const satisfies Record<string, TitleInfo>;

/** Texto que se muestra para un título, con su forma y, si aplica, la temporada ("Finalista T1"). */
export function titleLabel(info: TitleInfo, form: TitleForm = "a", season?: number): string {
  const word = form === "b" && info.forms.length === 2 ? info.forms[1] : info.forms[0];
  return season === undefined ? word : `${word} T${season}`;
}

/** Títulos desbloqueados: los de toda medalla ganada en cualquier temporada. */
export function unlockedTitles(medalsEverEarned: Iterable<MedalCode>): MedalCode[] {
  const had = new Set(medalsEverEarned);
  return MEDALS.filter((m) => had.has(m));
}
