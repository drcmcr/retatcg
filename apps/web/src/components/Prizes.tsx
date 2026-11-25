// Premios de un torneo, agrupados por lugar. Los entrega el organizador, no Reta.
import { Icon } from "@/components/Icon";
import { PRIZE_KIND, PRIZE_PLACE_LABEL, sortPrizes, type Prize } from "@/lib/game";

export function PrizeList({ list, note }: { list: Prize[]; note?: string | null }) {
  if (!list.length && !note) return null;
  const sorted = sortPrizes(list);
  return (
    <section className="box n4 col" style={{ gap: 10 }} aria-labelledby="premios">
      <div className="row" style={{ gap: 8 }}><Icon name="gift" size={20} className="lime" /><span id="premios" className="lbl">Premios</span></div>
      {sorted.length > 0 && (
        <ul className="plain col" style={{ gap: 8 }}>
          {sorted.map((p, i) => {
            const k = PRIZE_KIND[p.kind] ?? PRIZE_KIND.otro!;
            return (
              <li key={i} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="lp-ico n4" style={{ width: 40, height: 40 }} aria-hidden="true"><Icon name={k.icon} size={20} /></span>
                <span className="col grow" style={{ gap: 2 }}>
                  <span className="xs">{PRIZE_PLACE_LABEL[p.place] ?? p.place} · {k.label}</span>
                  <b style={{ color: "var(--ink)" }}>{p.detail}</b>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="sm" style={{ whiteSpace: "pre-wrap" }}>{note}</p>}
      <p className="xs">Los premios los entrega el organizador del torneo. Reta no participa en su entrega.</p>
    </section>
  );
}
