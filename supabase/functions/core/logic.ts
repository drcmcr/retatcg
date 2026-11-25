// Reta · lógica del servidor que necesita el motor del torneo.
// Corre en la función "core" de Supabase (Deno) y en las pruebas locales (Node), siempre con conexión directa a Postgres.
// Las reglas viven en packages/torneo; aquí solo se leen datos, se llama al motor y se guardan resultados.
import * as E from "./engine.js";

// deno-lint-ignore no-explicit-any
type Sql = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export class UserError extends Error {}

const HOUR = 3_600_000;
const MIN = 60_000;

// ───────────── Lectura ─────────────

async function loadTournament(sql: Sql, id: string, lock = false): Promise<Row> {
  const [t] = lock
    ? await sql`select * from public.tournaments where id = ${id} for update`
    : await sql`select * from public.tournaments where id = ${id}`;
  if (!t) throw new UserError("No encontramos ese torneo.");
  return t;
}

async function isStaff(sql: Sql, tournamentId: string, uid: string): Promise<boolean> {
  const [r] = await sql`select public.is_staff(${tournamentId}::uuid, ${uid}::uuid) as ok`;
  return !!r?.ok;
}

/** Resultados confirmados del torneo en el formato del motor. */
async function engineMatches(sql: Sql, tournamentId: string, stage?: "swiss" | "top"): Promise<{ records: E.MatchRecord[]; rows: Row[] }> {
  const rows: Row[] = await sql`
    select m.*, r.number as round_number, r.stage
    from public.matches m join public.rounds r on r.id = m.round_id
    where m.tournament_id = ${tournamentId} and m.status = 'confirmed'
      ${stage ? sql`and r.stage = ${stage}` : sql``}
    order by r.number, m.table_no`;
  const records = rows.map((m) => ({
    round: m.round_number,
    a: m.a,
    b: m.b,
    gamesA: m.games_a,
    gamesB: m.games_b,
    gameDraws: m.game_draws,
    doubleLoss: m.double_loss,
  }));
  return { records, rows };
}

async function players(sql: Sql, tournamentId: string): Promise<Row[]> {
  return sql`
    select r.*, p.username from public.registrations r left join public.profiles p on p.id = r.user_id
    where r.tournament_id = ${tournamentId} and r.status in ('checked_in', 'dropped')
      and (r.status = 'checked_in' or exists (select 1 from public.matches m where r.id in (m.a, m.b)))
    order by r.created_at`;
}

function label(reg: Row | undefined): string {
  return reg?.username ?? reg?.guest_name ?? "Jugador";
}

// ───────────── Rondas ─────────────

function roundMinutes(t: Row, bestOf: number): number {
  return t.round_minutes ?? (bestOf === 3 ? E.TIMING.round.bo3 : E.TIMING.round.bo1);
}

/** Cuándo termina la ronda: reloj en vivo, jornada o plazo por ventana. */
function roundClock(t: Row, number: number, bestOf: number, now: number): { startsAt: number; endsAt: number } {
  const pace = t.pace as { kind: string; windowHours?: number; sessions?: { startsAt: string; rounds: number[] }[] };
  if (pace.kind === "ventana") return { startsAt: now, endsAt: now + (pace.windowHours ?? E.WINDOW.defaultHours) * HOUR };
  if (pace.kind === "jornadas") {
    const session = pace.sessions?.find((s) => s.rounds.includes(number));
    const sessionStart = session ? Date.parse(session.startsAt) : now;
    const startsAt = Math.max(now, sessionStart);
    return { startsAt, endsAt: startsAt + roundMinutes(t, bestOf) * MIN };
  }
  return { startsAt: now, endsAt: now + roundMinutes(t, bestOf) * MIN };
}

async function createRound(sql: Sql, t: Row, number: number, stage: "swiss" | "top", pairings: E.Pairing[], seed: string, regs: Map<string, Row>) {
  const bestOf = stage === "top" ? t.top_best_of : t.swiss_best_of;
  const clock = roundClock(t, number, bestOf, Date.now());
  const [round] = await sql`
    insert into public.rounds (tournament_id, number, stage, best_of, seed, started_at, ends_at)
    values (${t.id}, ${number}, ${stage}, ${bestOf}, ${seed}, ${new Date(clock.startsAt)}, ${new Date(clock.endsAt)})
    returning *`;
  for (const p of pairings) {
    const bye = p.b === null;
    const [m] = await sql`
      insert into public.matches (tournament_id, round_id, table_no, a, b, status, games_a, games_b, winner, confirmed_at, confirmed_how)
      values (${t.id}, ${round.id}, ${p.table}, ${p.a}, ${p.b}, ${bye ? "confirmed" : "pending"},
              ${bye ? Math.ceil(bestOf / 2) : 0}, 0, ${bye ? p.a : null}, ${bye ? new Date() : null}, ${bye ? "bye" : null})
      returning id`;
    if (!bye) await sql`insert into public.match_secrets (match_id, password) values (${m.id}, public._gen_password())`;
    const a = regs.get(p.a);
    const b = p.b ? regs.get(p.b) : undefined;
    const title = bye ? `Ronda ${number}: bye` : `Ronda ${number}: Mesa ${p.table} contra ${label(b)}`;
    const body = bye ? "Esta ronda no juegas: sumas la victoria." : t.name;
    await sql`select public._notify(${a?.user_id ?? null}::uuid, 'ronda', ${title}, ${body}, ${"/mesa/" + m.id})`;
    if (b) await sql`select public._notify(${b.user_id ?? null}::uuid, 'ronda', ${`Ronda ${number}: Mesa ${p.table} contra ${label(a)}`}, ${body}, ${"/mesa/" + m.id})`;
  }
  await sql`update public.tournaments set current_round = ${number}, stage = ${stage} where id = ${t.id}`;
  return round;
}

async function audit(sql: Sql, tournamentId: string, actor: string | null, action: string, detail: Row = {}) {
  await sql`insert into public.audit_log (tournament_id, actor, action, detail) values (${tournamentId}, ${actor}, ${action}, ${sql.json(detail)})`;
}

// ───────────── Acciones ─────────────

/** Empieza el torneo: quedan los que hicieron check-in y sale la ronda 1. */
export async function startTournament(sql: Sql, tournamentId: string, actor: string | null) {
  return sql.begin(async (tx: Sql) => {
    const t = await loadTournament(tx, tournamentId, true);
    if (actor && !(await isStaff(tx, tournamentId, actor))) throw new UserError("Solo el staff del torneo puede empezarlo.");
    if (t.status !== "registration") throw new UserError("El torneo no está en inscripción.");
    // Por ventana no hay check-in en vivo: la inscripción basta.
    if (t.pace?.kind === "ventana") {
      await tx`update public.registrations set status = 'checked_in', checked_in_at = now()
               where tournament_id = ${tournamentId} and status = 'registered'`;
    }
    await tx`update public.registrations set status = 'removed'
             where tournament_id = ${tournamentId} and status in ('registered', 'waitlist')`;
    await tx`update public.registrations r set rank_at_start = public._rank_index(public._user_pr(r.user_id))
             where tournament_id = ${tournamentId} and status = 'checked_in'`;
    const regs = await players(tx, tournamentId);
    if (regs.length < 2) throw new UserError("Se necesitan al menos 2 jugadores con check-in.");
    const byId = new Map<string, Row>(regs.map((r) => [r.id, r]));
    const seed = `${t.lot_seed}:1`;
    let pairings: E.Pairing[];
    let stage: "swiss" | "top";
    if (t.format === "single_elim") {
      const order = E.shuffle(regs.map((r) => r.id as string), E.seededRandom(seed));
      pairings = E.firstEliminationRound(order);
      stage = "top";
    } else {
      pairings = E.pairSwissRound({ players: regs.map((r) => ({ id: r.id })), matches: [], seed }).pairings;
      stage = "swiss";
    }
    await tx`update public.tournaments set status = 'running', started_at = now() where id = ${tournamentId}`;
    await createRound(tx, t, 1, stage, pairings, seed, byId);
    await audit(tx, tournamentId, actor, "Empezó el torneo", { jugadores: regs.length });
    return { round: 1, tables: pairings.length };
  });
}

/** Cierra la ronda actual y empareja la siguiente, pasa al top cut o termina el torneo. */
export async function nextRound(sql: Sql, tournamentId: string, actor: string | null) {
  return sql.begin(async (tx: Sql) => {
    const t = await loadTournament(tx, tournamentId, true);
    if (actor && !(await isStaff(tx, tournamentId, actor))) throw new UserError("Solo el staff del torneo puede emparejar.");
    if (t.status !== "running") throw new UserError("El torneo no está en curso.");
    const [round] = await tx`select * from public.rounds where tournament_id = ${tournamentId} and number = ${t.current_round}`;
    const [{ pending }] = await tx`select count(*)::int as pending from public.matches where round_id = ${round.id} and status <> 'confirmed'`;
    if (pending > 0) throw new UserError(`Faltan ${pending} mesas por confirmar.`);
    await tx`update public.rounds set status = 'closed', closed_at = now() where id = ${round.id}`;

    const regs = await players(tx, tournamentId);
    const byId = new Map<string, Row>(regs.map((r) => [r.id, r]));
    const number = t.current_round + 1;
    const seed = `${t.lot_seed}:${number}`;

    if (round.stage === "swiss") {
      const { records } = await engineMatches(tx, tournamentId, "swiss");
      const engPlayers = regs.map((r) => ({ id: r.id as string, dropped: r.status === "dropped" }));
      if (t.current_round < t.swiss_rounds) {
        const { pairings } = E.pairSwissRound({ players: engPlayers, matches: records, seed });
        await createRound(tx, t, number, "swiss", pairings, seed, byId);
        await audit(tx, tournamentId, actor, `Emparejó la ronda ${number}`, { mesas: pairings.length });
        return { round: number, stage: "swiss" };
      }
      if (t.format === "swiss_topcut" && t.top_cut >= 2) {
        const standings = E.computeStandings(engPlayers, records, { lotSeed: t.lot_seed });
        const top = standings.filter((s) => !s.dropped).slice(0, t.top_cut).map((s) => s.playerId);
        if (top.length >= 2) {
          const pairings = E.firstEliminationRound(top);
          await createRound(tx, t, number, "top", pairings, seed, byId);
          await audit(tx, tournamentId, actor, "Empezó el top cut", { jugadores: top.length });
          return { round: number, stage: "top" };
        }
      }
      return finalizeInTx(tx, t, actor);
    }

    // Eliminación: pasan los ganadores en el orden de sus mesas.
    const winners: string[] = (await tx`
      select winner from public.matches where round_id = ${round.id} order by table_no`).map((m: Row) => m.winner);
    if (winners.some((w) => !w)) throw new UserError("En eliminación cada mesa necesita un ganador.");
    if (winners.length === 1) return finalizeInTx(tx, t, actor);
    const pairings = E.nextEliminationRound(winners);
    await createRound(tx, t, number, "top", pairings, seed, byId);
    await audit(tx, tournamentId, actor, `Emparejó la ronda ${number}`, { mesas: pairings.length });
    return { round: number, stage: "top" };
  });
}

/** Posiciones finales: top cut por la ronda en que cayó cada quien, el resto por la tabla del suizo. */
function finalPlacements(t: Row, regs: Row[], swiss: E.Standing[] | null, topRows: Row[]): Map<string, number> {
  const out = new Map<string, number>();
  const swissRank = new Map<string, number>((swiss ?? []).map((s) => [s.playerId, s.rank]));
  if (topRows.length > 0) {
    const roundsInTop = [...new Set(topRows.map((m) => m.round_number))].sort((a, b) => a - b);
    const totalTopRounds = roundsInTop.length;
    const eliminatedIn = new Map<string, number | null>();
    for (const m of topRows) {
      const idx = roundsInTop.indexOf(m.round_number) + 1;
      for (const p of [m.a, m.b]) {
        if (!p) continue;
        if (!eliminatedIn.has(p)) eliminatedIn.set(p, null);
        if (m.winner && m.winner !== p) eliminatedIn.set(p, idx);
      }
    }
    const topPlayers = [...eliminatedIn.keys()].sort((x, y) => {
      const px = E.eliminationPlacement(totalTopRounds, eliminatedIn.get(x) ?? null).from;
      const py = E.eliminationPlacement(totalTopRounds, eliminatedIn.get(y) ?? null).from;
      return px - py || (swissRank.get(x) ?? 999) - (swissRank.get(y) ?? 999) || E.hashString(t.lot_seed + x) - E.hashString(t.lot_seed + y);
    });
    topPlayers.forEach((p, i) => out.set(p, i + 1));
  }
  const rest = (swiss ?? []).filter((s) => !out.has(s.playerId)).map((s) => s.playerId);
  for (const p of rest) out.set(p, out.size + 1);
  for (const r of regs) if (!out.has(r.id)) out.set(r.id, out.size + 1);
  return out;
}

/** Termina el torneo: posiciones, PR, medallas y títulos. Solo el servidor calcula esto. */
async function finalizeInTx(tx: Sql, t: Row, actor: string | null) {
  const regs = await players(tx, t.id);
  const all = await engineMatches(tx, t.id);
  const swissRecords = all.records.filter((_, i) => all.rows[i]!.stage === "swiss");
  const swiss = swissRecords.length > 0 || t.format !== "single_elim"
    ? E.computeStandings(regs.map((r) => ({ id: r.id, dropped: r.status === "dropped" })), swissRecords, { lotSeed: t.lot_seed })
    : null;
  const topRows = all.rows.filter((m) => m.stage === "top");
  const placement = finalPlacements(t, regs, swiss, topRows);
  const accountPlayers = regs.filter((r) => r.user_id).length;
  const season: number | null = t.season_id;
  const weekAgo = new Date(new Date(t.started_at ?? Date.now()).getTime() - 7 * 24 * HOUR);
  const finishedAt = new Date();

  for (const r of regs) {
    const mine = all.rows.filter((m) => m.a === r.id || m.b === r.id);
    let wins = 0, losses = 0, draws = 0;
    const winsAgainst: string[] = [];
    const seasonMatches: E.SeasonMatch[] = [];
    for (const m of mine) {
      const rivalReg = m.a === r.id ? m.b : m.a;
      const rival = rivalReg ? regs.find((x) => x.id === rivalReg) : undefined;
      let result: "win" | "loss" | "draw" | "bye";
      if (m.b === null) { wins++; result = "bye"; }
      else if (m.double_loss) { losses++; result = "loss"; }
      else if (m.winner === r.id) { wins++; result = "win"; winsAgainst.push(rival?.user_id ?? rivalReg); }
      else if (m.winner) { losses++; result = "loss"; }
      else { draws++; result = "draw"; }
      seasonMatches.push({
        at: new Date(m.confirmed_at ?? m.created_at).getTime(),
        result,
        ownRankIndex: r.rank_at_start ?? 0,
        opponentRankIndex: rival?.user_id ? rival.rank_at_start ?? 0 : null,
      });
    }
    const place = placement.get(r.id)!;
    let prDelta = 0;
    let breakdown: Row = {};
    let fresh: string[] = [];

    if (r.user_id && season !== null) {
      const prior: Row = {};
      const previous = await tx`
        select coalesce(rv.user_id::text, rv.id::text) as rival, count(*)::int as n
        from public.matches m
        join public.registrations me on me.id = m.winner and me.user_id = ${r.user_id}
        join public.registrations rv on rv.id = case when m.a = me.id then m.b else m.a end
        where m.tournament_id <> ${t.id} and m.status = 'confirmed' and m.confirmed_at >= ${weekAgo}
        group by 1`;
      for (const p of previous) prior[p.rival] = p.n;
      const countable = E.countableWins(winsAgainst, prior) + mine.filter((m) => m.b === null).length;
      const pr = E.tournamentPR({ category: t.category, accountPlayers, wins: countable, losses, draws, placement: place });
      breakdown = { ...pr, victoriasContadas: countable };
      const [ps] = await tx`
        insert into public.player_seasons (season_id, user_id) values (${season}, ${r.user_id})
        on conflict (season_id, user_id) do update set season_id = excluded.season_id returning *`;
      if (pr.eligible) {
        const next = E.applyPRDelta(ps.pr, pr.total, ps.highest_rank);
        prDelta = next - ps.pr;
        const rank = E.rankFromPR(next).index;
        await tx`update public.player_seasons set pr = ${next}, highest_rank = greatest(highest_rank, ${rank})
                 where season_id = ${season} and user_id = ${r.user_id}`;
      }
      // Medallas con todo el historial elegible de la temporada, incluido este torneo.
      const history: E.SeasonTournament[] = await seasonHistory(tx, r.user_id, season, t.id);
      history.push({
        category: t.category,
        accountPlayers,
        placement: place,
        swissRounds: swiss ? mine.filter((m) => m.stage === "swiss").length : null,
        swissLosses: swiss ? mine.filter((m) => m.stage === "swiss" && (m.double_loss || (m.winner && m.winner !== r.id))).length : null,
        matches: seasonMatches,
      });
      fresh = E.newMedals(ps.medals ?? [], history);
      if (fresh.length) {
        await tx`update public.player_seasons set medals = array(select distinct unnest(medals || ${fresh}::text[]))
                 where season_id = ${season} and user_id = ${r.user_id}`;
        for (const medal of fresh) {
          await tx`insert into public.titles (user_id, medal, season_id) values (${r.user_id}, ${medal}, ${season}) on conflict do nothing`;
        }
      }
    }
    await tx`
      insert into public.results (registration_id, tournament_id, user_id, placement, wins, losses, draws, pr_delta, pr_breakdown, new_medals, created_at)
      values (${r.id}, ${t.id}, ${r.user_id}, ${place}, ${wins}, ${losses}, ${draws}, ${prDelta}, ${tx.json(breakdown)}, ${fresh}, ${finishedAt})
      on conflict (registration_id) do update set placement = excluded.placement, wins = excluded.wins, losses = excluded.losses,
        draws = excluded.draws, pr_delta = excluded.pr_delta, pr_breakdown = excluded.pr_breakdown, new_medals = excluded.new_medals`;
    if (r.user_id) {
      const medalText = fresh.length ? ` · Medalla ${fresh.map((m) => E.MEDAL_INFO[m as E.MedalCode].name).join(", ")}` : "";
      await tx`select public._notify(${r.user_id}::uuid, 'resultado', ${`Terminaste ${place}.º en ${t.name}`},
        ${`${prDelta >= 0 ? "+" : ""}${prDelta} PR${medalText}`}, ${"/resultado/" + t.id})`;
    }
  }
  const [last] = await tx`select id from public.rounds where tournament_id = ${t.id} and number = ${t.current_round}`;
  if (last) await tx`update public.rounds set status = 'closed', closed_at = coalesce(closed_at, now()) where id = ${last.id}`;
  await tx`update public.tournaments set status = 'finished', finished_at = now() where id = ${t.id}`;
  await audit(tx, t.id, actor, "Terminó el torneo", { jugadores: regs.length });
  return { finished: true };
}

/** Historial de la temporada para las medallas (torneos ya terminados, sin el actual). */
async function seasonHistory(tx: Sql, userId: string, season: number, exceptTournament: string): Promise<E.SeasonTournament[]> {
  const rows: Row[] = await tx`
    select res.tournament_id, res.placement, t.category, me.id as reg_id, me.rank_at_start,
      (select count(*)::int from public.registrations x where x.tournament_id = t.id and x.user_id is not null
         and x.status in ('checked_in', 'dropped')) as account_players
    from public.results res
    join public.tournaments t on t.id = res.tournament_id
    join public.registrations me on me.id = res.registration_id
    where res.user_id = ${userId} and t.season_id = ${season} and t.id <> ${exceptTournament}`;
  const out: E.SeasonTournament[] = [];
  for (const r of rows) {
    const ms: Row[] = await tx`
      select m.*, ro.stage, rv.rank_at_start as rival_rank, rv.user_id as rival_user
      from public.matches m join public.rounds ro on ro.id = m.round_id
      left join public.registrations rv on rv.id = case when m.a = ${r.reg_id} then m.b else m.a end
      where m.tournament_id = ${r.tournament_id} and ${r.reg_id} in (m.a, m.b) and m.status = 'confirmed'`;
    const swissMs = ms.filter((m) => m.stage === "swiss");
    out.push({
      category: r.category,
      accountPlayers: r.account_players,
      placement: r.placement,
      swissRounds: swissMs.length || null,
      swissLosses: swissMs.length ? swissMs.filter((m) => m.double_loss || (m.winner && m.winner !== r.reg_id)).length : null,
      matches: ms.map((m) => ({
        at: new Date(m.confirmed_at ?? m.created_at).getTime(),
        result: m.b === null ? "bye" : m.double_loss ? "loss" : m.winner === r.reg_id ? "win" : m.winner ? "loss" : "draw",
        ownRankIndex: r.rank_at_start ?? 0,
        opponentRankIndex: m.rival_user ? m.rival_rank ?? 0 : null,
      })),
    });
  }
  return out;
}

// ───────────── Ritmo por ventana: plazos ─────────────

async function windowActivity(tx: Sql, m: Row, regId: string): Promise<E.WindowActivity> {
  const [reg] = await tx`select user_id from public.registrations where id = ${regId}`;
  const uid = reg?.user_id;
  const [av] = uid ? await tx`select coalesce(array_length(slots, 1), 0) as n from public.availability where match_id = ${m.id} and user_id = ${uid}` : [];
  const [ev] = uid
    ? await tx`select count(*)::int as n from public.match_events where match_id = ${m.id} and actor = ${uid} and kind in ('propuesta', 'acordada')`
    : [{ n: 0 }];
  const checkin = regId === m.a ? m.a_checkin_at : m.b_checkin_at;
  const tolerance = E.WINDOW.tableTolerance * MIN;
  const onTime = !!checkin && (!m.scheduled_at || new Date(checkin).getTime() <= new Date(m.scheduled_at).getTime() + tolerance);
  return { markedAvailability: (av?.n ?? 0) > 0, proposedOrAccepted: (ev?.n ?? 0) > 0, checkedInAtAgreedTime: onTime };
}

/** Aplica el plazo vencido a las mesas de una ronda por ventana. */
async function resolveWindowRound(tx: Sql, t: Row, round: Row, now: number): Promise<number> {
  const open: Row[] = await tx`
    select * from public.matches where round_id = ${round.id} and status not in ('confirmed', 'disputed') for update`;
  let changed = 0;
  for (const m of open) {
    const deadline = new Date(round.ends_at).getTime() + m.extension_hours * HOUR;
    if (deadline > now || m.b === null) continue;
    const res = E.resolveAtDeadline({
      confirmed: false,
      disputeOpen: false,
      agreedTimeSet: !!m.scheduled_at,
      a: await windowActivity(tx, m, m.a),
      b: await windowActivity(tx, m, m.b),
    });
    const win = Math.ceil(round.best_of / 2);
    if (res === "victoria_a" || res === "victoria_b") {
      await tx`update public.matches set games_a = ${res === "victoria_a" ? win : 0}, games_b = ${res === "victoria_b" ? win : 0},
               game_draws = 0, double_loss = false where id = ${m.id}`;
      await tx`select public._confirm(${m.id}::uuid, 'plazo')`;
    } else if (res === "derrota_doble" && round.stage === "swiss") {
      await tx`update public.matches set games_a = 0, games_b = 0, game_draws = 0, double_loss = true where id = ${m.id}`;
      await tx`select public._confirm(${m.id}::uuid, 'plazo')`;
    } else {
      await tx`update public.matches set status = 'disputed' where id = ${m.id}`;
      await tx`insert into public.cases (tournament_id, match_id, kind) values (${t.id}, ${m.id}, 'plazo')`;
    }
    await tx`insert into public.match_events (match_id, kind, data) values (${m.id}, 'plazo vencido', ${tx.json({ resultado: res })})`;
    changed++;
  }
  return changed;
}

/** Tarea de cada minuto: torneos por ventana que deben empezar, plazos vencidos y rondas listas. */
export async function tick(sql: Sql, now = Date.now()) {
  const report: Row = { started: 0, resolved: 0, advanced: 0, errors: [] as string[] };
  const due: Row[] = await sql`
    select id from public.tournaments where status = 'registration' and pace->>'kind' = 'ventana' and starts_at <= ${new Date(now)}`;
  for (const t of due) {
    try { await startTournament(sql, t.id, null); report.started++; } catch (e) { report.errors.push(`${t.id}: ${(e as Error).message}`); }
  }
  const running: Row[] = await sql`select id from public.tournaments where status = 'running' and pace->>'kind' = 'ventana'`;
  for (const { id } of running) {
    try {
      const n = await sql.begin(async (tx: Sql) => {
        const t = await loadTournament(tx, id, true);
        const [round] = await tx`select * from public.rounds where tournament_id = ${id} and number = ${t.current_round}`;
        return round ? resolveWindowRound(tx, t, round, now) : 0;
      });
      report.resolved += n;
      const [{ pending }] = await sql`
        select count(*)::int as pending from public.matches m join public.tournaments t on t.id = m.tournament_id
        join public.rounds r on r.id = m.round_id and r.number = t.current_round
        where t.id = ${id} and m.status <> 'confirmed'`;
      if (pending === 0) { await nextRound(sql, id, null); report.advanced++; }
    } catch (e) {
      report.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  return report;
}

/** Cerrar la ronda antes del plazo (por ventana): solo si todas las mesas confirmaron. */
export async function closeRoundEarly(sql: Sql, tournamentId: string, actor: string) {
  return nextRound(sql, tournamentId, actor);
}
