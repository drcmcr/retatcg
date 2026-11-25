import { Identicon } from "@/components/Identicon";
import { Medal, MedalRow } from "@/components/Medal";
import { Prog } from "@/components/ui";
import { RANK_FINISH, rankFromPR, titleText, type MedalCode } from "@/lib/game";
import { fmtNum } from "@/lib/format";

export type CardData = {
  userId: string;
  username: string;
  pr: number;
  medals: string[];
  titleMedal: string | null;
  titleForm: string | null;
  season?: number;
  leaderboardPosition?: number;
};

/** Tarjeta de cazador: acabado por rango, PR, progreso, título y las 8 medallas. */
export function HunterCard({ d, showMedals = true }: { d: CardData; showMedals?: boolean }) {
  const r = rankFromPR(d.pr, d.leaderboardPosition);
  const title = titleText(d.titleMedal, d.titleForm);
  const next = r.toNext === null ? "Leyenda de la temporada" : r.name === "Maestro Cazador" && r.division === "I" ? `${r.toNext} PR para Leyenda` : `${r.progress} / 100 PR para la siguiente división`;
  return (
    <div className="hcard n6" style={{ background: RANK_FINISH[r.name] }}>
      <div className="hcard-in n6">
        <div className="row between">
          <span className="lbl" style={{ fontSize: 16 }}>Tarjeta de cazador</span>
          <span className="lbl" style={{ fontSize: 16 }}>T{d.season ?? 1}</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Identicon seed={d.userId} size={34} />
          <b style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{d.username}</b>
        </div>
        {title && (
          <div className="row" style={{ gap: 7 }}>
            <Medal code={d.titleMedal as MedalCode} size={22} />
            <span className="px lime" style={{ fontSize: 20 }}>{title}</span>
          </div>
        )}
        <div className="row between" style={{ alignItems: "baseline" }}>
          <span className="rank">{r.name} {r.division}</span>
          <span className="mono lime nw" style={{ fontWeight: 700 }}>{fmtNum(d.pr)} PR</span>
        </div>
        <Prog filled={Math.round((r.progress / 100) * 20)} />
        <span className="xs">{next}</span>
        {showMedals && (
          <>
            <span className="lbl" style={{ fontSize: 16 }}>Medallas · {d.medals.length} de 8</span>
            <MedalRow owned={d.medals} />
          </>
        )}
      </div>
    </div>
  );
}
