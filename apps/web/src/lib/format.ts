// Fechas y números en español de México.
const TZ = "America/Mexico_City";

export function fmtDateTime(iso: string | Date, tz = TZ): string {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz })
    .format(new Date(iso)).replace(/\./g, "");
}
export function fmtDate(iso: string | Date, tz = TZ): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: tz }).format(new Date(iso)).replace(/\./g, "");
}
export function fmtTime(iso: string | Date, tz = TZ): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
}
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}
export function ordinal(n: number): string {
  return `${n}.º`;
}
export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
export function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ayer";
  return fmtDate(iso);
}
