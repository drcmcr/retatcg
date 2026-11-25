// Ícono de jugador: se genera del ID interno de la cuenta (nunca del usuario).
// Cuadrícula de 5×5 en espejo, 6 a 11 de 15 celdas, un color plano sobre #121218. Sin degradado ni foil.
const COLORS = ["#AAFF01", "#01EEFE", "#9A78FF"];

function hash(s: string): number {
  let a = 0x811c9dc5;
  for (const c of s) {
    a ^= c.charCodeAt(0);
    a = Math.imul(a, 16777619) >>> 0;
  }
  a ^= a >>> 13;
  a = Math.imul(a, 0x5bd1e995) >>> 0;
  a ^= a >>> 15;
  return a >>> 0;
}

export function identicon(seed: string): { path: string; color: string } {
  for (let salt = 0; salt < 20; salt++) {
    const v = hash(`${seed}#${salt}`);
    const on: number[] = [];
    let n = 0;
    for (let i = 0; i < 15; i++) {
      const b = (v >>> i) & 1;
      on.push(b);
      n += b;
    }
    if (n < 6 || n > 11) continue;
    let d = "";
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 5; y++) {
        if (!on[x * 5 + y]) continue;
        d += `M${x + 1} ${y + 1}h1v1h-1z`;
        if (x < 2) d += `M${5 - x} ${y + 1}h1v1h-1z`;
      }
    }
    return { path: d, color: COLORS[(v >>> 15) % 3]! };
  }
  return { path: "M1 1h5v5h-5z", color: COLORS[0]! };
}

export function Identicon({ seed, size = 40 }: { seed: string | null | undefined; size?: number }) {
  const { path, color } = identicon(seed ?? "invitado");
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" style={{ flex: "none", display: "block" }}>
      <rect width="7" height="7" fill="#121218" />
      <path fill={color} d={path} />
    </svg>
  );
}
