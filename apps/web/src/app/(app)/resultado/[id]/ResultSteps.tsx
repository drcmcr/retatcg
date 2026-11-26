"use client";
import Link from "next/link";
import { useState } from "react";
import { HunterCard, type CardData } from "@/components/HunterCard";
import { Medal } from "@/components/Medal";
import { CATEGORY, MEDAL_INFO, type MedalCode } from "@/lib/game";
import { fmtNum } from "@/lib/format";

type Props = {
  tournament: { name: string; code: string; top: number; category: string };
  result: { placement: number; wins: number; losses: number; draws: number; prDelta: number; newMedals: string[]; players: number };
  breakdown: { wins?: number; losses?: number; draws?: number; unplayed?: number; rondasSinJugar?: number; placementBonus?: number; multiplier?: number; eligible?: boolean; reason?: string };
  pr: { before: number; now: number };
  rank: { beforeName: string; nowName: string; up: boolean };
  card: CardData;
};

export function ResultSteps(p: Props) {
  const hasThird = p.rank.up || p.result.newMedals.length > 0;
  const total = hasThird ? 3 : 2;
  const [step, setStep] = useState(1);
  const r = p.result;
  return (
    <div className="chk" style={{ minHeight: "100dvh", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="steps" aria-label={`Tarjeta ${step} de ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? "on" : ""} />)}</div>
      {step === 1 && (
        <div className="panel n6 col fade-in" style={{ flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8 }}>
          <span className="lbl">{p.tournament.name}</span>
          <span className="px20 lime" style={{ fontSize: 120, lineHeight: 0.85 }}>{r.placement}<span style={{ fontFamily: "var(--f-ui)", fontSize: ".42em", fontWeight: 800, verticalAlign: ".95em" }}>.º</span></span>
          <b className="t2">{r.placement === 1 ? "¡Campeón!" : p.tournament.top && r.placement <= p.tournament.top ? `Top ${p.tournament.top}` : `De ${r.players} jugadores`}</b>
          <span className="mono" style={{ fontSize: 22 }}>{r.wins}-{r.losses}-{r.draws}</span>
        </div>
      )}
      {step === 2 && (
        <div className="panel n6 col fade-in" style={{ flex: 1, justifyContent: "center", gap: 10 }}>
          <span className="lbl">Tus PR</span>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <span className="mono muted">{fmtNum(p.pr.before)} →</span>
            <span className="mono lime" style={{ fontSize: 40, fontWeight: 700 }}>{fmtNum(p.pr.now)}</span>
          </div>
          {p.breakdown.eligible ? (
            <div className="col sm" style={{ gap: 4 }}>
              <Line l={`Victorias × ${r.wins}`} v={p.breakdown.wins ?? 0} />
              <Line l={`Derrotas × ${r.losses}`} v={p.breakdown.losses ?? 0} />
              {r.draws > 0 && <Line l={`Empates × ${r.draws}`} v={p.breakdown.draws ?? 0} />}
              {(p.breakdown.unplayed ?? 0) < 0 && <Line l={`Rondas sin jugar × ${p.breakdown.rondasSinJugar ?? 0} (dejaste el torneo)`} v={p.breakdown.unplayed!} />}
              {(p.breakdown.placementBonus ?? 0) > 0 && <Line l="Bono por lugar" v={p.breakdown.placementBonus!} />}
              <div className="sep" />
              <Line l={`${CATEGORY[p.tournament.category]?.label} ×${p.breakdown.multiplier}`} v={r.prDelta} strong />
            </div>
          ) : (
            <span className="sm">Este torneo no dio PR: {p.breakdown.reason ?? "no cumple los requisitos"}.</span>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="panel n6 col fade-in" style={{ flex: 1, justifyContent: "center", gap: 12, textAlign: "center" }}>
          <span className="px20 lime" style={{ fontSize: 40, lineHeight: 1 }}>{p.rank.up ? "¡A la caza!" : "¡Medalla nueva!"}</span>
          {p.rank.up && <span className="sm">Subiste a {p.rank.nowName}</span>}
          <div style={{ textAlign: "left" }}><HunterCard d={p.card} /></div>
          {r.newMedals.map((m) => (
            <div key={m} className="box n4 row" style={{ textAlign: "left" }}>
              <Medal code={m as MedalCode} size={44} state="new" />
              <div className="col" style={{ gap: 0 }}><b className="px lime" style={{ fontSize: 20 }}>Medalla {MEDAL_INFO[m as MedalCode].name}</b><span className="xs">Desbloqueaste un título nuevo</span></div>
            </div>
          ))}
        </div>
      )}
      {step < total ? (
        <button className="btn p" onClick={() => setStep(step + 1)}>{step === 1 ? "Ver mis PR" : "Ver lo nuevo"}</button>
      ) : (
        <>
          <Link href="/perfil/compartir" className="btn p">Compartir mi tarjeta</Link>
          {r.newMedals.length > 0 && <Link href="/perfil/titulos" className="btn s">Usar título</Link>}
          <Link href={`/torneo/${p.tournament.code}?pestana=tabla`} className="btn g">Ver la tabla final</Link>
        </>
      )}
    </div>
  );
}

function Line({ l, v, strong }: { l: string; v: number; strong?: boolean }) {
  return <div className="row between"><span className="mono" style={strong ? { color: "var(--lime)" } : undefined}>{l}</span><b className="mono" style={{ color: strong ? "var(--lime)" : "var(--ink)" }}>{v >= 0 ? "+" : ""}{v}</b></div>;
}
