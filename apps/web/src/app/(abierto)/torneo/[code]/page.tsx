import { PrizeList } from "@/components/Prizes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { Empty, Status, TopBar } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { CATEGORY, DECK_LABEL, PACE_LABEL, formatLabel } from "@/lib/game";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { RANK_NAMES } from "@/lib/ranks";
import { describeRestrictions } from "@/lib/restrictions";
import { loadRegs, loadRounds, loadTournamentByCode, regName, standings } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { EnrollActions } from "./EnrollActions";
import { PushNudge } from "@/components/Push";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const t = await loadTournamentByCode((await params).code);
  return { title: t?.name ?? "Torneo" };
}

const TABS = [["info", "Info"], ["jugadores", "Jugadores"], ["rondas", "Rondas"], ["tabla", "Tabla"]] as const;

export default async function Torneo({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ pestana?: string; ronda?: string; vista?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const t = await loadTournamentByCode(code);
  if (!t) notFound();
  const me = await getMe();
  const [regs, { rounds, matches }] = await Promise.all([loadRegs(t.id), loadRounds(t.id)]);
  const supabase = await supabaseServer();
  const isStaff = me ? ((await supabase.rpc("is_staff", { t: t.id, uid: me.id })).data as boolean) : false;
  // Vista previa del staff: así lo ve un jugador que todavía no se inscribe.
  const preview = isStaff && sp.vista === "jugador";
  const q = preview ? "&vista=jugador" : "";
  const tab = TABS.some(([k]) => k === sp.pestana) ? sp.pestana! : t.status === "running" ? "rondas" : "info";
  const byId = new Map(regs.map((r) => [r.id, r]));
  const mine = me && !preview ? regs.find((r) => r.user_id === me.id && r.status !== "removed") : undefined;
  const taken = regs.filter((r) => r.status === "registered" || r.status === "checked_in").length;
  const cat = CATEGORY[t.category]!;
  const rest = describeRestrictions(t.restrictions);
  const effPolicy = t.deck_policy === "libre" && rest.length ? "por_ronda" : t.deck_policy;
  const myMatch = mine ? matches.filter((m) => m.a === mine.id || m.b === mine.id).at(-1) : undefined;
  // Torneo terminado: la tabla muestra primero el resultado final (incluye el top cut).
  const { data: finals } = t.status === "finished" && tab === "tabla"
    ? await supabase.from("results").select("registration_id,placement,wins,losses,draws").eq("tournament_id", t.id).order("placement")
    : { data: null };

  return (
    <main className="screen">
      <LiveRefresh channel={`torneo-${t.id}`} watch={[{ table: "tournaments", filter: `id=eq.${t.id}` }, { table: "matches", filter: `tournament_id=eq.${t.id}` }, { table: "registrations", filter: `tournament_id=eq.${t.id}` }]} />
      {preview && (
        <div className="banner warn" role="status">
          <Icon name="eye" size={18} /><span className="grow">Vista previa: así lo ve un jugador antes de inscribirse.</span>
        </div>
      )}
      <TopBar title="" back={preview ? `/staff/torneo/${t.id}/vista-previa` : "/torneos"} right={isStaff && !preview ? <Link href={`/staff/torneo/${t.id}`} className="btn g sm"><Icon name="gear" size={18} />Panel</Link> : undefined} />
      <div className="row wrap" style={{ gap: 6 }}>
        <span className={`pill ${cat.pill}`}>{cat.label}</span>
        <span className="pill o">{cat.pr}</span>
        {t.invite_only && <span className="pill o">Solo con invitación</span>}
        <span className="pill o">{PACE_LABEL[t.pace.kind]}</span>
        {t.status === "running" && <span className="pill l">En curso · R{t.current_round}</span>}
        {t.status === "finished" && <span className="pill o">Terminado</span>}
        {t.status === "cancelled" && <span className="pill e">Cancelado</span>}
      </div>
      <h1 className="t1">{t.name}</h1>
      <span className="sm">{t.club ? `${t.club} · ` : ""}{fmtDateTime(t.starts_at)} · <span className="mono">{t.code}</span></span>

      <nav className="seg" aria-label="Secciones del torneo">
        {TABS.map(([k, l]) => <Link key={k} href={`/torneo/${t.code}?pestana=${k}${q}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>

      {t.announcement && (
        <div className="box card n4 row sm edge-c" style={{ color: "var(--ink)", alignItems: "flex-start" }}>
          <Icon name="megaphone" size={18} /><span>{t.announcement}</span>
        </div>
      )}

      {tab === "info" && (
        <div className="col" style={{ gap: 6 }}>
          {[
            ["Formato", formatLabel(t)],
            ["Ritmo", t.pace.kind === "ventana" ? `Por ventana · ${t.pace.windowHours} h por ronda` : t.pace.kind === "jornadas" ? `${t.pace.sessions?.length ?? 0} jornadas` : `En vivo · check-in ${t.checkin_minutes} min antes`],
            ["Regla de mazo", DECK_LABEL[effPolicy]],
            ["Restricciones", rest.length ? rest.join(". ") : "Ninguna"],
            ["Rango mínimo", t.min_rank ? RANK_NAMES[t.min_rank] : "Ninguno"],
            ["Cupo", `${taken} / ${t.capacity}`],
          ].map(([k, v]) => (
            <div key={k} className="row between sm" style={{ alignItems: "flex-start", gap: 16 }}>
              <span>{k}</span><b style={{ color: "var(--ink)", textAlign: "right" }}>{v}</b>
            </div>
          ))}
          {t.pace.kind === "jornadas" && (
            <div className="col" style={{ marginTop: 8 }}>
              <span className="lbl">Jornadas</span>
              {t.pace.sessions?.map((s, i) => <span key={i} className="sm">{fmtDateTime(s.startsAt)} · rondas {s.rounds.join(", ")}</span>)}
            </div>
          )}
          {t.notes && <p className="sm" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{t.notes}</p>}
          <div style={{ marginTop: 10 }}><PrizeList list={t.prize_list ?? []} note={t.prizes} /></div>
        </div>
      )}

      {tab === "jugadores" && (
        <div className="list">
          {regs.filter((r) => r.status !== "removed").map((r) => (
            <div key={r.id} className="li n4">
              <Identicon seed={r.user_id ?? r.id} size={32} />
              <span className="grow"><span className="ttl">{regName(r)}</span>{!r.user_id && <span className="xs">Invitado</span>}</span>
              {r.status === "checked_in" && t.status === "registration" && <Status tone="ok" icon="check">Listo</Status>}
              {r.status === "waitlist" && <span className="xs">En espera</span>}
              {r.status === "dropped" && <span className="xs">Se retiró</span>}
              {r.status === "no_show" && <span className="xs">No se presentó</span>}
            </div>
          ))}
          {regs.length === 0 && <p className="sm">Aún no hay inscritos.</p>}
        </div>
      )}

      {tab === "rondas" && (() => {
        if (!rounds.length) return <Empty icon="clock" title="Todavía no hay rondas"><p className="sm">El emparejamiento sale cuando empieza el torneo.</p></Empty>;
        const selected = rounds.find((r) => String(r.number) === sp.ronda) ?? rounds.at(-1)!;
        const list = matches.filter((m) => m.round_id === selected.id);
        return (
          <>
            <div className="chips">
              {rounds.map((r) => (
                <Link key={r.id} href={`/torneo/${t.code}?pestana=rondas&ronda=${r.number}${q}`} className="chip o" aria-current={r.id === selected.id ? "page" : undefined}>
                  {r.stage === "top" ? `Top R${r.number}` : `R${r.number}`}
                </Link>
              ))}
            </div>
            {selected.ends_at && selected.status !== "closed" && <span className="sm">{t.pace.kind === "ventana" ? "Cierra" : "Termina"} {t.pace.kind === "ventana" ? fmtDateTime(selected.ends_at) : `a las ${fmtTime(selected.ends_at)}`}</span>}
            <div className="list">
              {list.map((m) => {
                const mineRow = mine && (m.a === mine.id || m.b === mine.id);
                const res = m.status === "confirmed" ? (m.b === null ? "Bye" : m.double_loss ? "Derrota doble" : `${m.games_a}-${m.games_b}`) : null;
                return (
                  <Link key={m.id} href={mineRow || (isStaff && !preview) ? `/mesa/${m.id}` : "#"} className="li n4" style={mineRow ? { boxShadow: "inset 0 0 0 2px var(--lime)" } : undefined}>
                    <span className="px20" style={{ width: 28, fontSize: 22 }}>{m.table_no}</span>
                    <span className="grow">
                      <span className="ttl">{regName(byId.get(m.a))}</span>
                      <span className="xs">{m.b ? `vs ${regName(byId.get(m.b))}` : "Bye"}</span>
                    </span>
                    {res ? <span className="mono ok nw">{res}</span> : <MatchState s={m.status} />}
                  </Link>
                );
              })}
            </div>
          </>
        );
      })()}

      {tab === "tabla" && (() => {
        const rows = standings(t, regs, rounds, matches);
        if (!rows.length || !matches.length) return <Empty icon="chart" title="La tabla sale con la primera ronda" />;
        return (
          <>
            {finals && finals.length > 0 && (
              <>
                <span className="lbl" style={{ fontSize: 16 }}>Resultado final</span>
                <table className="tbl">
                  <thead><tr><th>Lugar</th><th>Jugador</th><th className="r">G-P-E</th></tr></thead>
                  <tbody>
                    {finals.map((f) => (
                      <tr key={f.registration_id} className={mine?.id === f.registration_id ? "me" : ""}>
                        <td className="mono">{f.placement}</td>
                        <td style={{ fontWeight: 700 }}>{regName(byId.get(f.registration_id))}</td>
                        <td className="r mono nw">{f.wins}-{f.losses}-{f.draws}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <span className="lbl" style={{ fontSize: 16, marginTop: 8 }}>Tabla del suizo</span>
              </>
            )}
            <span className="xs">Después de la ronda {rounds.filter((r) => r.stage === "swiss" && r.status === "closed").length || t.current_round} · desempates OMW%, OOMW%, GW%</span>
            <table className="tbl">
              <thead><tr><th>#</th><th>Jugador</th><th className="r">Pts</th><th className="r">G-P-E</th><th className="r">OMW</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.playerId} className={mine?.id === s.playerId ? "me" : ""}>
                    <td className="mono">{s.rank}</td>
                    <td style={{ fontWeight: 700 }}>{regName(byId.get(s.playerId))}{s.dropped && <span className="xs"> · retirado</span>}</td>
                    <td className="r mono">{s.matchPoints}</td>
                    <td className="r mono nw">{s.wins}-{s.losses}-{s.draws}</td>
                    <td className="r mono">{Math.round(s.omwp * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      })()}

      <p className="xs" style={{ color: "var(--ink-3)" }}>
        Torneo organizado por {t.club ? `${t.club}` : "su organizador"}, no por Reta. Reta y este torneo no están afiliados, patrocinados ni aprobados por The Pokémon Company ni Nintendo. Los premios los entrega quien organiza. <Link href="/legal/terminos" className="cyan">Términos</Link>
      </p>

      {!preview && mine && ["registered", "checked_in", "waitlist"].includes(mine.status) && ["registration", "running"].includes(t.status) && <PushNudge />}

      <div className="stick-bottom col" style={{ gap: 10, marginTop: "auto" }}>
        {preview ? (
          <>
            <button className="btn p" disabled>Inscribirme</button>
            <span className="xs" style={{ textAlign: "center" }}>Botón de muestra. Los jugadores lo usan para inscribirse{t.status === "draft" ? " cuando publiques el torneo" : ""}.</span>
          </>
        ) : <EnrollActions
          t={{ id: t.id, code: t.code, name: t.name, status: t.status, starts_at: t.starts_at, checkin_minutes: t.checkin_minutes, pace: t.pace.kind, policy: effPolicy, rules: rest, format: formatLabel(t), category: cat.pr, inviteOnly: t.invite_only }}
          me={me ? { id: me.id } : null}
          reg={mine ? { status: mine.status, checked_in_at: mine.checked_in_at } : null}
          matchId={myMatch?.id}
        />}
      </div>
    </main>
  );
}

function MatchState({ s }: { s: string }) {
  if (s === "playing") return <span className="xs cyan">Jugando</span>;
  if (s === "reported") return <span className="xs warn">Por confirmar</span>;
  if (s === "disputed") return <span className="xs err">Disputa</span>;
  if (s === "scheduled") return <span className="xs cyan">Agendada</span>;
  return <span className="xs">Por jugar</span>;
}
