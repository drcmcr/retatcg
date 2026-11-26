import { applyPRDelta, countableWins, rankFromPR, seasonSoftReset, tournamentPR, unplayedSwissRounds } from "../src";

describe("rankFromPR", () => {
  it.each([
    [120, "Explorador", "II"],
    [420, "Rastreador", "II"],
    [720, "Trampero", "II"],
    [1045, "Cazador", "II"],
    [1260, "Cazador Experto", "III"],
    [1345, "Cazador Experto", "II"],
    [1645, "Maestro Cazador", "II"],
  ])("%i PR → %s %s", (pr, name, div) => {
    const r = rankFromPR(pr);
    expect(r.name).toBe(name);
    expect(r.division).toBe(div);
  });

  it("muestra el avance dentro de la división", () => {
    expect(rankFromPR(1045)).toMatchObject({ progress: 45, toNext: 55 });
  });

  it("Leyenda exige 1800 PR y estar en el top 100", () => {
    expect(rankFromPR(2240, 27)).toMatchObject({ name: "Leyenda", division: "#27" });
    expect(rankFromPR(2240, 150)).toMatchObject({ name: "Maestro Cazador", division: "I" });
    expect(rankFromPR(1700, 1).name).toBe("Maestro Cazador");
  });
});

describe("tournamentPR", () => {
  it("reproduce el ejemplo de la pantalla de subida de rango (+80)", () => {
    const r = tournamentPR({ category: "comunitario", accountPlayers: 12, wins: 4, losses: 1, draws: 0, placement: 4 });
    expect(r).toMatchObject({ eligible: true, wins: 60, losses: -5, placementBonus: 25, total: 80 });
  });

  it("aplica el multiplicador por categoría", () => {
    expect(tournamentPR({ category: "clasificatorio", accountPlayers: 20, wins: 4, losses: 1, draws: 0, placement: 4 }).total).toBe(120);
    expect(tournamentPR({ category: "mayor", accountPlayers: 20, wins: 5, losses: 0, draws: 0, placement: 1 }).total).toBe(270);
  });

  it("retirarse no conviene: cada ronda suiza sin jugar cuenta como derrota", () => {
    // Suizo de 3 rondas: gana 1, pierde 1 (no se presentó) y deja el torneo; la ronda 3 cuenta como derrota.
    const dropped = tournamentPR({ category: "comunitario", accountPlayers: 16, wins: 1, losses: 1, draws: 0, placement: 14, unplayedRounds: 1 });
    const stayed = tournamentPR({ category: "comunitario", accountPlayers: 16, wins: 1, losses: 2, draws: 0, placement: 12 });
    expect(dropped).toMatchObject({ unplayed: -5, total: 5 });
    expect(dropped.total).toBeLessThanOrEqual(stayed.total);
    // Si se va 1-0 en la ronda 1, tampoco supera a quien termina 1-2.
    const early = tournamentPR({ category: "comunitario", accountPlayers: 16, wins: 1, losses: 0, draws: 0, placement: 10, unplayedRounds: 2 });
    expect(early.total).toBeLessThanOrEqual(stayed.total);
  });

  it("solo cuentan las rondas suizas que faltaron a quien dejó el torneo", () => {
    expect(unplayedSwissRounds(false, 5, 3)).toBe(0);
    expect(unplayedSwissRounds(true, 5, 3)).toBe(2);
    expect(unplayedSwissRounds(true, 3, 3)).toBe(0);
    expect(unplayedSwissRounds(true, 0, 0)).toBe(0);
  });

  it("el empate da +5 y el bye cuenta como victoria", () => {
    const r = tournamentPR({ category: "comunitario", accountPlayers: 10, wins: 2, losses: 1, draws: 1, placement: 9 });
    expect(r).toMatchObject({ wins: 30, losses: -5, draws: 5, total: 30 });
  });

  it("casual o con menos de 8 jugadores con cuenta no da PR", () => {
    expect(tournamentPR({ category: "casual", accountPlayers: 30, wins: 5, losses: 0, draws: 0, placement: 1 }).eligible).toBe(false);
    expect(tournamentPR({ category: "comunitario", accountPlayers: 7, wins: 5, losses: 0, draws: 0, placement: 1 }).eligible).toBe(false);
  });
});

describe("reglas de temporada", () => {
  it("solo cuentan 2 victorias por semana contra el mismo rival", () => {
    expect(countableWins(["x", "x", "x", "y"])).toBe(3);
    expect(countableWins(["x", "y"], { x: 2 })).toBe(1);
  });

  it("se puede bajar de división pero no del rango más alto alcanzado", () => {
    expect(applyPRDelta(1210, -50, 4)).toBe(1200);
    expect(applyPRDelta(1250, -100, 3)).toBe(1150);
    expect(applyPRDelta(10, -50, 0)).toBe(0);
  });

  it("el reinicio suave baja un rango", () => {
    expect(seasonSoftReset(1260)).toBe(900);
    expect(seasonSoftReset(100)).toBe(0);
    expect(seasonSoftReset(2240)).toBe(1500);
  });
});
