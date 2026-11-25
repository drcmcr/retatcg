import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown, LiveRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { requireMe } from "@/lib/auth";
import { fmtDateTime, ordinal } from "@/lib/format";
import { rankFromPR } from "@/lib/game";
import { loadRegs, loadRounds, loadTournament, regName, standings } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { MesaClient } from "./MesaClient";

export const metadata = { title: "Mi mesa" };

export default async function Mesa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe(`/mesa/${id}`);
  const supabase = await supabaseServer();
  const { data: m } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const t = (await loadTournament(m.tournament_id))!;
  const [regs, { rounds, matches }] = await Promise.all([loadRegs(t.id), loadRounds(t.id)]);
  const round = rounds.find((r) => r.id === m.round_id)!;
  const byId = new Map(regs.map((r) => [r.id, r]));
  const mineReg = regs.find((r) => r.user_id === me.id && (r.id === m.a || r.id === m.b));
  const isStaff = !mineReg && ((await supabase.rpc("is_staff", { t: t.id, uid: me.id })).data as boolean);
  if (!mineReg && !isStaff) notFound();
  const side: "a" | "b" = mineReg?.id === m.b ? "b" : "a";
  const rivalReg = byId.get((side === "a" ? m.b : m.a) ?? "");
  const totalRounds = t.format === "single_elim" ? null : t.swiss_rounds;
  const watch = [
    { table: "matches", filter: `id=eq.${m.id}` },
    { table: "match_secrets", filter: `match_id=eq.${m.id}` },
    { table: "match_events", filter: `match_id=eq.${m.id}` },
    { table: "rounds", filter: `tournament_id=eq.${t.id}` },
    { table: "availability", filter: `match_id=eq.${m.id}` },
  ];

  // Bye
  if (m.b === null) {
    return (
      <main className="screen">
        <LiveRefresh channel={`mesa-${m.id}`} watch={watch} />
        <Header title={`Ronda ${round.number} · Bye`} ends={round.status !== "closed" ? round.ends_at : null} />
        <div className="chk n6" style={{ padding: 18, flex: 1, display: "grid", placeItems: "center" }}>
          <div className="panel n4 col" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
            <span className="px20 lime" style={{ fontSize: 96, lineHeight: 0.9 }}>BYE</span>
            <b className="t2">Esta ronda no juegas</b>
            <span className="pill l">+3 puntos</span>
            <span className="sm">Cuenta como victoria. Te avisamos cuando salga la siguiente ronda.</span>
          </div>
        </div>
        <Link href={`/torneo/${t.code}?pestana=tabla`} className="btn g">Ver la tabla</Link>
      </main>
    );
  }

  // Resultado confirmado: esperar la siguiente ronda.
  if (m.status === "confirmed" && mineReg) {
    const won = m.winner === mineReg.id;
    const draw = !m.winner && !m.double_loss;
    const mine = side === "a" ? m.games_a : m.games_b;
    const theirs = side === "a" ? m.games_b : m.games_a;
    const rows = round.stage === "swiss" ? standings(t, regs, rounds, matches) : [];
    const me1 = rows.find((r) => r.playerId === mineReg.id);
    const left = matches.filter((x) => x.round_id === round.id && x.status !== "confirmed").length;
    const total = matches.filter((x) => x.round_id === round.id).length;
    const next = t.current_round > round.number ? matches.find((x) => rounds.find((r) => r.id === x.round_id)?.number === t.current_round && (x.a === mineReg.id || x.b === mineReg.id)) : undefined;
    return (
      <main className="screen">
        <LiveRefresh channel={`mesa-${m.id}`} watch={[...watch, { table: "matches", filter: `tournament_id=eq.${t.id}` }]} />
        <Header title={`Ronda ${round.number} terminada`} />
        <div className={`box n4 row between ${won ? "edge-l" : ""}`}>
          <div className="col" style={{ gap: 2 }}>
            <b>{m.double_loss ? "Derrota doble" : draw ? `Empate con ${regName(rivalReg)}` : won ? `Ganaste a ${regName(rivalReg)}` : `Perdiste con ${regName(rivalReg)}`}</b>
            <span className="xs">Mesa {m.table_no} · {m.confirmed_how === "auto" ? "confirmado automáticamente" : m.confirmed_how === "juez" ? "decisión del juez" : m.confirmed_how === "plazo" ? "por plazo vencido" : "confirmado"}</span>
          </div>
          <span className="px20" style={{ fontSize: 40 }}>{mine}-{theirs}</span>
        </div>
        {me1 && (
          <div className="row" style={{ gap: 10 }}>
            <div className="k n4 grow"><b>{ordinal(me1.rank)}</b><span>Lugar provisional</span></div>
            <div className="k n4 grow"><b className="lime">{me1.matchPoints}</b><span>Puntos</span></div>
          </div>
        )}
        {next ? (
          <Link href={`/mesa/${next.id}`} className="btn p"><Icon name="play" size={20} />Ir a la ronda {t.current_round}</Link>
        ) : t.status === "finished" ? (
          <Link href={`/resultado/${t.id}`} className="btn p">Ver mi resultado final</Link>
        ) : (
          <>
            <div className="row between sm"><span>Mesas que faltan</span><b style={{ color: "var(--ink)" }}>{left} de {total}</b></div>
            <div className="bar" aria-hidden="true"><i style={{ width: `${total ? ((total - left) / total) * 100 : 0}%` }} /></div>
            <p className="sm">La siguiente ronda se empareja cuando terminen todas las mesas. Te avisamos y te llevamos directo a tu mesa nueva.</p>
          </>
        )}
        <Link href={`/torneo/${t.code}?pestana=tabla`} className="btn g">Ver la tabla</Link>
      </main>
    );
  }

  // Mesa activa
  const [{ data: priv }, { data: secret }, { data: events }, { data: avail }, { data: cases }] = await Promise.all([
    supabase.rpc("table_private", { p_match: m.id }),
    supabase.from("match_secrets").select("password,generation").eq("match_id", m.id).maybeSingle(),
    supabase.from("match_events").select("id,at,actor,kind,data").eq("match_id", m.id).order("at", { ascending: false }).limit(30),
    supabase.from("availability").select("user_id,slots").eq("match_id", m.id),
    supabase.from("cases").select("id,status").eq("match_id", m.id).neq("status", "resolved").order("id", { ascending: false }).limit(1),
  ]);
  const privRows = (priv ?? []) as { registration_id: string; username: string; pocket_name: string | null; friend_id: string | null }[];
  const rivalPriv = privRows.find((p) => p.registration_id === rivalReg?.id);
  const { data: rivalSeason } = rivalReg?.user_id
    ? await supabase.from("player_seasons").select("pr").eq("user_id", rivalReg.user_id).eq("season_id", t.season_id ?? 1).maybeSingle()
    : { data: null };
  const rivalRank = rankFromPR(rivalSeason?.pr ?? 0);
  const rivalRecord = (() => {
    let w = 0, l = 0, d = 0;
    for (const x of matches) {
      if (x.status !== "confirmed" || !rivalReg || (x.a !== rivalReg.id && x.b !== rivalReg.id) || x.round_id === m.round_id) continue;
      if (x.winner === rivalReg.id) w++; else if (x.winner || x.double_loss) l++; else d++;
    }
    return `${w}-${l}-${d}`;
  })();

  return (
    <main className="screen">
      <LiveRefresh channel={`mesa-${m.id}`} watch={watch} />
      <Header
        title={`Ronda ${round.number}${totalRounds && round.stage === "swiss" ? ` de ${totalRounds}` : round.stage === "top" ? " · Top" : ""} · Mesa ${m.table_no}`}
        ends={round.status === "paused" ? null : round.ends_at}
        paused={round.status === "paused" ? round.paused_remaining : null}
        window={t.pace.kind === "ventana"}
      />
      {isStaff && <div className="banner warn n4">Vista del staff: {regName(byId.get(m.a))} vs {regName(byId.get(m.b))}</div>}
      <div className="box n4 col" style={{ gap: 10 }}>
        <div className="row">
          <Identicon seed={rivalReg?.user_id ?? rivalReg?.id} size={44} />
          <div className="grow col" style={{ gap: 0 }}>
            <b style={{ fontSize: 18 }}>{regName(rivalReg)}</b>
            <span className="xs">{rivalReg?.user_id ? `${rivalRank.name} ${rivalRank.division}` : "Invitado"} · {rivalRecord}</span>
          </div>
        </div>
      </div>
      <MesaClient
        match={{ id: m.id, status: m.status, side, table: m.table_no, gamesA: m.games_a, gamesB: m.games_b, draws: m.game_draws, reportedBy: m.reported_by, myReg: mineReg?.id ?? null, scheduledAt: m.scheduled_at, proposedAt: m.proposed_at, proposedBy: m.proposed_by, aCheckin: m.a_checkin_at, bCheckin: m.b_checkin_at }}
        round={{ number: round.number, bestOf: round.best_of, stage: round.stage, endsAt: round.ends_at, extension: m.extension_hours }}
        pace={t.pace.kind}
        rival={{ name: regName(rivalReg), pocket: rivalPriv?.pocket_name ?? null, friendId: rivalPriv?.friend_id ?? null, userId: rivalReg?.user_id ?? null }}
        password={secret?.password ?? null}
        events={(events ?? []).map((e) => ({ id: e.id as number, at: e.at as string, mine: e.actor === me.id, kind: e.kind as string, text: (e.data as { texto?: string })?.texto ?? null }))}
        availability={{ mine: (avail ?? []).find((a) => a.user_id === me.id)?.slots ?? [], theirs: (avail ?? []).find((a) => a.user_id !== me.id)?.slots ?? [] }}
        openCase={cases?.[0]?.id ?? null}
        readOnly={isStaff}
        confirmMinutes={t.confirm_minutes ?? (t.pace.kind === "ventana" ? 60 : 5)}
      />
      <p className="xs" style={{ textAlign: "center" }}>{t.name} · {fmtDateTime(round.started_at)}</p>
    </main>
  );
}

function Header({ title, ends, paused, window }: { title: string; ends?: string | null; paused?: string | null; window?: boolean }) {
  return (
    <div className="tb">
      <Link href="/inicio" className="ib" aria-label="Volver"><Icon name="back" /></Link>
      <h1 style={{ fontSize: 22 }}>{title}</h1>
      {window && ends ? <span className="xs warn nw">Cierra {fmtDateTime(ends)}</span>
        : (ends || paused) && <span className="row lime" style={{ gap: 4 }}><Icon name="clock" size={18} />{paused ? <span className="mono warn">Pausa</span> : <Countdown to={ends!} className="mono" />}</span>}
    </div>
  );
}
