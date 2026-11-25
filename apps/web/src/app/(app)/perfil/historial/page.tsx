import Link from "next/link";
import { Empty, TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { fmtDate, ordinal } from "@/lib/format";
import { history } from "@/lib/profile";

export const metadata = { title: "Historial" };

export default async function Historial() {
  const me = await requireMe("/perfil/historial");
  const h = await history(me.id);
  return (
    <main className="screen">
      <TopBar title="Historial" back="/perfil" />
      {!h.length ? <Empty icon="list" title="Aún no terminas ningún torneo"><Link href="/torneos" className="btn p">Ver torneos</Link></Empty> : (
        <div className="list">
          {h.map((r) => (
            <Link key={r.tournament_id} href={`/resultado/${r.tournament_id}`} className="li n4">
              <span className="px20" style={{ width: 46, fontSize: 24, color: r.placement === 1 ? "var(--lime)" : undefined }}>{ordinal(r.placement)}</span>
              <span className="grow"><span className="ttl">{r.name}</span><span className="xs">{fmtDate(r.created_at)} · {r.wins}-{r.losses}-{r.draws} · {r.players} jugadores</span></span>
              <span className={`mono nw ${r.pr_delta > 0 ? "lime" : ""}`}>{r.category === "casual" ? "Casual" : `${r.pr_delta >= 0 ? "+" : ""}${r.pr_delta} PR`}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
