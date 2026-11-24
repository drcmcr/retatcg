import type { Pairing, PlayerId } from "./types";

/**
 * Orden estándar de siembra para un bracket de `size` (potencia de 2):
 * 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Así el 1 y el 2 solo pueden cruzarse en la final.
 */
export function seedOrder(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) throw new Error("El tamaño del bracket debe ser potencia de 2.");
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Primera ronda de eliminación directa. `seeded` va del mejor sembrado al peor
 * (por ejemplo, el top cut en el orden de la tabla del suizo).
 * Los huecos hasta la siguiente potencia de 2 son byes para los mejores sembrados.
 */
export function firstEliminationRound(seeded: readonly PlayerId[]): Pairing[] {
  if (seeded.length < 2) throw new Error("Se necesitan al menos 2 jugadores.");
  const size = nextPowerOfTwo(seeded.length);
  const order = seedOrder(size);
  const slot = (seed: number): PlayerId | null => seeded[seed - 1] ?? null;
  const pairings: Pairing[] = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = slot(order[i]!);
    const b = slot(order[i + 1]!);
    if (a === null && b === null) continue;
    pairings.push(a === null ? { table: 0, a: b!, b: null } : { table: 0, a, b });
  }
  return pairings.map((p, i) => ({ ...p, table: i + 1 }));
}

/**
 * Siguiente ronda: los ganadores de la ronda anterior, en el orden de sus mesas.
 * Mesa 1 contra mesa 2, mesa 3 contra mesa 4… respeta la estructura del bracket.
 */
export function nextEliminationRound(winnersInTableOrder: readonly PlayerId[]): Pairing[] {
  if (winnersInTableOrder.length < 2) throw new Error("El torneo ya tiene campeón.");
  if (winnersInTableOrder.length % 2 !== 0) throw new Error("Número impar de ganadores: el bracket está incompleto.");
  const out: Pairing[] = [];
  for (let i = 0; i < winnersInTableOrder.length; i += 2) {
    out.push({ table: i / 2 + 1, a: winnersInTableOrder[i]!, b: winnersInTableOrder[i + 1]! });
  }
  return out;
}

/**
 * Posición final en eliminación según la ronda en que cayó cada jugador.
 * `eliminatedIn`: número de ronda en que perdió (el campeón no aparece).
 * Quienes caen en la misma ronda comparten rango (p. ej. 5.º–8.º); el desempate fino lo da la tabla del suizo.
 */
export function eliminationPlacement(totalRounds: number, eliminatedInRound: number | null): { from: number; to: number } {
  if (eliminatedInRound === null) return { from: 1, to: 1 };
  const remaining = 2 ** (totalRounds - eliminatedInRound + 1);
  return { from: remaining / 2 + 1, to: remaining };
}
