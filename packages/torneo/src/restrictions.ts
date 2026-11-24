import type { DeckPolicy } from "./deck";

/** Reglas base de Pocket: siempre aplican. */
export const POCKET_DECK = { size: 20, maxCopiesPerName: 2 } as const;

export type ExRule =
  | { kind: "permitidos" }
  | { kind: "prohibidos" }
  | { kind: "solo_ex" }
  | { kind: "sin_mega" }
  | { kind: "maximo"; count: number };

/** Restricciones que el organizador elige de una lista. Todo campo ausente = sin restricción. */
export interface DeckRestrictions {
  /** Expansiones permitidas (códigos de set). */
  allowedSets?: readonly string[];
  /** Alternativa a allowedSets: todas las expansiones con orden de lanzamiento ≤ este. */
  upToReleaseOrder?: number;
  bannedCards?: readonly string[];
  /** Cartas con máximo 1 copia. */
  limitedCards?: readonly string[];
  ex?: ExRule;
  onlyDiamondRarity?: boolean;
  noPromos?: boolean;
  /** Todos los Pokémon del mazo deben ser de este tipo. */
  monotype?: string;
  /** Regla en texto que revisa el juez a mano. */
  freeText?: string;
}

/** Datos de una carta, de la base de cartas en texto. */
export interface CardInfo {
  id: string;
  name: string;
  set: string;
  releaseOrder: number;
  kind: "pokemon" | "entrenador";
  /** Tipo de energía del Pokémon. */
  type?: string;
  isEx?: boolean;
  isMega?: boolean;
  isPromo?: boolean;
  /** Rareza de rombos (◊ a ◊◊◊◊). */
  diamond?: boolean;
}

export function hasRestrictions(r: DeckRestrictions): boolean {
  return (
    !!r.allowedSets?.length ||
    r.upToReleaseOrder !== undefined ||
    !!r.bannedCards?.length ||
    !!r.limitedCards?.length ||
    (r.ex !== undefined && r.ex.kind !== "permitidos") ||
    !!r.onlyDiamondRarity ||
    !!r.noPromos ||
    !!r.monotype ||
    !!r.freeText?.trim()
  );
}

/** Con restricciones, el mazo libre no se puede revisar: la regla sube a "por ronda" como mínimo. */
export function effectiveDeckPolicy(chosen: DeckPolicy, r: DeckRestrictions): DeckPolicy {
  return chosen === "libre" && hasRestrictions(r) ? "por_ronda" : chosen;
}

/** Errores de configuración que el asistente muestra al organizador. */
export function validateRestrictionsConfig(r: DeckRestrictions): string[] {
  const e: string[] = [];
  if (r.allowedSets?.length && r.upToReleaseOrder !== undefined) e.push("Elige sets uno por uno o \"hasta una expansión\", no las dos cosas.");
  if (r.ex?.kind === "maximo" && (!Number.isInteger(r.ex.count) || r.ex.count < 1)) e.push("El máximo de ex debe ser un número entero de 1 o más.");
  const both = (r.bannedCards ?? []).filter((c) => (r.limitedCards ?? []).includes(c));
  if (both.length) e.push(`Una carta no puede estar prohibida y limitada a la vez: ${both.join(", ")}.`);
  if (r.ex?.kind === "solo_ex" && r.onlyDiamondRarity) e.push("\"Solo ex\" y \"solo rombos\" pueden dejar el torneo sin mazos posibles; revisa la combinación.");
  return e;
}

/**
 * Revisa una lista de cartas contra las reglas base y las restricciones (para las decklists de la v2).
 * `deck` = ids de carta, con repetición. Devuelve las infracciones en lenguaje simple.
 */
export function checkDeck(deck: readonly string[], r: DeckRestrictions, db: ReadonlyMap<string, CardInfo>): string[] {
  const out: string[] = [];
  const cards = deck.map((id) => {
    const c = db.get(id);
    if (!c) throw new Error(`Carta desconocida: ${id}`);
    return c;
  });
  if (cards.length !== POCKET_DECK.size) out.push(`El mazo tiene ${cards.length} cartas; deben ser ${POCKET_DECK.size}.`);
  const byName = new Map<string, number>();
  for (const c of cards) byName.set(c.name, (byName.get(c.name) ?? 0) + 1);
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  for (const [name, n] of byName) {
    if (n > POCKET_DECK.maxCopiesPerName) out.push(`${name}: ${n} copias; el máximo es ${POCKET_DECK.maxCopiesPerName}.`);
  }
  for (const c of unique) {
    if (r.allowedSets?.length && !r.allowedSets.includes(c.set)) out.push(`${c.name} es de una expansión no permitida.`);
    if (r.upToReleaseOrder !== undefined && c.releaseOrder > r.upToReleaseOrder) out.push(`${c.name} es de una expansión posterior a la permitida.`);
    if (r.bannedCards?.includes(c.id)) out.push(`${c.name} está prohibida.`);
    if (r.limitedCards?.includes(c.id) && (byName.get(c.name) ?? 0) > 1) out.push(`${c.name} está limitada a 1 copia.`);
    if (r.onlyDiamondRarity && !c.diamond) out.push(`${c.name} no es de rareza de rombos.`);
    if (r.noPromos && c.isPromo) out.push(`${c.name} es promo.`);
    if (r.monotype && c.kind === "pokemon" && c.type !== r.monotype) out.push(`${c.name} no es de tipo ${r.monotype}.`);
  }
  const pokemon = cards.filter((c) => c.kind === "pokemon");
  const exCount = pokemon.filter((c) => c.isEx).length;
  switch (r.ex?.kind) {
    case "prohibidos":
      if (exCount > 0) out.push("El torneo no permite Pokémon ex.");
      break;
    case "solo_ex":
      if (pokemon.some((c) => !c.isEx)) out.push("El torneo solo permite Pokémon ex.");
      break;
    case "sin_mega":
      if (pokemon.some((c) => c.isMega)) out.push("El torneo no permite Mega ex.");
      break;
    case "maximo":
      if (exCount > r.ex.count) out.push(`El mazo tiene ${exCount} cartas ex; el máximo es ${r.ex.count}.`);
      break;
  }
  return out;
}
