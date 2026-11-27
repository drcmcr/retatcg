// Datos de presentación de la progresión. Las reglas (PR, rangos, medallas) vienen del motor.
import { MEDALS, MEDAL_INFO, MEDAL_TITLES, rankFromPR, titleLabel, type MedalCode, type TitleForm } from "@reta/torneo";

export { MEDALS, MEDAL_INFO, rankFromPR };
export type { MedalCode };

/** Ícono pixel y degradado (ruta A) de cada medalla. */
export const MEDAL_ART: Record<MedalCode, { icon: string; grad: string }> = {
  geoda: { icon: "cristal", grad: "linear-gradient(115deg,#AAFF01,#D4FF80)" },
  cauce: { icon: "gota", grad: "linear-gradient(115deg,#AAFF01,#01EEFE)" },
  relampago: { icon: "rayo", grad: "linear-gradient(115deg,#01EEFE,#80F6FE)" },
  savia: { icon: "hoja", grad: "linear-gradient(115deg,#01EEFE,#9A78FF)" },
  vortice: { icon: "espiral", grad: "linear-gradient(115deg,#9A78FF,#C4B0FF)" },
  ponzona: { icon: "riesgo", grad: "linear-gradient(115deg,#9A78FF,#01EEFE)" },
  volcan: { icon: "flama", grad: "linear-gradient(115deg,#9A78FF,#01EEFE 50%,#AAFF01)" },
  astro: { icon: "estrella6", grad: "linear-gradient(115deg,#AAFF01,#01EEFE 45%,#9A78FF 80%,#FFFFFF)" },
};

/** Acabado de la tarjeta de cazador por rango. */
export const RANK_FINISH: Record<string, string> = {
  Explorador: "#4A4A56",
  Rastreador: "#2F55FF",
  Trampero: "repeating-linear-gradient(45deg,#1F8A70 0 6px,#26A586 6px 12px)",
  Cazador: "linear-gradient(135deg,#8E959E,#E6E9ED 40%,#7D848C 60%,#D3D7DC)",
  "Cazador Experto": "linear-gradient(135deg,#8A6A1F,#F3D27A 40%,#A27C25 60%,#F7E3A3)",
  "Maestro Cazador": "linear-gradient(115deg,#AAFF01,#01EEFE 50%,#5820FF)",
  Leyenda: "linear-gradient(115deg,#AAFF01,#01EEFE 40%,#5820FF 75%,#FFFFFF)",
};

export function titleText(medal: string | null, form: string | null): string | null {
  if (!medal || !(medal in MEDAL_TITLES)) return null;
  return titleLabel(MEDAL_TITLES[medal as MedalCode], (form as TitleForm) ?? "a");
}

export const CATEGORY: Record<string, { label: string; pill: string; pr: string }> = {
  casual: { label: "Casual", pill: "o", pr: "Sin PR" },
  comunitario: { label: "Comunitario", pill: "c", pr: "PR ×1" },
  clasificatorio: { label: "Clasificatorio", pill: "v", pr: "PR ×1.5" },
  mayor: { label: "Mayor", pill: "v", pr: "PR ×2" },
};

export const PACE_LABEL: Record<string, string> = { en_vivo: "En vivo", jornadas: "Por jornadas", ventana: "Por ventana" };
export const DECK_LABEL: Record<string, string> = { libre: "Libre", por_ronda: "Por ronda", fijo: "Fijo" };

/** Premios: para qué lugar y de qué tipo. Reta solo los muestra; los entrega el organizador. */
export type Prize = { place: string; kind: string; detail: string };
export const PRIZE_PLACES: [string, string][] = [
  ["1", "Campeón"], ["2", "2.º lugar"], ["3", "3.er lugar"], ["top4", "Top 4"], ["top8", "Top 8"], ["todos", "Todos los participantes"], ["mencion", "Mención especial"],
];
export const PRIZE_PLACE_LABEL = Object.fromEntries(PRIZE_PLACES) as Record<string, string>;
export const PRIZE_KINDS: { kind: string; label: string; icon: "card" | "ticket" | "coin" | "box" | "gift"; hint: string }[] = [
  { kind: "carta", label: "Carta digital", icon: "card", hint: "Ej. carta ex de la expansión actual, por intercambio" },
  { kind: "pase", label: "Pase Premium", icon: "ticket", hint: "Ej. 1 mes de Pase Premium" },
  { kind: "dinero", label: "Dinero", icon: "coin", hint: "Ej. $500 MXN por transferencia" },
  { kind: "fisico", label: "Premio físico", icon: "box", hint: "Ej. tapete de juego y fundas" },
  { kind: "otro", label: "Otro", icon: "gift", hint: "Describe el premio" },
];
export const PRIZE_KIND = Object.fromEntries(PRIZE_KINDS.map((k) => [k.kind, k])) as Record<string, (typeof PRIZE_KINDS)[number]>;
const PLACE_ORDER = PRIZE_PLACES.map(([p]) => p);
export const sortPrizes = (list: Prize[]) => [...list].sort((a, b) => PLACE_ORDER.indexOf(a.place) - PLACE_ORDER.indexOf(b.place));

export function formatLabel(t: { format: string; swiss_rounds: number; top_cut: number; swiss_best_of: number; top_best_of: number }): string {
  if (t.format === "single_elim") return `Eliminación directa · Bo${t.top_best_of}`;
  const swiss = `Suizo ${t.swiss_rounds} rondas Bo${t.swiss_best_of}`;
  return t.format === "swiss_topcut" ? `${swiss} · top ${t.top_cut} Bo${t.top_best_of}` : swiss;
}

export const CASE_KIND: Record<string, string> = { marcador: "Marcador", ausente: "Rival ausente", desconexion: "Desconexión", conducta: "Conducta", juez: "Llamada al juez", plazo: "Plazo vencido" };

type LockFields = { category: string; format: string; swiss_rounds: number; top_cut: number; swiss_best_of: number; top_best_of: number; deck_policy: string; restrictions?: Record<string, unknown> | null };

/** Lo que queda fijo al publicar (la base de datos lo rechaza después): se muestra y se confirma antes. */
export function lockedOnPublish(t: LockFields): string[] {
  const restr = t.restrictions && Object.keys(t.restrictions).length > 0;
  return [
    `Categoría: ${CATEGORY[t.category]?.label ?? t.category}`,
    `Formato: ${formatLabel(t)}`,
    `Mazo: ${DECK_LABEL[t.deck_policy] ?? t.deck_policy}${restr ? " con restricciones" : ""}`,
  ];
}

export function publishConfirm(t: LockFields): string {
  return `¿Publicar el torneo?\n\nDespués de publicarlo ya NO se pueden cambiar:\n• ${lockedOnPublish(t).join("\n• ")}\n\nLo demás (fecha, cupo, notas, premios) sí se puede editar mientras la inscripción esté abierta.`;
}
