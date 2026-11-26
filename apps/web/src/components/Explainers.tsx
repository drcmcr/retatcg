// Piezas que explican el sistema de juego. Las usan la portada y la guía; los números vienen del motor.
import { FINAL_INVITE_MEDALS, LEGEND, LEGEND_SLOTS, LEGEND_THRESHOLD, MEDAL_TITLES, PR_PER_RANK, PR_RULES, RANKS, titleLabel } from "@reta/torneo";
import { Icon, type IconName } from "@/components/Icon";
import { Medal } from "@/components/Medal";
import { MEDAL_INFO, MEDALS, RANK_FINISH } from "@/lib/game";

export { FINAL_INVITE_MEDALS, LEGEND_SLOTS, LEGEND_THRESHOLD, PR_RULES };

/** Escalera de rangos con el acabado de la tarjeta y el PR de cada uno. */
export function RankLadder() {
  const rows = [
    ...RANKS.map((name, i) => ({ name, pr: `${i * PR_PER_RANK}–${(i + 1) * PR_PER_RANK - 1} PR` })),
    { name: LEGEND, pr: `${LEGEND_THRESHOLD}+ · top ${LEGEND_SLOTS}` },
  ];
  return (
    <ol className="ladder plain" aria-label="Rangos de menor a mayor">
      {rows.map((r) => (
        <li key={r.name} className="n4">
          <span className="sw n4" style={{ background: RANK_FINISH[r.name] }} aria-hidden="true" />
          <span className="nm">{r.name}</span>
          <span className="pr">{r.pr}</span>
        </li>
      ))}
    </ol>
  );
}

/** Las 8 medallas: cómo se ganan y qué título desbloquean. */
export function MedalGrid({ titles = true }: { titles?: boolean }) {
  return (
    <ul className="medals plain">
      {MEDALS.map((m) => {
        const t = MEDAL_TITLES[m];
        const title = t.forms.length === 2 ? `${titleLabel(t, "a")} / ${titleLabel(t, "b")}` : titleLabel(t, "a");
        return (
          <li key={m} className="n4">
            <Medal code={m} size={52} />
            <div>
              <b>{MEDAL_INFO[m].name}</b>
              <span>{MEDAL_INFO[m].how}</span>
              {titles && <span className="lime" style={{ marginTop: 4 }}>Título: {title}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Cómo se calculan los PR de un torneo. */
export function PRTable() {
  const b = PR_RULES.placementBonus;
  const m = PR_RULES.multiplier;
  const rows: [string, string][] = [
    ["Victoria de encuentro", `+${PR_RULES.matchWin}`],
    ["Empate", `+${PR_RULES.matchDraw}`],
    ["Derrota", `${PR_RULES.matchLoss}`.replace("-", "−")],
    ["Ronda suiza sin jugar (si dejas el torneo)", `${PR_RULES.matchLoss}`.replace("-", "−")],
    ["Campeón", `+${b.first}`],
    ["Segundo lugar", `+${b.second}`],
    ["Top 4", `+${b.top4}`],
    ["Top 8", `+${b.top8}`],
  ];
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="kv box n4" style={{ padding: 0 }}>
        {rows.flatMap(([k, v]) => [<span key={k}>{k}</span>, <span key={k + "v"}>{v}</span>])}
      </div>
      <div className="chips" aria-label="Multiplicador por categoría">
        <span className="chip o">Casual · sin PR</span>
        <span className="chip o">Comunitario ×{m.comunitario}</span>
        <span className="chip o">Clasificatorio ×{m.clasificatorio}</span>
        <span className="chip o">Mayor ×{m.mayor}</span>
      </div>
    </div>
  );
}

export const APP_SECTIONS: { icon: IconName; name: string; text: string }[] = [
  { icon: "home", name: "Inicio", text: "Lo que te toca ahora: tu próxima ronda, check-ins abiertos y los torneos donde estás inscrito." },
  { icon: "trophy", name: "Torneos", text: "Busca torneos abiertos por categoría, revisa los tuyos y los pasados, o únete con un código." },
  { icon: "play", name: "Botón central", text: "Cambia según el momento: Unirse, Check-in, Mesa 4 o Coordinar. Siempre te lleva a lo urgente." },
  { icon: "users", name: "Comunidad", text: "El ranking de la temporada, jugadores que sigues y búsqueda de cazadores." },
  { icon: "user", name: "Perfil", text: "Tu tarjeta de cazador, medallas, títulos, historial, estadísticas y ajustes." },
  { icon: "bell", name: "Avisos", text: "La campana de Inicio junta emparejamientos, resultados, casos del juez y anuncios." },
];

export function SectionList() {
  return (
    <ul className="list plain">
      {APP_SECTIONS.map((s) => (
        <li key={s.name} className="li n4" style={{ alignItems: "flex-start" }}>
          <span className="lp-ico n4" aria-hidden="true"><Icon name={s.icon} size={22} /></span>
          <span className="grow"><span className="ttl">{s.name}</span><span className="sm">{s.text}</span></span>
        </li>
      ))}
    </ul>
  );
}

export const PACES: { icon: IconName; name: string; text: string }[] = [
  { icon: "zap", name: "En vivo", text: "Todos conectados a la vez, con reloj por ronda. Un torneo de tarde." },
  { icon: "cal", name: "Por jornadas", text: "Varias sesiones en días distintos. Cada jornada abre su check-in 30 minutos antes." },
  { icon: "clock", name: "Por ventana", text: "Cada ronda dura 24 o 48 horas. Coordinas con tu rival cuándo jugar dentro del plazo." },
];
