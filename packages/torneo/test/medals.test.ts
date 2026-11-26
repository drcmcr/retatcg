import { earnedMedals, newMedals, unlockedTitles, titleLabel, MEDAL_TITLES, SEASON_TITLES } from "../src";
import type { SeasonMatch, SeasonTournament } from "../src";

const win = (at: number, own = 2, opp = 2): SeasonMatch => ({ at, result: "win", ownRankIndex: own, opponentRankIndex: opp });
const loss = (at: number): SeasonMatch => ({ at, result: "loss", ownRankIndex: 2, opponentRankIndex: 2 });
const T = (o: Partial<SeasonTournament>): SeasonTournament => ({
  category: "comunitario", accountPlayers: 12, placement: 9, swissRounds: 4, swissLosses: 2, matches: [], ...o,
});

describe("medallas", () => {
  it("sin torneos elegibles no hay medallas; los casuales no cuentan", () => {
    expect(earnedMedals([]).size).toBe(0);
    expect(earnedMedals([T({ category: "casual", placement: 1, matches: [win(1), win(2), win(3), win(4), win(5)] })]).size).toBe(0);
  });

  it("detecta Geoda, Relámpago, Savia, Vórtice, Ponzoña y Astro", () => {
    const m = earnedMedals([
      T({ placement: 1, swissLosses: 0, matches: [win(1), win(2), win(3, 2, 4), win(4), win(5)] }),
    ]);
    expect([...m].sort()).toEqual(["relampago", "geoda", "vortice", "ponzona", "savia", "astro"].sort());
  });

  it("la racha se corta con una derrota y el bye no la afecta", () => {
    const bye: SeasonMatch = { at: 3, result: "bye", ownRankIndex: 2, opponentRankIndex: null };
    expect(earnedMedals([T({ matches: [win(1), win(2), bye, win(4), loss(5), win(6)] })]).has("savia")).toBe(false);
    expect(earnedMedals([T({ matches: [win(1), win(2), bye, win(4), win(5), win(6)] })]).has("savia")).toBe(true);
  });

  it("Vórtice pide terminar el suizo: quien se va invicto antes de la última ronda no la gana", () => {
    // El servidor pasa las rondas suizas del torneo y suma como derrota cada ronda que no jugó.
    const leftAt3of5 = T({ swissRounds: 5, swissLosses: 2 }); // 3-0 y se retiró: faltaron 2 rondas
    expect(earnedMedals([leftAt3of5]).has("vortice")).toBe(false);
    expect(earnedMedals([T({ swissRounds: 5, swissLosses: 0 })]).has("vortice")).toBe(true);
  });

  it("Volcán solo en Clasificatorio o Mayor; Cauce con 5 torneos", () => {
    expect(earnedMedals([T({ placement: 7 })]).has("volcan")).toBe(false);
    expect(earnedMedals([T({ category: "mayor", placement: 7 })]).has("volcan")).toBe(true);
    expect(earnedMedals(Array.from({ length: 5 }, () => T({}))).has("cauce")).toBe(true);
  });

  it("newMedals devuelve solo las nuevas en orden oficial", () => {
    expect(newMedals(["geoda"], [T({ placement: 3 })])).toEqual(["ponzona"]);
  });
});

describe("títulos", () => {
  it("cada medalla desbloquea su título y respeta la forma elegida", () => {
    expect(unlockedTitles(["astro", "geoda"])).toEqual(["geoda", "astro"]);
    expect(titleLabel(MEDAL_TITLES.vortice, "b")).toBe("Invicta");
    expect(titleLabel(MEDAL_TITLES.ponzona, "b")).toBe("Podio");
    expect(titleLabel(SEASON_TITLES.finalista, "a", 1)).toBe("Finalista T1");
  });
});
