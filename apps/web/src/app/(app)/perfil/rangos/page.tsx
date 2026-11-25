import { TopBar, Prog } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { RANK_FINISH, rankFromPR } from "@/lib/game";
import { daysUntil, fmtNum } from "@/lib/format";
import { RANKS, PR_PER_RANK, LEGEND_THRESHOLD } from "@reta/torneo";

export const metadata = { title: "Rangos" };

export default async function Rangos() {
  const me = await requireMe("/perfil/rangos");
  const r = rankFromPR(me.pr);
  const ladder = [...RANKS.map((n, i) => ({ n, from: i * PR_PER_RANK })), { n: "Leyenda", from: LEGEND_THRESHOLD }].reverse();
  return (
    <main className="screen">
      <TopBar title="Rangos" back="/perfil" />
      <div className="box n4 col" style={{ gap: 6 }}>
        <div className="row between"><b>{r.name} {r.division}</b><span className="mono lime">{fmtNum(me.pr)} PR</span></div>
        <Prog filled={Math.round((r.progress / 100) * 20)} />
        <span className="xs">{r.toNext === null ? "Estás en Leyenda." : `${r.progress} / 100 PR en esta división · ${r.toNext} PR para subir`}</span>
      </div>
      <div className="list">
        {ladder.map((x) => {
          const current = x.n === r.name;
          return (
            <div key={x.n} className="row" style={{ gap: 10, padding: "6px 0" }}>
              <span className="n4" style={{ width: 28, height: 28, background: RANK_FINISH[x.n], flex: "none" }} aria-hidden="true" />
              <span className="grow" style={{ fontWeight: current ? 800 : 500 }}>{x.n}</span>
              <span className="mono xs">{x.n === "Leyenda" ? "1,800+ · top 100" : `${fmtNum(x.from)} PR`}</span>
              {current && <span className="pill l">Tú</span>}
            </div>
          );
        })}
      </div>
      <div className="box card n4 sm">
        Cada rango tiene tres divisiones de 100 PR (III, II, I). Puedes bajar de división, pero nunca del rango más alto que alcanzaste en la temporada.
        {me.season && ` La temporada cierra en ${daysUntil(me.season.endsAt)} días: al cerrar bajas un rango.`}
      </div>
    </main>
  );
}
