import { MEDAL_D } from "@/lib/brand-paths";
import { MEDAL_ART, MEDAL_INFO, MEDALS, type MedalCode } from "@/lib/game";

/** Medalla: azulejo foil con muesca pixel y el ícono a escala entera. */
export function Medal({ code, size = 48, state = "on" }: { code: MedalCode; size?: number; state?: "on" | "off" | "new" }) {
  const art = MEDAL_ART[code];
  const px = Math.max(16, Math.round((size * 0.66) / 16) * 16);
  const cls = size >= 64 ? "n6" : "n4";
  const tile = (
    <span
      className={`medal ${cls} ${state === "off" ? "off" : ""}`}
      role="img"
      aria-label={`${MEDAL_INFO[code].name}${state === "off" ? ", pendiente" : ""}`}
      style={{ width: size, height: size, background: art.grad }}
    >
      <svg width={px} height={px} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d={MEDAL_D[art.icon]} />
      </svg>
    </span>
  );
  if (state !== "new") return tile;
  return (
    <span className={`medal-new ${cls}`}>
      <span className={cls}>{tile}</span>
    </span>
  );
}

export function MedalRow({ owned, size = 26 }: { owned: readonly string[]; size?: number }) {
  return (
    <div className="row" style={{ gap: 5 }}>
      {MEDALS.map((m) => (
        <Medal key={m} code={m} size={size} state={owned.includes(m) ? "on" : "off"} />
      ))}
    </div>
  );
}
