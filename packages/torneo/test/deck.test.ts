import { describe, expect, it } from "vitest";
import { canDeclare, deckForRound, defaultDeckPolicy } from "../src";

const decl = (round: number, archetype: string) => ({ round, archetype, screenshot: `cap-${round}.png` });

describe("regla de mazo", () => {
  it("usa la regla por defecto de cada categoría", () => {
    expect(defaultDeckPolicy("casual")).toBe("libre");
    expect(defaultDeckPolicy("comunitario")).toBe("por_ronda");
    expect(defaultDeckPolicy("clasificatorio")).toBe("fijo");
    expect(defaultDeckPolicy("mayor")).toBe("fijo");
  });

  it("por ronda: se declara antes del emparejamiento y se arrastra si no se cambia", () => {
    expect(canDeclare("por_ronda", 3, false)).toBe(true);
    expect(canDeclare("por_ronda", 3, true)).toBe(false);
    const ds = [decl(0, "Agua"), decl(3, "Psíquico")];
    expect(deckForRound("por_ronda", ds, 2)?.archetype).toBe("Agua");
    expect(deckForRound("por_ronda", ds, 4)?.archetype).toBe("Psíquico");
  });

  it("fijo: solo cuenta la declaración de la inscripción", () => {
    expect(canDeclare("fijo", 0, false)).toBe(true);
    expect(canDeclare("fijo", 2, false)).toBe(false);
    expect(deckForRound("fijo", [decl(0, "Agua"), decl(2, "Fuego")], 3)?.archetype).toBe("Agua");
  });

  it("libre: no se declara", () => {
    expect(canDeclare("libre", 0, false)).toBe(false);
    expect(deckForRound("libre", [decl(0, "Agua")], 1)).toBeNull();
  });
});
