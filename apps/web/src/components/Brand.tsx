import { useId } from "react";
import { ISO_D, WM_D } from "@/lib/brand-paths";

/** Isotipo con el degradado de marca y el brillo blanco, o plano de un color. */
export function Iso({ h = 40, flat }: { h?: number; flat?: string }) {
  const id = useId().replace(/:/g, "");
  const w = (h * 720) / 1575.29;
  if (flat) {
    return (
      <svg width={w} height={h} viewBox="0 0 720 1575.29" aria-hidden="true">
        <path fill={flat} d={ISO_D} />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} viewBox="0 0 720 1575.29" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#AAFF01" />
          <stop offset=".32" stopColor="#7DFF5A" />
          <stop offset=".55" stopColor="#01EEFE" />
          <stop offset=".8" stopColor="#5D46FF" />
          <stop offset="1" stopColor="#5820FF" />
        </linearGradient>
        <radialGradient id={`${id}b`} cx="0.12" cy="0.66" r="0.42">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path fill={`url(#${id}a)`} d={ISO_D} />
      <path fill={`url(#${id}b)`} d={ISO_D} />
    </svg>
  );
}

export function Wordmark({ h = 24, color = "#F4F4F5" }: { h?: number; color?: string }) {
  return (
    <svg width={(h * 2226.06) / 382.997} height={h} viewBox="0 0 2226.06 382.997" role="img" aria-label="Reta">
      <path fill={color} d={WM_D} />
    </svg>
  );
}

/** Isotipo y logotipo juntos, como en el moodboard. */
export function Logo({ h = 30 }: { h?: number }) {
  return (
    <span className="row" style={{ gap: Math.round(h * 0.35) }}>
      <Iso h={h * 1.25} />
      <Wordmark h={h * 0.62} />
    </span>
  );
}
