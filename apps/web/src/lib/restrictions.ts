// Texto de las restricciones de mazo para jugadores y staff.
export type Restrictions = {
  allowedSets?: string[]; upToReleaseOrder?: number; upToSetName?: string; bannedCards?: string[]; limitedCards?: string[];
  ex?: { kind: string; count?: number }; onlyDiamondRarity?: boolean; noPromos?: boolean; monotype?: string; freeText?: string;
};

export function describeRestrictions(raw: Record<string, unknown> | null | undefined): string[] {
  const r = (raw ?? {}) as Restrictions;
  const out: string[] = [];
  if (r.upToSetName) out.push(`Sets hasta ${r.upToSetName}`);
  else if (r.allowedSets?.length) out.push(`Solo sets ${r.allowedSets.join(", ")}`);
  if (r.ex?.kind === "prohibidos") out.push("Sin Pokémon ex");
  if (r.ex?.kind === "sin_mega") out.push("Sin Mega ex");
  if (r.ex?.kind === "solo_ex") out.push("Solo Pokémon ex");
  if (r.ex?.kind === "maximo") out.push(`Máximo ${r.ex.count} ex`);
  if (r.bannedCards?.length) out.push(`Prohibidas: ${r.bannedCards.join(", ")}`);
  if (r.limitedCards?.length) out.push(`Limitadas a 1: ${r.limitedCards.join(", ")}`);
  if (r.onlyDiamondRarity) out.push("Solo rareza de rombos");
  if (r.noPromos) out.push("Sin promos");
  if (r.monotype) out.push(`Monotipo ${r.monotype}`);
  if (r.freeText?.trim()) out.push(r.freeText.trim());
  return out;
}
