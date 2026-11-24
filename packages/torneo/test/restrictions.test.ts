import { describe, expect, it } from "vitest";
import { checkDeck, effectiveDeckPolicy, hasRestrictions, validateRestrictionsConfig } from "../src";
import type { CardInfo } from "../src";

const card = (id: string, extra: Partial<CardInfo> = {}): CardInfo => ({
  id, name: id, set: "A1", releaseOrder: 1, kind: "pokemon", type: "agua", diamond: true, ...extra,
});
const db = new Map<string, CardInfo>(
  [
    card("p1"), card("p2"), card("p3"), card("p4"), card("p5"),
    card("ex1", { isEx: true, diamond: false }),
    card("mega", { isEx: true, isMega: true, diamond: false }),
    card("fuego", { type: "fuego" }),
    card("nuevo", { set: "A3", releaseOrder: 3 }),
    card("promo", { set: "P-A", isPromo: true }),
    card("t1", { kind: "entrenador", type: undefined }), card("t2", { kind: "entrenador", type: undefined }),
    card("t3", { kind: "entrenador", type: undefined }), card("t4", { kind: "entrenador", type: undefined }),
    card("t5", { kind: "entrenador", type: undefined }),
  ].map((c) => [c.id, c]),
);
// 20 cartas: 5 Pokémon y 5 entrenadores, dos copias de cada uno
const base = ["p1", "p2", "p3", "p4", "p5", "t1", "t2", "t3", "t4", "t5"].flatMap((id) => [id, id]);
const swap = (from: string, to: string) => { const d = [...base]; d[d.indexOf(from)] = to; return d; };

describe("restricciones de mazo", () => {
  it("con restricciones, el mazo libre sube a por ronda", () => {
    expect(hasRestrictions({})).toBe(false);
    expect(hasRestrictions({ ex: { kind: "permitidos" } })).toBe(false);
    expect(effectiveDeckPolicy("libre", { noPromos: true })).toBe("por_ronda");
    expect(effectiveDeckPolicy("libre", {})).toBe("libre");
    expect(effectiveDeckPolicy("fijo", { noPromos: true })).toBe("fijo");
  });

  it("detecta configuraciones contradictorias", () => {
    expect(validateRestrictionsConfig({ allowedSets: ["A1"], upToReleaseOrder: 2 })).toHaveLength(1);
    expect(validateRestrictionsConfig({ bannedCards: ["x"], limitedCards: ["x"] })).toHaveLength(1);
    expect(validateRestrictionsConfig({ ex: { kind: "maximo", count: 0 } })).toHaveLength(1);
  });

  it("aplica las reglas base de Pocket", () => {
    expect(checkDeck(base, {}, db)).toEqual([]);
    expect(checkDeck(base.slice(1), {}, db).join(" ")).toMatch(/19 cartas/);
    expect(checkDeck(swap("p2", "p1"), {}, db).join(" ")).toMatch(/p1: 3 copias/);
  });

  it("revisa cada tipo de restricción", () => {
    expect(checkDeck(swap("p1", "nuevo"), { upToReleaseOrder: 2 }, db).join(" ")).toMatch(/posterior/);
    expect(checkDeck(swap("p1", "nuevo"), { allowedSets: ["A1"] }, db).join(" ")).toMatch(/no permitida/);
    expect(checkDeck(base, { bannedCards: ["t3"] }, db).join(" ")).toMatch(/t3 está prohibida/);
    expect(checkDeck(base, { limitedCards: ["t3"] }, db).join(" ")).toMatch(/limitada a 1/);
    expect(checkDeck(swap("p1", "ex1"), { ex: { kind: "prohibidos" } }, db).join(" ")).toMatch(/no permite Pokémon ex/);
    expect(checkDeck(swap("p1", "mega"), { ex: { kind: "sin_mega" } }, db).join(" ")).toMatch(/Mega/);
    expect(checkDeck(swap("p1", "ex1"), { ex: { kind: "maximo", count: 0 } }, db).join(" ")).toMatch(/máximo es 0/);
    expect(checkDeck(swap("p1", "ex1"), { onlyDiamondRarity: true }, db).join(" ")).toMatch(/rombos/);
    expect(checkDeck(swap("p1", "promo"), { noPromos: true }, db).join(" ")).toMatch(/promo/);
    expect(checkDeck(swap("p1", "fuego"), { monotype: "agua" }, db).join(" ")).toMatch(/tipo agua/);
    expect(checkDeck(base, { monotype: "agua" }, db)).toEqual([]); // los entrenadores no cuentan
  });
});
