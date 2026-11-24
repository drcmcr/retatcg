import { eliminationRounds } from "./structure";

/**
 * Ritmo del torneo: cuándo se juega cada ronda.
 * - en_vivo: una sesión, rondas cronometradas (TIMING).
 * - jornadas: sesiones con fecha y hora; cada una corre como en vivo.
 * - ventana: cada ronda tiene un plazo y cada mesa juega cuando le convenga.
 */
export type Pace =
  | { kind: "en_vivo" }
  | { kind: "jornadas"; sessions: readonly Session[] }
  | { kind: "ventana"; windowHours: number };

export interface Session {
  /** Inicio de la jornada (ms desde epoch). */
  startsAt: number;
  /** Rondas que se juegan en esta jornada (1 = primera del suizo). El top cut sigue la numeración. */
  rounds: readonly number[];
}

export const SESSIONS = {
  /** El check-in de cada jornada abre antes de su inicio; sin check-in, el jugador queda fuera del torneo. */
  checkInOpensBefore: 30,
  /** Recordatorios antes de cada jornada, en minutos. */
  remindersBefore: [24 * 60, 60],
} as const;

export const WINDOW = {
  defaultHours: 24,
  options: [24, 48],
  /** Bloques de disponibilidad. */
  slotMinutes: 60,
  reminderBefore: 15,
  /** Tolerancia para presentarse a la hora acordada. */
  tableTolerance: 10,
  /** Tiempo del rival para confirmar un reporte. */
  autoConfirm: 60,
  /** Extensión máxima que el organizador puede dar a una mesa. */
  maxExtensionHours: 24,
} as const;

const HOUR = 3_600_000;

/** Fecha límite de una ronda por ventana, con la extensión que el organizador haya dado a esa mesa. */
export function roundDeadline(openedAt: number, windowHours: number, extensionHours = 0): number {
  if (extensionHours < 0 || extensionHours > WINDOW.maxExtensionHours) {
    throw new Error(`La extensión debe estar entre 0 y ${WINDOW.maxExtensionHours} horas.`);
  }
  return openedAt + (windowHours + extensionHours) * HOUR;
}

/**
 * Primer bloque de disponibilidad en común. Cada bloque se identifica por su hora de inicio (ms).
 * Solo cuentan bloques que empiezan a partir de `now` y terminan antes del cierre.
 */
export function firstCommonSlot(
  a: readonly number[],
  b: readonly number[],
  now: number,
  deadline: number,
  slotMs: number = WINDOW.slotMinutes * 60_000,
): number | null {
  const theirs = new Set(b);
  const common = a.filter((t) => theirs.has(t) && t >= now && t + slotMs <= deadline).sort((x, y) => x - y);
  return common[0] ?? null;
}

export interface WindowActivity {
  /** Marcó al menos un bloque de disponibilidad dentro del plazo. */
  markedAvailability: boolean;
  /** Propuso o aceptó un horario. */
  proposedOrAccepted: boolean;
  /** Hizo check-in a la hora acordada. */
  checkedInAtAgreedTime: boolean;
}

/** "Activo" según el registro de la app. Si ya había hora acordada, solo cuenta haber llegado a ella. */
export function isActive(x: WindowActivity, agreedTimeSet: boolean): boolean {
  if (agreedTimeSet) return x.checkedInAtAgreedTime;
  return x.markedAvailability || x.proposedOrAccepted || x.checkedInAtAgreedTime;
}

export type WindowResolution = "reportado" | "victoria_a" | "victoria_b" | "derrota_doble" | "juez";

/** Qué pasa con una mesa cuando vence el plazo de la ronda. */
export function resolveAtDeadline(t: {
  confirmed: boolean;
  disputeOpen: boolean;
  agreedTimeSet: boolean;
  a: WindowActivity;
  b: WindowActivity;
}): WindowResolution {
  if (t.disputeOpen) return "juez";
  if (t.confirmed) return "reportado";
  const a = isActive(t.a, t.agreedTimeSet);
  const b = isActive(t.b, t.agreedTimeSet);
  if (a && !b) return "victoria_a";
  if (b && !a) return "victoria_b";
  if (!a && !b) return "derrota_doble";
  return "juez"; // los dos estuvieron activos y aun así no jugaron
}

export type TableStatus = "sin_coordinar" | "agendada" | "jugando" | "por_confirmar" | "disputa" | "confirmada";

/** La ronda puede cerrarse antes del plazo cuando todas las mesas están confirmadas. */
export function canCloseEarly(statuses: readonly TableStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === "confirmada");
}

/** En una llave de eliminación, a qué mesa y lado de la siguiente ronda pasa el ganador. Permite avanzar mesa por mesa. */
export function bracketFeed(table: number): { table: number; side: "a" | "b" } {
  if (table < 1) throw new Error("Las mesas empiezan en 1.");
  return { table: Math.ceil(table / 2), side: table % 2 === 1 ? "a" : "b" };
}

/** Días que dura un torneo por ventana en el peor caso (todas las rondas usan su plazo completo). */
export function estimateWindowDays(d: { swissRounds: number; topCut: number; windowHours: number }): number {
  const rounds = d.swissRounds + (d.topCut >= 2 ? eliminationRounds(d.topCut) : 0);
  return (rounds * d.windowHours) / 24;
}

/** Revisa el calendario de jornadas: cada ronda en exactamente una jornada, y las jornadas en orden. */
export function validateSessions(sessions: readonly Session[], totalRounds: number): string[] {
  const errors: string[] = [];
  const seen = new Map<number, number>();
  sessions.forEach((s, i) => {
    if (i > 0 && s.startsAt <= sessions[i - 1]!.startsAt) errors.push(`La jornada ${i + 1} empieza antes que la anterior.`);
    for (const r of s.rounds) seen.set(r, (seen.get(r) ?? 0) + 1);
  });
  let last = 0;
  for (const s of sessions) {
    for (const r of [...s.rounds].sort((x, y) => x - y)) {
      if (r < last) errors.push(`La ronda ${r} va en una jornada posterior a la ronda ${last}.`);
      last = Math.max(last, r);
    }
  }
  for (let r = 1; r <= totalRounds; r++) {
    const n = seen.get(r) ?? 0;
    if (n === 0) errors.push(`La ronda ${r} no está en ninguna jornada.`);
    if (n > 1) errors.push(`La ronda ${r} está en más de una jornada.`);
  }
  return errors;
}
