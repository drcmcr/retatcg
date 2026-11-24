import { seededRandom, shuffle } from "./rng";
import { MATCH_POINTS, matchOutcome, pairKey, playedPairs } from "./scoring";
import type { MatchRecord, Pairing, Player, PlayerId } from "./types";

export interface SwissRoundInput {
  players: readonly Player[];
  /** Resultados confirmados de las rondas anteriores. */
  matches: readonly MatchRecord[];
  /** Semilla de esta ronda (se guarda con la ronda para poder reproducirla). */
  seed: string;
}

export interface SwissRoundResult {
  pairings: Pairing[];
  /** Cuántas revanchas fueron inevitables (0 en casi todos los torneos). */
  rematches: number;
}

/** Límite de pasos de búsqueda antes de aceptar revanchas. */
const SEARCH_BUDGET = 200_000;

/**
 * Empareja una ronda suiza.
 * 1. Ordena por puntos; dentro del mismo puntaje, orden aleatorio con semilla.
 * 2. Con número impar, el bye va al jugador de menor puntaje que no haya tenido bye.
 * 3. Empareja de arriba hacia abajo con el rival más cercano en puntos; si un grupo queda impar, el sobrante baja al siguiente.
 * 4. Nunca repite enfrentamientos salvo que sea matemáticamente imposible; en ese caso minimiza las revanchas.
 */
export function pairSwissRound(input: SwissRoundInput): SwissRoundResult {
  const active = input.players.filter((p) => !p.dropped).map((p) => p.id);
  if (active.length < 2) throw new Error("Se necesitan al menos 2 jugadores activos para emparejar.");

  const points = new Map<PlayerId, number>(active.map((id) => [id, 0]));
  const hadBye = new Set<PlayerId>();
  for (const m of input.matches) {
    if (m.b === null) {
      hadBye.add(m.a);
      if (points.has(m.a)) points.set(m.a, points.get(m.a)! + MATCH_POINTS.win);
      continue;
    }
    const o = matchOutcome(m);
    const add = (id: PlayerId, v: number) => points.has(id) && points.set(id, points.get(id)! + v);
    if (o === "A") add(m.a, MATCH_POINTS.win);
    else if (o === "B") add(m.b, MATCH_POINTS.win);
    else if (o === "DRAW") {
      add(m.a, MATCH_POINTS.draw);
      add(m.b, MATCH_POINTS.draw);
    }
  }
  const played = playedPairs(input.matches);

  const rand = seededRandom(input.seed);
  const shuffled = shuffle(active, rand);
  const order = new Map(shuffled.map((id, i) => [id, i]));
  const sorted = shuffled.slice().sort((x, y) => points.get(y)! - points.get(x)! || order.get(x)! - order.get(y)!);

  const byeCandidates: (PlayerId | null)[] = [];
  if (sorted.length % 2 === 1) {
    const fromBottom = sorted.slice().reverse();
    byeCandidates.push(...fromBottom.filter((id) => !hadBye.has(id)));
    if (byeCandidates.length === 0) byeCandidates.push(...fromBottom);
  } else {
    byeCandidates.push(null);
  }

  for (const allowRematch of [false, true]) {
    for (const bye of byeCandidates) {
      const pool = sorted.filter((id) => id !== bye);
      const budget = { left: SEARCH_BUDGET };
      const pairs = pairPool(pool, played, points, allowRematch, budget);
      if (pairs) {
        const pairings: Pairing[] = pairs.map(([a, b], i) => ({ table: i + 1, a, b }));
        if (bye !== null) pairings.push({ table: pairings.length + 1, a: bye, b: null });
        const rematches = pairs.filter(([a, b]) => played.has(pairKey(a, b))).length;
        return { pairings, rematches };
      }
    }
  }
  throw new Error("No fue posible emparejar la ronda.");
}

/**
 * Búsqueda con retroceso: toma al primero sin pareja y prueba rivales en orden
 * de cercanía de puntos. Con `allowRematch`, las revanchas se prueban al final.
 */
function pairPool(
  pool: readonly PlayerId[],
  played: Set<string>,
  points: Map<PlayerId, number>,
  allowRematch: boolean,
  budget: { left: number },
): [PlayerId, PlayerId][] | null {
  const used = new Set<PlayerId>();
  const out: [PlayerId, PlayerId][] = [];

  const step = (): boolean => {
    if (--budget.left < 0) return false;
    const p = pool.find((id) => !used.has(id));
    if (p === undefined) return true;
    used.add(p);
    const pp = points.get(p)!;
    const candidates = pool
      .filter((id) => !used.has(id))
      .map((id, idx) => ({ id, idx, gap: Math.abs(points.get(id)! - pp), rematch: played.has(pairKey(p, id)) }))
      .filter((c) => allowRematch || !c.rematch)
      .sort((x, y) => Number(x.rematch) - Number(y.rematch) || x.gap - y.gap || x.idx - y.idx);
    for (const c of candidates) {
      used.add(c.id);
      out.push([p, c.id]);
      if (step()) return true;
      out.pop();
      used.delete(c.id);
      if (budget.left < 0) break;
    }
    used.delete(p);
    return false;
  };

  return step() ? out : null;
}
