import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CATEGORY, PACE_LABEL, formatLabel } from "@/lib/game";
import { fmtDateTime } from "@/lib/format";

export type TCard = {
  code: string; name: string; club: string | null; category: string; status: string; starts_at: string;
  pace: { kind: string; windowHours?: number }; format: string; swiss_rounds: number; top_cut: number; swiss_best_of: number; top_best_of: number;
  capacity: number; taken: number; min_rank: number; current_round: number; prize_list?: unknown[];
};

const STATUS: Record<string, string> = { registration: "Inscripción abierta", running: "En curso", finished: "Terminado", cancelled: "Cancelado", pending_approval: "Esperando aprobación", draft: "Borrador" };

export function TournamentCard({ t, locked }: { t: TCard; locked?: string }) {
  const cat = CATEGORY[t.category]!;
  const pct = Math.min(100, Math.round((t.taken / t.capacity) * 100));
  return (
    <Link href={`/torneo/${t.code}`} className="box n4 col" style={{ gap: 8, color: "inherit", textDecoration: "none", opacity: locked ? 0.62 : 1 }}>
      <div className="row between">
        <span className="row" style={{ gap: 6 }}>
          <span className={`pill ${cat.pill}`}>{cat.label}</span>
          {!!t.prize_list?.length && <span className="pill o"><Icon name="gift" size={14} />Premios</span>}
        </span>
        <span className="xs nw">{t.status === "registration" ? cat.pr : STATUS[t.status]}</span>
      </div>
      <b style={{ fontSize: 18, lineHeight: 1.2 }}>{t.name}</b>
      <span className="xs">{t.club ? `${t.club} · ` : ""}{t.status === "running" ? `Ronda ${t.current_round}` : fmtDateTime(t.starts_at)} · {PACE_LABEL[t.pace.kind]}</span>
      <div className="row between xs">
        <span>{formatLabel(t)}</span>
        <span className="mono nw">{t.taken} / {t.capacity}</span>
      </div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {locked && <span className="xs row" style={{ gap: 6 }}><Icon name="lock" size={15} />{locked}</span>}
    </Link>
  );
}
