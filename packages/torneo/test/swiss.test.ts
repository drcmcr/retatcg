import { computeStandings, pairKey, pairSwissRound, recommendedSwissRounds, seededRandom } from "../src";
import type { MatchRecord, Player } from "../src";

function simulate(n: number, seed: string, dropOne = false) {
  const players: Player[] = Array.from({ length: n }, (_, i) => ({ id: `j${String(i + 1).padStart(3, "0")}` }));
  const rand = seededRandom(seed);
  const matches: MatchRecord[] = [];
  const rounds = recommendedSwissRounds(n);
  const byes = new Set<string>();
  let rematches = 0;
  for (let r = 1; r <= rounds; r++) {
    if (dropOne && r === 3) players[Math.floor(rand() * n)]!.dropped = true;
    const { pairings, rematches: rm } = pairSwissRound({ players, matches, seed: `${seed}-r${r}` });
    rematches += rm;
    const active = players.filter((p) => !p.dropped).map((p) => p.id).sort();
    const seen = pairings.flatMap((p) => (p.b ? [p.a, p.b] : [p.a])).sort();
    expect(seen).toEqual(active);
    const byeRows = pairings.filter((p) => p.b === null);
    expect(byeRows.length).toBe(active.length % 2);
    for (const b of byeRows) {
      expect(byes.has(b.a)).toBe(false);
      byes.add(b.a);
    }
    for (const p of pairings) {
      if (p.b === null) {
        matches.push({ round: r, a: p.a, b: null, gamesA: 0, gamesB: 0, gameDraws: 0 });
        continue;
      }
      const x = rand();
      const res = x < 0.05 ? [1, 1, 0] : x < 0.525 ? [2, 1, 0] : [1, 2, 0];
      matches.push({ round: r, a: p.a, b: p.b, gamesA: res[0]!, gamesB: res[1]!, gameDraws: res[2]! });
    }
  }
  return { players, matches, rematches };
}

describe("pairSwissRound", () => {
  it("es determinista con la misma semilla", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` }));
    const a = pairSwissRound({ players, matches: [], seed: "s" }).pairings;
    const b = pairSwissRound({ players, matches: [], seed: "s" }).pairings;
    expect(a).toEqual(b);
  });

  it("con número impar da exactamente un bye en la última mesa", () => {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` }));
    const { pairings } = pairSwissRound({ players, matches: [], seed: "x" });
    expect(pairings.at(-1)!.b).toBeNull();
    expect(pairings.filter((p) => p.b === null)).toHaveLength(1);
  });

  it("empareja primero a quienes tienen los mismos puntos", () => {
    const players = ["a", "b", "c", "d"].map((id) => ({ id }));
    const matches: MatchRecord[] = [
      { round: 1, a: "a", b: "c", gamesA: 1, gamesB: 0, gameDraws: 0 },
      { round: 1, a: "b", b: "d", gamesA: 1, gamesB: 0, gameDraws: 0 },
    ];
    const { pairings } = pairSwissRound({ players, matches, seed: "z" });
    const keys = pairings.map((p) => pairKey(p.a, p.b!)).sort();
    expect(keys).toEqual([pairKey("a", "b"), pairKey("c", "d")].sort());
  });

  const sizes = [4, 5, 7, 8, 9, 12, 16, 17, 24, 32, 33, 48, 64, 65, 100, 128];
  it.each(sizes)("simula un torneo completo de %i jugadores sin revanchas ni byes repetidos", (n) => {
    for (const seed of ["a", "b", "c"]) {
      const { players, matches, rematches } = simulate(n, `${n}-${seed}`, n > 10);
      expect(rematches).toBe(0);
      const s = computeStandings(players, matches);
      expect(s).toHaveLength(n);
    }
  });
});
