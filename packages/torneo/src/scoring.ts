import { hashString } from "./rng";
import type { MatchOutcome, MatchRecord, Player, PlayerId } from "./types";

export const MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;

export interface StandingsOptions {
  /**
   * Piso para el porcentaje de victorias de cada rival al calcular OMW%.
   * 0.25 = estilo Play! Pokémon (por defecto); 0.33 = estilo Magic.
   */
  floor?: number;
  /** Marcador en partidas que se acredita por un bye (por defecto 2-0). */
  byeGames?: number;
  /** Semilla del sorteo final cuando todo lo demás empata. Debe guardarse con el torneo. */
  lotSeed?: string;
}

export interface Standing {
  rank: number;
  playerId: PlayerId;
  dropped: boolean;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  matchPoints: number;
  /** Porcentaje de victorias propio (con piso), el que usan los rivales en su OMW%. */
  mwp: number;
  omwp: number;
  oomwp: number;
  gwp: number;
  /** Rivales enfrentados, sin contar byes. */
  opponents: PlayerId[];
}

export function matchOutcome(m: MatchRecord): MatchOutcome {
  if (m.b === null) return "A";
  if (m.doubleLoss) return "BOTH_LOSE";
  if (m.gamesA > m.gamesB) return "A";
  if (m.gamesB > m.gamesA) return "B";
  return "DRAW";
}

interface Acc {
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  gamePoints: number;
  gamesPlayed: number;
  opponents: PlayerId[];
}

/**
 * Calcula la tabla de posiciones.
 * Orden: puntos de encuentro → OMW% → OOMW% → GW% → enfrentamiento directo → sorteo con semilla.
 * Los jugadores retirados siguen en la tabla (marcados) y sus resultados cuentan para sus rivales.
 */
export function computeStandings(
  players: readonly Player[],
  matches: readonly MatchRecord[],
  opts: StandingsOptions = {},
): Standing[] {
  const floor = opts.floor ?? 0.25;
  const byeGames = opts.byeGames ?? 2;
  const lotSeed = opts.lotSeed ?? "sorteo";

  const acc = new Map<PlayerId, Acc>();
  for (const p of players) {
    acc.set(p.id, { wins: 0, losses: 0, draws: 0, byes: 0, gamePoints: 0, gamesPlayed: 0, opponents: [] });
  }
  const get = (id: PlayerId): Acc => {
    const a = acc.get(id);
    if (!a) throw new Error(`Resultado con un jugador que no está inscrito: ${id}`);
    return a;
  };

  for (const m of matches) {
    const A = get(m.a);
    if (m.b === null) {
      A.wins++;
      A.byes++;
      A.gamePoints += 3 * byeGames;
      A.gamesPlayed += byeGames;
      continue;
    }
    const B = get(m.b);
    A.opponents.push(m.b);
    B.opponents.push(m.a);
    if (m.doubleLoss) {
      A.losses++;
      B.losses++;
      continue;
    }
    const games = m.gamesA + m.gamesB + m.gameDraws;
    A.gamePoints += 3 * m.gamesA + m.gameDraws;
    B.gamePoints += 3 * m.gamesB + m.gameDraws;
    A.gamesPlayed += games;
    B.gamesPlayed += games;
    const o = matchOutcome(m);
    if (o === "A") {
      A.wins++;
      B.losses++;
    } else if (o === "B") {
      B.wins++;
      A.losses++;
    } else {
      A.draws++;
      B.draws++;
    }
  }

  const points = (a: Acc) => a.wins * MATCH_POINTS.win + a.draws * MATCH_POINTS.draw;
  const played = (a: Acc) => a.wins + a.losses + a.draws;

  const mwp = new Map<PlayerId, number>();
  for (const [id, a] of acc) {
    const n = played(a);
    mwp.set(id, n === 0 ? floor : Math.max(floor, points(a) / (3 * n)));
  }
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);
  const omwp = new Map<PlayerId, number>();
  for (const [id, a] of acc) omwp.set(id, avg(a.opponents.map((o) => mwp.get(o)!)));
  const oomwp = new Map<PlayerId, number>();
  for (const [id, a] of acc) oomwp.set(id, avg(a.opponents.map((o) => omwp.get(o)!)));

  const dropped = new Set(players.filter((p) => p.dropped).map((p) => p.id));

  const rows: Standing[] = players.map((p) => {
    const a = acc.get(p.id)!;
    return {
      rank: 0,
      playerId: p.id,
      dropped: dropped.has(p.id),
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      byes: a.byes,
      matchPoints: points(a),
      mwp: mwp.get(p.id)!,
      omwp: omwp.get(p.id)!,
      oomwp: oomwp.get(p.id)!,
      gwp: a.gamesPlayed === 0 ? floor : Math.max(floor, a.gamePoints / (3 * a.gamesPlayed)),
      opponents: a.opponents,
    };
  });

  const EPS = 1e-9;
  const cmpNum = (x: number, y: number) => (Math.abs(x - y) < EPS ? 0 : y - x);
  rows.sort(
    (x, y) =>
      cmpNum(x.matchPoints, y.matchPoints) ||
      cmpNum(x.omwp, y.omwp) ||
      cmpNum(x.oomwp, y.oomwp) ||
      cmpNum(x.gwp, y.gwp) ||
      hashString(lotSeed + x.playerId) - hashString(lotSeed + y.playerId),
  );

  applyHeadToHead(rows, matches, EPS);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/**
 * Si dos jugadores consecutivos empatan en todo hasta GW% y se enfrentaron,
 * el ganador de ese encuentro queda arriba (solo empates entre exactamente dos).
 */
function applyHeadToHead(rows: Standing[], matches: readonly MatchRecord[], eps: number): void {
  const same = (x: Standing, y: Standing) =>
    Math.abs(x.matchPoints - y.matchPoints) < eps &&
    Math.abs(x.omwp - y.omwp) < eps &&
    Math.abs(x.oomwp - y.oomwp) < eps &&
    Math.abs(x.gwp - y.gwp) < eps;
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && same(rows[i]!, rows[j]!)) j++;
    if (j - i === 2) {
      const x = rows[i]!;
      const y = rows[i + 1]!;
      let xWins = 0;
      let yWins = 0;
      for (const m of matches) {
        if (m.b === null) continue;
        const pair = (m.a === x.playerId && m.b === y.playerId) || (m.a === y.playerId && m.b === x.playerId);
        if (!pair) continue;
        const o = matchOutcome(m);
        const winner = o === "A" ? m.a : o === "B" ? m.b : null;
        if (winner === x.playerId) xWins++;
        if (winner === y.playerId) yWins++;
      }
      if (yWins > xWins) {
        rows[i] = y;
        rows[i + 1] = x;
      }
    }
    i = j;
  }
}

/** Conjunto de enfrentamientos ya jugados, para evitar revanchas. */
export function playedPairs(matches: readonly MatchRecord[]): Set<string> {
  const s = new Set<string>();
  for (const m of matches) if (m.b !== null) s.add(pairKey(m.a, m.b));
  return s;
}

export function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
