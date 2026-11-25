// Prueba de punta a punta contra un Postgres local con las migraciones aplicadas.
// Crea una base limpia, juega torneos completos y revisa reglas, permisos y resultados.
import postgres from "postgres";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nextRound, startTournament, tick } from "../functions/core/logic";

const HOST = process.env.PGHOST ?? "/tmp";
const PORT = process.env.PGPORT ?? "54329";
const DB = "reta_test";
const root = join(__dirname, "..");

let sql: postgres.Sql;

function psql(args: string) {
  execSync(`psql -h ${HOST} -p ${PORT} -U postgres -v ON_ERROR_STOP=1 -q ${args}`, { stdio: "pipe" });
}

beforeAll(() => {
  psql(`-d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"`);
  psql(`-d ${DB} -f ${join(root, "tests/00_supabase_stub.sql")}`);
  for (const f of readdirSync(join(root, "migrations")).sort()) psql(`-d ${DB} -f ${join(root, "migrations", f)}`);
  sql = postgres({ host: HOST, port: Number(PORT), user: "postgres", database: DB, onnotice: () => {} });
});
afterAll(async () => { await sql?.end(); });

/** Ejecuta como un usuario con sesión (rol authenticated y RLS activo). */
async function as<T>(uid: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${uid}, true), set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

async function newUser(name: string, birth = "1995-05-14"): Promise<string> {
  const [u] = await sql`insert into auth.users (email) values (${name + "@prueba.mx"}) returning id`;
  await as(u!.id, (tx) => tx`select public.complete_onboarding(${name}, ${birth}::date, ${name.slice(0, 12)}, '4821093755126604', 'America/Mexico_City')`);
  return u!.id;
}

async function playRound(tournamentId: string, pick: (a: string, b: string) => "a" | "b") {
  const [t] = await sql`select * from public.tournaments where id = ${tournamentId}`;
  const ms = await sql`
    select m.*, ra.user_id as ua, rb.user_id as ub, r.best_of from public.matches m
    join public.rounds r on r.id = m.round_id and r.number = ${t!.current_round}
    join public.registrations ra on ra.id = m.a left join public.registrations rb on rb.id = m.b
    where m.tournament_id = ${tournamentId} and m.status <> 'confirmed'`;
  for (const m of ms) {
    const win = Math.ceil(m.best_of / 2);
    const aWins = pick(m.ua, m.ub) === "a";
    await as(m.ua, (tx) => tx`select public.report_result(${m.id}, ${aWins ? win : 0}, ${aWins ? 0 : win}, 0)`);
    await as(m.ub, (tx) => tx`select public.confirm_result(${m.id})`);
  }
}

describe("cuentas", () => {
  it("rechaza a menores de 18 y no guarda nada", async () => {
    const [u] = await sql`insert into auth.users (email) values ('menor@prueba.mx') returning id`;
    await expect(as(u!.id, (tx) => tx`select public.complete_onboarding('menor', '2010-01-01', 'Menor', '1234567890123456')`))
      .rejects.toThrow(/mayores de 18/);
    await as(u!.id, (tx) => tx`select public.delete_minor_account()`);
    const left = await sql`select 1 from auth.users where id = ${u!.id}`;
    expect(left.length).toBe(0);
  });

  it("filtra usuarios ofensivos y repetidos", async () => {
    await newUser("kairo_mx");
    const [u] = await sql`insert into auth.users (email) values ('otro@prueba.mx') returning id`;
    await expect(as(u!.id, (tx) => tx`select public.complete_onboarding('KAIRO_MX', '1990-01-01', 'X', '1234567890123456')`)).rejects.toThrow(/ocupado/);
    await expect(as(u!.id, (tx) => tx`select public.complete_onboarding('puto123', '1990-01-01', 'X', '1234567890123456')`)).rejects.toThrow(/3 a 16/);
  });

  it("los datos privados solo los ve su dueño", async () => {
    const a = await newUser("priv_a");
    await newUser("priv_b");
    const rows = await as(a, (tx) => tx`select user_id from public.profile_private`);
    expect(rows.map((r) => r.user_id)).toEqual([a]);
  });
});

describe("torneo en vivo: suizo + top 4", () => {
  let org: string;
  let tid: string;
  const players: string[] = [];

  it("juega de la inscripción a los resultados", async () => {
    org = await newUser("bets");
    await sql`insert into public.platform_roles (user_id, role) values (${org}, 'superadmin')`;
    for (let i = 0; i < 9; i++) players.push(await newUser(`jugador${i}`));

    tid = (await as(org, (tx) => tx`select public.create_tournament(${sql.json({
      name: "Copa Nocturna", category: "comunitario", format: "swiss_topcut", swiss_rounds: 3, top_cut: 4,
      swiss_best_of: 1, top_best_of: 3, starts_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })}) as id`))[0]!.id;
    expect(await as(org, (tx) => tx`select public.publish_tournament(${tid}) as s`)).toEqual([{ s: "registration" }]);

    for (const p of players) {
      await as(p, (tx) => tx`select public.register(${tid})`);
      await as(p, (tx) => tx`select public.checkin(${tid})`);
    }
    // Un jugador no puede empezar el torneo.
    await expect(startTournament(sql, tid, players[0]!)).rejects.toThrow(/staff/);
    await startTournament(sql, tid, org);

    // 9 jugadores: 4 mesas y un bye ya confirmado.
    const r1 = await sql`select * from public.matches where tournament_id = ${tid}`;
    expect(r1.length).toBe(5);
    expect(r1.filter((m) => m.b === null && m.status === "confirmed").length).toBe(1);

    // La contraseña solo la ven los dos jugadores de la mesa.
    const m1 = r1.find((m) => m.b !== null)!;
    const [ra] = await sql`select user_id from public.registrations where id = ${m1.a}`;
    expect((await as(ra!.user_id, (tx) => tx`select password from public.match_secrets where match_id = ${m1.id}`)).length).toBe(1);
    const others = await sql`select user_id from public.registrations where tournament_id = ${tid} and id not in (${m1.a}, ${m1.b})`;
    expect((await as(others[0]!.user_id, (tx) => tx`select password from public.match_secrets where match_id = ${m1.id}`)).length).toBe(0);

    // No se empareja con mesas pendientes.
    await expect(nextRound(sql, tid, org)).rejects.toThrow(/Faltan/);

    const strength = (u: string) => players.indexOf(u);
    for (let round = 0; round < 3; round++) {
      await playRound(tid, (a, b) => (strength(a) < strength(b) ? "a" : "b"));
      await nextRound(sql, tid, org);
    }
    const [t] = await sql`select * from public.tournaments where id = ${tid}`;
    expect(t!.stage).toBe("top");
    // Top 4: semifinal y final.
    await playRound(tid, (a, b) => (strength(a) < strength(b) ? "a" : "b"));
    await nextRound(sql, tid, org);
    await playRound(tid, (a, b) => (strength(a) < strength(b) ? "a" : "b"));
    await nextRound(sql, tid, org);

    const [done] = await sql`select status from public.tournaments where id = ${tid}`;
    expect(done!.status).toBe("finished");
    const results = await sql`select r.*, p.username from public.results r join public.profiles p on p.id = r.user_id where tournament_id = ${tid} order by placement`;
    expect(results.map((r) => r.placement)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results[0]!.username).toBe("jugador0");
    expect(results[0]!.new_medals).toContain("astro");
    expect(results[0]!.new_medals).toContain("geoda");
    expect(results[0]!.pr_delta).toBeGreaterThan(0);
    const [ps] = await sql`select pr, medals from public.player_seasons where user_id = ${players[0]} and season_id = 1`;
    expect(ps!.pr).toBe(results[0]!.pr_delta);
    const titles = await sql`select medal from public.titles where user_id = ${players[0]}`;
    expect(titles.map((x) => x.medal)).toContain("astro");
  });

  it("disputa: reportes distintos abren un caso y el juez decide", async () => {
    const id = (await as(org, (tx) => tx`select public.create_tournament(${sql.json({
      name: "Reta rápida", category: "casual", format: "swiss", swiss_rounds: 1, starts_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })}) as id`))[0]!.id;
    await as(org, (tx) => tx`select public.publish_tournament(${id})`);
    for (const p of players.slice(0, 2)) {
      await as(p, (tx) => tx`select public.register(${id})`);
      await as(p, (tx) => tx`select public.checkin(${id})`);
    }
    await startTournament(sql, id, org);
    const [m] = await sql`select m.*, ra.user_id ua, rb.user_id ub from public.matches m
      join public.registrations ra on ra.id = m.a join public.registrations rb on rb.id = m.b where m.tournament_id = ${id}`;
    await as(m!.ua, (tx) => tx`select public.report_result(${m!.id}, 1, 0, 0)`);
    const [r] = await as(m!.ub, (tx) => tx`select public.report_result(${m!.id}, 1, 0, 0) as s`);
    expect(r!.s).toBe("disputed");
    const [c] = await sql`select * from public.cases where match_id = ${m!.id}`;
    expect(c!.kind).toBe("marcador");
    await expect(as(org, (tx) => tx`select public.resolve_case(${c!.id}, 'x')`)).rejects.toThrow(/resultado/);
    await as(org, (tx) => tx`select public.staff_set_result(${m!.id}, 1, 0, 0, false, 'Captura del juego 1')`);
    await as(org, (tx) => tx`select public.resolve_case(${c!.id}, 'Gana con la captura')`);
    await nextRound(sql, id, org);
    const [t] = await sql`select status from public.tournaments where id = ${id}`;
    expect(t!.status).toBe("finished");
    // Casual: no da PR.
    const res = await sql`select pr_delta from public.results where tournament_id = ${id}`;
    expect(res.every((x) => x.pr_delta === 0)).toBe(true);
  });
});

describe("torneo por ventana", () => {
  it("empieza solo, aplica el plazo y avanza", async () => {
    const org = (await sql`select id from public.profiles where username = 'bets'`)[0]!.id;
    const ps = (await sql`select id from public.profiles where username like 'jugador%' order by username limit 4`).map((r) => r.id);
    const id = (await as(org, (tx) => tx`select public.create_tournament(${sql.json({
      name: "Liga Valle", category: "comunitario", format: "swiss", swiss_rounds: 2,
      pace: { kind: "ventana", windowHours: 24 }, starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    })}) as id`))[0]!.id;
    await as(org, (tx) => tx`select public.publish_tournament(${id})`);
    for (const p of ps) await as(p, (tx) => tx`select public.register(${id})`);

    const later = Date.now() + 2 * 3_600_000;
    let rep = await tick(sql, later);
    expect(rep.started).toBe(1);
    const ms = await sql`select m.*, ra.user_id ua, rb.user_id ub from public.matches m
      join public.registrations ra on ra.id = m.a join public.registrations rb on rb.id = m.b where m.tournament_id = ${id} order by table_no`;
    // Mesa 1: solo A marcó disponibilidad → gana A al vencer el plazo. Mesa 2: nadie hizo nada → derrota doble.
    await as(ms[0]!.ua, (tx) => tx`select public.set_availability(${ms[0]!.id}, array[now() + interval '3 hours']::timestamptz[])`);
    rep = await tick(sql, later + 25 * 3_600_000);
    expect(rep.resolved).toBe(2);
    expect(rep.advanced).toBe(1);
    const after = await sql`select table_no, games_a, games_b, double_loss, confirmed_how from public.matches where id in ${sql([ms[0]!.id, ms[1]!.id])} order by table_no`;
    expect(after[0]).toMatchObject({ games_a: 1, games_b: 0, confirmed_how: "plazo" });
    expect(after[1]).toMatchObject({ double_loss: true, confirmed_how: "plazo" });
    // Quien no se presentó sale del torneo: solo queda A y el torneo termina.
    const regs = await sql`select user_id, status from public.registrations where tournament_id = ${id}`;
    expect(regs.filter((r) => r.status === "dropped").length).toBe(3);
    expect(regs.find((r) => r.user_id === ms[0]!.ua)!.status).toBe("checked_in");
    const [t] = await sql`select status from public.tournaments where id = ${id}`;
    expect(t!.status).toBe("finished");
  });
});

describe("asistencia", () => {
  async function liveTournament(org: string, name: string, capacity: number) {
    const id = (await as(org, (tx) => tx`select public.create_tournament(${sql.json({
      name, category: "casual", format: "swiss", swiss_rounds: 1, capacity,
      starts_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })}) as id`))[0]!.id as string;
    await as(org, (tx) => tx`select public.publish_tournament(${id})`);
    return id;
  }

  it("la falta cuenta, la lista de espera presente entra y el ausente de mesa sale", async () => {
    const org = (await sql`select id from public.profiles where username = 'bets'`)[0]!.id;
    const ps: string[] = [];
    for (let i = 0; i < 4; i++) ps.push(await newUser(`asis${i}`));
    const id = await liveTournament(org, "Copa Asistencia", 2);
    for (const p of ps) await as(p, (tx) => tx`select public.register(${id})`);
    const st = async () => Object.fromEntries((await sql`select user_id, status from public.registrations where tournament_id = ${id}`).map((r) => [r.user_id, r.status]));
    expect(Object.values(await st()).sort()).toEqual(["registered", "registered", "waitlist", "waitlist"]);

    await as(ps[0]!, (tx) => tx`select public.checkin(${id})`);
    expect((await as(ps[2]!, (tx) => tx`select public.checkin(${id}) as s`))[0]!.s).toBe("waitlist");
    await startTournament(sql, id, org);
    const s = await st();
    expect([s[ps[0]!], s[ps[1]!], s[ps[2]!], s[ps[3]!]]).toEqual(["checked_in", "no_show", "checked_in", "removed"]);
    const [n] = await sql`select title from public.notifications where user_id = ${ps[1]!} order by id desc limit 1`;
    expect(n!.title).toMatch(/No hiciste check-in/);

    // El juez marca que asis2 no se presentó: gana asis0 y asis2 sale del torneo.
    const [m] = await sql`select m.id, m.a, m.b from public.matches m where m.tournament_id = ${id}`;
    const [absent] = await sql`select id from public.registrations where tournament_id = ${id} and user_id = ${ps[2]!}`;
    await as(org, (tx) => tx`select public.staff_no_show(${m!.id}, ${absent!.id})`);
    expect((await st())[ps[2]!]).toBe("dropped");
    const [done] = await sql`select status, winner from public.matches where id = ${m!.id}`;
    expect(done!.status).toBe("confirmed");
    expect(done!.winner).not.toBe(absent!.id);

    // Segunda falta de asis1 en la temporada: 7 días sin inscribirse.
    const id2 = await liveTournament(org, "Copa Asistencia 2", 4);
    await as(ps[1]!, (tx) => tx`select public.register(${id2})`);
    await as(ps[0]!, (tx) => tx`select public.register(${id2})`);
    await as(ps[3]!, (tx) => tx`select public.register(${id2})`);
    await as(ps[0]!, (tx) => tx`select public.checkin(${id2})`);
    await as(ps[3]!, (tx) => tx`select public.checkin(${id2})`);
    await startTournament(sql, id2, org);
    const id3 = await liveTournament(org, "Copa Asistencia 3", 4);
    await expect(as(ps[1]!, (tx) => tx`select public.register(${id3})`)).rejects.toThrow(/suspendida/);

    // El staff ve las faltas de cada inscrito.
    const att = await as(org, (tx) => tx`select * from public.tournament_attendance(${id2})`);
    expect(att.find((r) => r.user_id === ps[1]!)!.no_shows).toBe(2);
  });

  it("recuerda 24 h antes y al abrir el check-in, una sola vez", async () => {
    const org = (await sql`select id from public.profiles where username = 'bets'`)[0]!.id;
    const p = await newUser("recordar1");
    const id = (await as(org, (tx) => tx`select public.create_tournament(${sql.json({
      name: "Copa Recordatorio", category: "casual", format: "swiss", swiss_rounds: 1,
      starts_at: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    })}) as id`))[0]!.id;
    await as(org, (tx) => tx`select public.publish_tournament(${id})`);
    await as(p, (tx) => tx`select public.register(${id})`);
    expect((await sql`select public._tournament_reminders() as n`)[0]!.n).toBeGreaterThanOrEqual(1);
    const [n] = await sql`select title from public.notifications where user_id = ${p} order by id desc limit 1`;
    expect(n!.title).toMatch(/^Hoy a las|^Mañana a las/);
    const before = (await sql`select count(*)::int c from public.notifications where user_id = ${p}`)[0]!.c;
    await sql`select public._tournament_reminders()`;
    expect((await sql`select count(*)::int c from public.notifications where user_id = ${p}`)[0]!.c).toBe(before);
    // Al abrir el check-in.
    await sql`update public.tournaments set starts_at = now() + interval '10 minutes' where id = ${id}`;
    await sql`select public._tournament_reminders()`;
    const [c] = await sql`select title from public.notifications where user_id = ${p} order by id desc limit 1`;
    expect(c!.title).toMatch(/Abrió el check-in/);
  });
});

describe("cuentas inactivas y métricas", () => {
  it("solo el superadmin ve métricas", async () => {
    const org = (await sql`select id from public.profiles where username = 'bets'`)[0]!.id;
    const m = (await as(org, (tx) => tx`select public.platform_metrics() as m`))[0]!.m;
    expect(m.perfiles).toBeGreaterThan(5);
    expect(m).toHaveProperty("asistencia.faltas");
    const p = (await sql`select id from public.profiles where username = 'jugador1'`)[0]!.id;
    await expect(as(p, (tx) => tx`select public.platform_metrics()`)).rejects.toThrow(/superadmin/);
  });

  it("borra registros sin terminar, avisa por inactividad y borra sin romper torneos", async () => {
    const [half] = await sql`insert into auth.users (email, created_at) values ('mitad@prueba.mx', now() - interval '10 days') returning id`;
    const old = await newUser("viejo1");
    const [reg] = await sql`select id from public.registrations limit 1`;
    await sql`update public.registrations set user_id = ${old}, created_at = now() - interval '14 months' where id = ${reg!.id}`;
    await sql`update public.profiles set created_at = now() - interval '14 months', last_seen_at = now() - interval '13 months' where id = ${old}`;
    let r = (await sql`select public._cleanup_accounts() as r`)[0]!.r;
    expect(r.sin_terminar).toBe(1);
    expect((await sql`select 1 from auth.users where id = ${half!.id}`).length).toBe(0);
    expect((await sql`select inactive_warned_at from public.profiles where id = ${old}`)[0]!.inactive_warned_at).not.toBeNull();
    // Si vuelve a entrar, se cancela el aviso.
    await as(old, (tx) => tx`select public.touch_seen()`);
    expect((await sql`select inactive_warned_at from public.profiles where id = ${old}`)[0]!.inactive_warned_at).toBeNull();
    // Si no vuelve en 30 días, se borra y su inscripción queda como "Jugador eliminado".
    await sql`update public.profiles set last_seen_at = now() - interval '14 months', inactive_warned_at = now() - interval '31 days' where id = ${old}`;
    r = (await sql`select public._cleanup_accounts() as r`)[0]!.r;
    expect(r.borradas).toBe(1);
    const [after] = await sql`select user_id, guest_name from public.registrations where id = ${reg!.id}`;
    expect(after).toMatchObject({ user_id: null, guest_name: "Jugador eliminado" });
  });
});
