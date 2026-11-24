import { describe, expect, it } from "vitest";
import {
  bracketFeed,
  canCloseEarly,
  computeStandings,
  estimateWindowDays,
  firstCommonSlot,
  pairSwissRound,
  resolveAtDeadline,
  roundDeadline,
  validateSessions,
} from "../src";
import type { MatchRecord, WindowActivity } from "../src";

const H = 3_600_000;
const idle: WindowActivity = { markedAvailability: false, proposedOrAccepted: false, checkedInAtAgreedTime: false };
const marked: WindowActivity = { ...idle, markedAvailability: true };
const arrived: WindowActivity = { ...idle, proposedOrAccepted: true, checkedInAtAgreedTime: true };

describe("ritmo por ventana", () => {
  it("calcula el cierre con extensión y la limita a 24 h", () => {
    expect(roundDeadline(0, 24)).toBe(24 * H);
    expect(roundDeadline(0, 24, 6)).toBe(30 * H);
    expect(() => roundDeadline(0, 24, 25)).toThrow();
  });

  it("propone el primer bloque en común dentro del plazo", () => {
    const a = [5 * H, 9 * H, 20 * H, 23 * H];
    const b = [23 * H, 9 * H, 20 * H];
    expect(firstCommonSlot(a, b, 6 * H, 24 * H)).toBe(9 * H);
    expect(firstCommonSlot(a, b, 21 * H, 24 * H)).toBe(23 * H);
    expect(firstCommonSlot(a, b, 21 * H, 23.5 * H)).toBeNull(); // el bloque no cabe antes del cierre
  });

  it("resuelve las mesas al vencer el plazo", () => {
    const base = { confirmed: false, disputeOpen: false, agreedTimeSet: false };
    expect(resolveAtDeadline({ ...base, confirmed: true, a: idle, b: idle })).toBe("reportado");
    expect(resolveAtDeadline({ ...base, a: marked, b: idle })).toBe("victoria_a");
    expect(resolveAtDeadline({ ...base, a: idle, b: marked })).toBe("victoria_b");
    expect(resolveAtDeadline({ ...base, a: idle, b: idle })).toBe("derrota_doble");
    expect(resolveAtDeadline({ ...base, a: marked, b: marked })).toBe("juez");
    expect(resolveAtDeadline({ ...base, disputeOpen: true, confirmed: true, a: marked, b: marked })).toBe("juez");
  });

  it("con hora acordada solo cuenta haber llegado", () => {
    const accepted: WindowActivity = { markedAvailability: true, proposedOrAccepted: true, checkedInAtAgreedTime: false };
    expect(resolveAtDeadline({ confirmed: false, disputeOpen: false, agreedTimeSet: true, a: arrived, b: accepted })).toBe("victoria_a");
  });

  it("cierra antes solo si todas las mesas están confirmadas", () => {
    expect(canCloseEarly(["confirmada", "confirmada"])).toBe(true);
    expect(canCloseEarly(["confirmada", "por_confirmar"])).toBe(false);
    expect(canCloseEarly([])).toBe(false);
  });

  it("estima la duración de un torneo de 26 jugadores con rondas de 24 h", () => {
    expect(estimateWindowDays({ swissRounds: 5, topCut: 4, windowHours: 24 })).toBe(7);
  });

  it("la llave avanza mesa por mesa", () => {
    expect(bracketFeed(1)).toEqual({ table: 1, side: "a" });
    expect(bracketFeed(2)).toEqual({ table: 1, side: "b" });
    expect(bracketFeed(7)).toEqual({ table: 4, side: "a" });
  });
});

describe("derrota doble", () => {
  const players = ["a", "b", "c", "d"].map((id) => ({ id }));
  const matches: MatchRecord[] = [
    { round: 1, a: "a", b: "b", gamesA: 0, gamesB: 0, gameDraws: 0, doubleLoss: true },
    { round: 1, a: "c", b: "d", gamesA: 2, gamesB: 0, gameDraws: 0 },
  ];

  it("cuenta como derrota para los dos y sin puntos", () => {
    const s = computeStandings(players, matches);
    const row = (id: string) => s.find((r) => r.playerId === id)!;
    expect(row("a")).toMatchObject({ wins: 0, losses: 1, draws: 0, matchPoints: 0 });
    expect(row("b")).toMatchObject({ wins: 0, losses: 1, draws: 0, matchPoints: 0 });
    expect(row("c").rank).toBe(1);
  });

  it("el suizo no les suma puntos ni repite el cruce", () => {
    const { pairings } = pairSwissRound({ players, matches, seed: "r2" });
    const ab = pairings.some((p) => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"));
    expect(ab).toBe(false);
  });
});

describe("ritmo por jornadas", () => {
  it("acepta un calendario válido", () => {
    expect(validateSessions([{ startsAt: 1, rounds: [1, 2, 3] }, { startsAt: 2, rounds: [4, 5] }], 5)).toEqual([]);
  });
  it("detecta rondas faltantes, repetidas y fuera de orden", () => {
    const errs = validateSessions([{ startsAt: 2, rounds: [3, 4] }, { startsAt: 1, rounds: [1, 4] }], 5);
    expect(errs.join(" ")).toMatch(/empieza antes/);
    expect(errs.join(" ")).toMatch(/ronda 2 no está/);
    expect(errs.join(" ")).toMatch(/ronda 4 está en más/);
  });
});
