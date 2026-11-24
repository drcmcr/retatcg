import { eliminationPlacement, firstEliminationRound, nextEliminationRound, recommendedSwissRounds, recommendedTopCut, seedOrder } from "../src";

describe("eliminación directa", () => {
  it("usa el orden de siembra estándar", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it("da byes a los mejores sembrados cuando no es potencia de 2", () => {
    const p = firstEliminationRound(["s1", "s2", "s3", "s4", "s5", "s6"]);
    expect(p).toEqual([
      { table: 1, a: "s1", b: null },
      { table: 2, a: "s4", b: "s5" },
      { table: 3, a: "s2", b: null },
      { table: 4, a: "s3", b: "s6" },
    ]);
  });

  it("la siguiente ronda cruza mesas consecutivas", () => {
    expect(nextEliminationRound(["a", "b", "c", "d"])).toEqual([
      { table: 1, a: "a", b: "b" },
      { table: 2, a: "c", b: "d" },
    ]);
  });

  it("calcula la posición por la ronda en que cayó", () => {
    expect(eliminationPlacement(3, null)).toEqual({ from: 1, to: 1 });
    expect(eliminationPlacement(3, 3)).toEqual({ from: 2, to: 2 });
    expect(eliminationPlacement(3, 2)).toEqual({ from: 3, to: 4 });
    expect(eliminationPlacement(3, 1)).toEqual({ from: 5, to: 8 });
  });
});

describe("estructura sugerida", () => {
  it("sigue la tabla de la especificación", () => {
    expect([8, 16, 32, 64, 128, 200].map(recommendedSwissRounds)).toEqual([3, 4, 5, 6, 7, 8]);
    expect([8, 9, 32, 33].map(recommendedTopCut)).toEqual([0, 4, 4, 8]);
  });
});
