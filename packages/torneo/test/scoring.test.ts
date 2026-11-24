import { computeStandings, matchOutcome } from "../src";
import type { MatchRecord, Player } from "../src";

const P = (...ids: string[]): Player[] => ids.map((id) => ({ id }));
const M = (round: number, a: string, b: string | null, gamesA: number, gamesB: number, gameDraws = 0): MatchRecord => ({ round, a, b, gamesA, gamesB, gameDraws });

describe("matchOutcome", () => {
  it("decide por partidas ganadas y trata el bye como victoria", () => {
    expect(matchOutcome(M(1, "a", "b", 2, 1))).toBe("A");
    expect(matchOutcome(M(1, "a", "b", 0, 1))).toBe("B");
    expect(matchOutcome(M(1, "a", "b", 1, 1))).toBe("DRAW");
    expect(matchOutcome(M(1, "a", "b", 0, 0, 1))).toBe("DRAW");
    expect(matchOutcome(M(1, "a", null, 0, 0))).toBe("A");
  });
});

describe("computeStandings", () => {
  const players = P("p1", "p2", "p3", "p4");
  const matches = [M(1, "p1", "p2", 2, 0), M(1, "p3", "p4", 2, 1), M(2, "p1", "p3", 2, 1), M(2, "p2", "p4", 2, 0)];

  it("ordena por puntos y calcula OMW% con piso de 25%", () => {
    const s = computeStandings(players, matches);
    expect(s.map((r) => r.playerId)[0]).toBe("p1");
    expect(s.map((r) => r.playerId)[3]).toBe("p4");
    const byId = Object.fromEntries(s.map((r) => [r.playerId, r]));
    expect(byId.p1!.matchPoints).toBe(6);
    expect(byId.p4!.mwp).toBeCloseTo(0.25);
    expect(byId.p1!.omwp).toBeCloseTo(0.5);
    expect(byId.p2!.omwp).toBeCloseTo(0.625);
    expect(byId.p3!.omwp).toBeCloseTo(0.625);
    expect(byId.p2!.gwp).toBeCloseTo(0.5);
    expect(s.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("el piso es configurable (33% estilo Magic)", () => {
    const s = computeStandings(players, matches, { floor: 0.33 });
    expect(s.find((r) => r.playerId === "p4")!.mwp).toBeCloseTo(0.33);
  });

  it("el bye da 3 puntos y no cuenta como rival", () => {
    const s = computeStandings(P("a", "b", "c"), [M(1, "a", "b", 1, 0), M(1, "c", null, 0, 0)]);
    const c = s.find((r) => r.playerId === "c")!;
    expect(c.matchPoints).toBe(3);
    expect(c.byes).toBe(1);
    expect(c.opponents).toEqual([]);
  });

  it("el sorteo final es estable con la misma semilla", () => {
    const a = computeStandings(P("x", "y"), [], { lotSeed: "t1" }).map((r) => r.playerId);
    const b = computeStandings(P("x", "y"), [], { lotSeed: "t1" }).map((r) => r.playerId);
    expect(a).toEqual(b);
  });

  it("los retirados siguen en la tabla y cuentan para sus rivales", () => {
    const s = computeStandings([{ id: "a" }, { id: "b", dropped: true }], [M(1, "a", "b", 1, 0)]);
    expect(s.find((r) => r.playerId === "b")!.dropped).toBe(true);
    expect(s.find((r) => r.playerId === "a")!.omwp).toBeCloseTo(0.25);
  });
});
