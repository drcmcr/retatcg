// Íconos de trazo de Reta (24×24, línea cuadrada). Mismos que las pantallas aprobadas.
import type { SVGProps } from "react";

const PATHS = {
  home: "<path d=\"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z\"/>",
  trophy: "<path d=\"M7 4h10v5a5 5 0 0 1-10 0z\"/><path d=\"M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6\"/>",
  users: "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20a6.5 6.5 0 0 1 13 0\"/><path d=\"M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5\"/>",
  user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
  bell: "<path d=\"M6 16V11a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21h4\"/>",
  back: "<path d=\"M15 4l-8 8 8 8\"/>",
  right: "<path d=\"M9 5l7 7-7 7\"/>",
  copy: "<rect x=\"8\" y=\"8\" width=\"12\" height=\"12\"/><path d=\"M16 8V4H4v12h4\"/>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  check: "<path d=\"M4 12l5 5L20 6\"/>",
  x: "<path d=\"M5 5l14 14M19 5L5 19\"/>",
  judge: "<path d=\"M4 20h10M6 16l8-8M11 3l7 7M9 5l7 7M14 13l6 6\"/>",
  msg: "<path d=\"M4 5h16v11H9l-5 4z\"/>",
  wifioff: "<path d=\"M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.4-1.7M2 9.5a15 15 0 0 1 4.5-2.6M22 9.5a15 15 0 0 0-11-3.6\"/><circle cx=\"12\" cy=\"20\" r=\"1\"/>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-4-4\"/>",
  plus: "<path d=\"M12 5v14M5 12h14\"/>",
  qr: "<path d=\"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2\"/>",
  cal: "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>",
  share: "<path d=\"M12 15V3M7 8l5-5 5 5\"/><path d=\"M5 12v9h14v-9\"/>",
  gear: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1\"/>",
  shield: "<path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/>",
  out: "<path d=\"M10 4H4v16h6M15 8l4 4-4 4M9 12h10\"/>",
  trash: "<path d=\"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13\"/>",
  dl: "<path d=\"M12 3v12M7 10l5 5 5-5M5 21h14\"/>",
  edit: "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/>",
  lock: "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/>",
  info: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6M12 7.5v.5\"/>",
  warn: "<path d=\"M12 3l10 18H2z\"/><path d=\"M12 10v5M12 18v.5\"/>",
  star: "<path d=\"M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z\"/>",
  chart: "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>",
  filter: "<path d=\"M3 5h18l-7 8v6l-4 2v-8z\"/>",
  play: "<path d=\"M7 4l13 8-13 8z\"/>",
  flag: "<path d=\"M5 21V4h11l-2 4 2 4H5\"/>",
  cam: "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\"/><path d=\"M8 7l2-3h4l2 3\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>",
  img: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\"/><path d=\"M3 16l5-5 4 4 3-3 6 6\"/><circle cx=\"15\" cy=\"9\" r=\"1.5\"/>",
  refresh: "<path d=\"M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7\"/>",
  globe: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18\"/>",
  eye: "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  phone: "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\"/><path d=\"M11 18h2\"/>",
  grid: "<path d=\"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z\"/>",
  list: "<path d=\"M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1\"/>",
  zap: "<path d=\"M13 2L4 14h7l-1 8 9-12h-7z\"/>",
  doc: "<path d=\"M6 2h9l5 5v15H6z\"/><path d=\"M14 2v6h6M9 13h8M9 17h8\"/>",
  megaphone: "<path d=\"M3 10v4h4l9 5V5L7 10z\"/><path d=\"M19 9a4 4 0 0 1 0 6\"/>",
  ban: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M5.6 5.6l12.8 12.8\"/>",
  swap: "<path d=\"M4 8h14l-4-4M20 16H6l4 4\"/>",
  heart: "<path d=\"M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z\"/>",
  fire: "<path d=\"M12 22a7 7 0 0 1-7-7c0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 3 3 4 5 4 8a7 7 0 0 1-7 7z\"/>",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, weight = 2, ...rest }: { name: IconName; size?: number; weight?: number } & Omit<SVGProps<SVGSVGElement>, "stroke">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="square" aria-hidden="true" focusable="false" {...rest} dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
  );
}
