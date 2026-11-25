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
    const [t] = await sql`select current_round from public.tournaments where id = ${id}`;
    expect(t!.current_round).toBe(2);
  });
});
