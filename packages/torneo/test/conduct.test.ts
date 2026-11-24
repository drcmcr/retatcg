import { disconnectSanction, estimateTournamentMinutes, resolveDisconnect } from "../src";

describe("desconexiones", () => {
  it("la primera desconexión con regreso a tiempo repite la partida", () => {
    expect(resolveDisconnect({ disconnectsThisMatch: 1, reconnectedInTime: true }).action).toBe("repetir_partida");
  });
  it("la segunda, o no volver a tiempo, da la partida al rival", () => {
    expect(resolveDisconnect({ disconnectsThisMatch: 2, reconnectedInTime: true }).action).toBe("partida_para_rival");
    expect(resolveDisconnect({ disconnectsThisMatch: 1, reconnectedInTime: false }).action).toBe("partida_para_rival");
  });
  it("la escalera de sanciones crece por temporada", () => {
    expect(disconnectSanction(1)).toMatchObject({ kind: "advertencia", publicOnProfile: false });
    expect(disconnectSanction(2)).toMatchObject({ kind: "perdida_encuentro", prPenalty: -20 });
    expect(disconnectSanction(3)).toMatchObject({ kind: "suspension", suspensionDays: 14, publicOnProfile: true });
    expect(disconnectSanction(5).kind).toBe("revision_expulsion");
  });
});

describe("duración estimada", () => {
  it("32 jugadores, suizo Bo1 y top 4 Bo3 ≈ 4 h 40 min en el peor caso", () => {
    // 5 rondas × (25 + 3) + 10 + 2 rondas × (50 + 3) = 140 + 10 + 106 = 256 min
    expect(estimateTournamentMinutes({ players: 32, swissBestOf: 1, topCut: 4, topCutBestOf: 3 })).toBe(256);
  });
  it("8 jugadores casual Bo1 sin top cut ≈ 1 h 24 min", () => {
    expect(estimateTournamentMinutes({ players: 8, swissBestOf: 1, topCut: 0, topCutBestOf: 1 })).toBe(84);
  });
});
