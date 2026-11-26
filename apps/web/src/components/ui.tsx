import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

export function TopBar({ title, back, right }: { title?: string; back?: string | false; right?: ReactNode }) {
  return (
    <div className="tb">
      {back !== false && (
        <Link href={back ?? "/"} className="ib" aria-label="Volver">
          <Icon name="back" />
        </Link>
      )}
      {title ? <h1>{title}</h1> : <span className="grow" />}
      {right}
    </div>
  );
}

export function Prog({ filled, of = 20 }: { filled: number; of?: number }) {
  return (
    <div className="prog" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
    </div>
  );
}

export function Steps({ n, of }: { n: number; of: number }) {
  return (
    <div className="steps" role="img" aria-label={`Paso ${n} de ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </div>
  );
}

/** Estado siempre con ícono y texto. */
export function Status({ tone, icon, children }: { tone: "ok" | "warn" | "err" | "cyan" | "muted"; icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <span className={`row ${tone}`} style={{ gap: 6, fontWeight: 700, fontSize: 14 }}>
      <Icon name={icon} size={16} weight={2.5} />
      {children}
    </span>
  );
}

export function Empty({ icon, title, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode }) {
  return (
    <div className="chk n6" style={{ padding: 18 }}>
      <div className="panel n4 col" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
        <Icon name={icon} size={28} />
        <b className="t2">{title}</b>
        {children}
      </div>
    </div>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="k n4 grow">
      <b className={tone}>{value}</b>
      <span>{label}</span>
    </div>
  );
}
