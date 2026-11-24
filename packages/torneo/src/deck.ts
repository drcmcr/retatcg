import type { TournamentCategory } from "./types";

/**
 * Regla de mazo del torneo.
 * - libre: se puede cambiar de mazo en cada encuentro.
 * - por_ronda: se puede cambiar entre rondas, declarando antes de que salga el emparejamiento.
 * - fijo: un mazo para todo el torneo, declarado al inscribirse.
 * En las tres, dentro de un Bo3 se usa el mismo mazo.
 */
export type DeckPolicy = "libre" | "por_ronda" | "fijo";

export const SAME_DECK_WITHIN_MATCH = true;

export function defaultDeckPolicy(category: TournamentCategory): DeckPolicy {
  if (category === "casual") return "libre";
  if (category === "comunitario") return "por_ronda";
  return "fijo";
}

export interface DeckDeclaration {
  /** 0 = declarado en la inscripción. */
  round: number;
  archetype: string;
  /** Ruta de la captura en el almacenamiento (solo la ve el staff). */
  screenshot: string;
}

/** ¿Se puede declarar (o cambiar) el mazo para esta ronda en este momento? */
export function canDeclare(policy: DeckPolicy, round: number, pairingsPublished: boolean): boolean {
  if (policy === "libre") return false;
  if (policy === "fijo") return round === 0;
  return !pairingsPublished;
}

/**
 * Mazo con el que juega un jugador en una ronda.
 * Por ronda: la última declaración hecha para esa ronda o antes; si no declaró, sigue el de la ronda anterior.
 */
export function deckForRound(policy: DeckPolicy, declarations: readonly DeckDeclaration[], round: number): DeckDeclaration | null {
  if (policy === "libre") return null;
  const valid = declarations.filter((d) => (policy === "fijo" ? d.round === 0 : d.round <= round));
  return valid.reduce<DeckDeclaration | null>((best, d) => (best === null || d.round >= best.round ? d : best), null);
}
