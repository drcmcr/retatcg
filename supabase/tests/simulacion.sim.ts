// Simulación de un torneo real de punta a punta (configuración del primer torneo de prueba).
// Base local aparte (reta_sim), usuarios y datos falsos. Cada acción la hace el usuario que
// corresponde, con su sesión (rol authenticated + RLS), y el motor es el mismo código de la
// función "core". Guarda una bitácora en SIM_LOG para revisarla después.
import postgres from "postgres";
import { execSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { nextRound, startTournament } from "../functions/core/logic";

const HOST = process.env.PGHOST ?? "/tmp";
const PORT = process.env.PGPORT ?? "54329";
const DB = "reta_sim";
const root = join(__dirname, "..");
const LOG = process.env.SIM_LOG ?? "/tmp/simulacion_local.json";

let sql: postgres.Sql;
const log: { t: string; paso: string; detalle?: unknown }[] = [];
const checks: { ok: boolean; prueba: string; detalle?: unknown }[] = [];
const errores: { paso: string; error: string }[] = [];
const step = (paso: string, detalle?: unknown) => log.push({ t: new Date().toISOString(), paso, detalle });
const check = (prueba: string, ok: boolean, detalle?: unknown) => checks.push({ ok, prueba, detalle });

// Generador pseudoaleatorio con semilla: la simulación se puede repetir igual.
let seed = 20261129;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function psql(args: string) { execSync(`psql -h ${HOST} -p ${PORT} -U postgres -v ON_ERROR_STOP=1 -q ${args}`, { stdio: "pipe" }); }

beforeAll(() => {
  psql(`-d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"`);
  psql(`-d ${DB} -f ${join(root, "tests/00_supabase_stub.sql")}`);
  for (const f of readdirSync(join(root, "migrations")).sort()) psql(`-d ${DB} -f ${join(root, "migrations", f)}`);
  sql = postgres({ host: HOST, port: Number(PORT), user: "postgres", database: DB, onnotice: () => {} });
});
afterAll(async () => {
  writeFileSync(LOG, JSON.stringify({ resumen: { pasos: log.length, pruebas: checks.length, fallidas: checks.filter((c) => !c.ok).length, errores: errores.length }, checks, errores, log }, null, 2));
  await sql?.end();
});

async function as<T>(uid: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${uid}, true), set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}
/** Igual que `as`, pero si falla lo anota y devuelve el mensaje (para casos que deben fallar). */
async function tryAs(uid: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<string | null> {
  try { await as(uid, fn); return null; } catch (e) { return (e as Error).message; }
}

const PLAYERS = [
  "kairo_mx", "lunaverde", "dr.voltio", "maremoto22", "tita.cards", "elchavo_tcg", "nebula.mx", "pancho_rayo",
  "brisa_gg", "zurdo.mx", "coral_tcg", "ixchel_07", "rex.bajio", "mictlan99", "sol.pocket", "toto_dragon",
  "neza_ace", "lalo.combo", "frida_tcg", "chilango.ex",
];
const fakeFriendId = () => Array.from({ length: 16 }, () => Math.floor(rnd() * 10)).join("");
const users = new Map<string, string>(); // username -> id
const skill = new Map<string, number>(); // id -> habilidad (para resultados creíbles)
const name = (id: string) => [...users].find(([, v]) => v === id)?.[0] ?? id;

async function newUser(username: string, birth: string) {
  const [u] = await sql`insert into auth.users (email) values (${username.replace(/\./g, "") + "@simulacion.invalid"}) returning id`;
  await as(u!.id, (tx) => tx`select public.complete_onboarding(${username}, ${birth}::date, ${username.slice(0, 12)}, ${fakeFriendId()}, 'America/Mexico_City')`);
  users.set(username, u!.id);
  return u!.id as string;
}

it("simula el torneo completo", { timeout: 300_000 }, async () => {
  // ───── 1. Cuentas ─────
  const admin = await newUser("admin_sim", "1990-03-02").catch(() => null);
  check("El filtro bloquea el usuario 'admin_sim' (reservado)", admin === null);
  const superadmin = await newUser("super.sim", "1988-01-20");
  await sql`insert into public.platform_roles (user_id, role) values (${superadmin}, 'superadmin')`;
  const org = await newUser("org_simulada", "1992-07-11");
  const judge = await newUser("arbitra_sim", "1994-10-05");
  step("Cuentas de staff creadas", { superadmin: "super.sim", organizador: "org_simulada", jueza: "arbitra_sim" });

  const [minor] = await sql`insert into auth.users (email) values ('menor@simulacion.invalid') returning id`;
  const minorErr = await tryAs(minor!.id, (tx) => tx`select public.complete_onboarding('menor_sim', '2011-05-05', 'Menor', ${fakeFriendId()})`);
  check("Rechaza registro de menor de 18", !!minorErr && /18/.test(minorErr), minorErr);
  const badErr = await tryAs(minor!.id, (tx) => tx`select public.complete_onboarding('pokemon_sim', '1995-05-05', 'X', ${fakeFriendId()})`);
  check("Rechaza usuario con marca (pokemon_sim)", !!badErr && /marcas/.test(badErr), badErr);

  for (const p of PLAYERS) {
    const y = 1985 + Math.floor(rnd() * 20);
    const id = await newUser(p, `${y}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`);
    skill.set(id, 0.3 + rnd() * 0.7);
  }
  step("20 jugadores creados con datos falsos (fecha de nacimiento, nombre en Pocket, ID de amigo)", PLAYERS);
  check("22 perfiles + superadmin en la base", (await sql`select count(*)::int n from public.profiles`)[0]!.n === PLAYERS.length + 3);

  // ───── 2. Organizador ─────
  await as(superadmin, (tx) => tx`select public.set_platform_role('org_simulada', 'organizer', true)`);
  const notOrg = await tryAs(users.get("kairo_mx")!, (tx) => tx`select public.create_tournament(${sql.json({ name: "Copa Pirata" })})`);
  check("Un jugador sin rol no puede crear torneos", !!notOrg, notOrg);

  // ───── 3. Torneo (configuración del domingo) ─────
  const config = {
    name: "Copa Simulada", club: "Retadores Sim", category: "comunitario", format: "swiss_topcut", swiss_rounds: 3, top_cut: 4,
    swiss_best_of: 1, top_best_of: 3, pace: { kind: "en_vivo" }, deck_policy: "libre", restrictions: {}, capacity: 16, checkin_minutes: 30,
    min_rank: 0, invite_only: true, starts_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    prize_list: [{ place: "1", kind: "carta", detail: "Intercambio garantizado de una repetida" }],
    prizes: "Por intercambio en el juego dentro de las 48 h siguientes al torneo",
    notes: "Torneo de prueba. Haz check-in entre 17:30 y 17:55 o pierdes tu lugar.",
  };
  const badName = await tryAs(org, (tx) => tx`select public.create_tournament(${sql.json({ ...config, name: "Regional Pokémon" })})`);
  check("El filtro rechaza 'Regional Pokémon' como nombre de torneo", !!badName && /marcas/.test(badName), badName);
  const [{ id: tid }] = await as(org, (tx) => tx`select public.create_tournament(${sql.json(config)}) as id`);
  await as(org, (tx) => tx`select public.publish_tournament(${tid})`);
  await as(org, (tx) => tx`select public.add_staff(${tid}, 'arbitra_sim', 'judge')`);
  const [t0] = await sql`select code, status, invite_only from public.tournaments where id = ${tid}`;
  step("Torneo creado y publicado", { codigo: t0!.code, ...config });
  check("Torneo publicado con inscripción abierta", t0!.status === "registration");
  const anonList = await sql.begin(async (tx) => { await tx`set local role anon`; return tx`select id from public.tournaments where id = ${tid}`; });
  check("Un visitante sin sesión puede ver el torneo con el código", anonList.length === 1);

  // ───── 4. Invitaciones personales e inscripción uno por uno ─────
  const invited = PLAYERS.slice(0, 14);
  await as(org, (tx) => tx`select public.create_invites(${tid}, ${invited})`);
  const tooMany = await tryAs(org, (tx) => tx`select public.create_invites(${tid}, ${["X1", "X2", "X3"]})`);
  check("No deja crear más invitaciones que lugares libres (14 + 3 > 16)", !!tooMany && /Solo quedan 2/.test(tooMany), tooMany);
  const inv = async () => new Map((await sql`select label, token, id, status from public.tournament_invites where tournament_id = ${tid}`).map((r) => [r.label, r]));
  let invites = await inv();
  const leak = await as(users.get("neza_ace")!, (tx) => tx`select count(*)::int n from public.tournament_invites`);
  check("Un jugador no puede ver los enlaces de invitación (RLS)", leak[0]!.n === 0);

  // El enlace de "zurdo.mx" se reenvía y lo usa "neza_ace" primero.
  await as(users.get("neza_ace")!, (tx) => tx`select public.claim_invite(${invites.get("zurdo.mx")!.token})`);
  step("neza_ace usa el enlace reenviado de zurdo.mx");
  for (const p of invited) {
    if (p === "zurdo.mx") continue;
    const code = await as(users.get(p)!, (tx) => tx`select public.claim_invite(${invites.get(p)!.token}) as c`);
    step(`${p} acepta su invitación`, { codigo: code[0]!.c });
  }
  const reuse = await tryAs(users.get("zurdo.mx")!, (tx) => tx`select public.claim_invite(${invites.get("zurdo.mx")!.token})`);
  check("El enlace ya usado no sirve para una segunda persona", !!reuse && /otra persona/.test(reuse), reuse);
  const orgNote = await sql`select body from public.notifications where user_id = ${org} and title = 'Invitación usada' and body like '%neza_ace%'`;
  check("El organizador ve quién usó cada invitación", orgNote.length === 1, orgNote[0]?.body);
  await as(org, (tx) => tx`select public.cancel_invite(${invites.get("zurdo.mx")!.id})`);
  await as(org, (tx) => tx`select public.create_invites(${tid}, ${["zurdo.mx (nuevo)"]})`);
  invites = await inv();
  await as(users.get("zurdo.mx")!, (tx) => tx`select public.claim_invite(${invites.get("zurdo.mx (nuevo)")!.token})`);
  step("El organizador cancela la invitación mal usada (neza_ace pasa a espera) y manda una nueva a zurdo.mx");

  for (const p of PLAYERS.slice(14)) {
    const r = await as(users.get(p)!, (tx) => tx`select public.register(${tid}) as s`);
    step(`${p} se inscribe con el enlace general`, { estado: r[0]!.s });
    check(`${p} queda en lista de espera (torneo con invitación)`, r[0]!.s === "waitlist");
  }
  const st = async () => Object.fromEntries((await sql`select user_id, status, checked_in_at from public.registrations where tournament_id = ${tid} and user_id is not null`).map((r) => [name(r.user_id), r.status]));
  let s = await st();
  check("neza_ace quedó en espera tras cancelar la invitación", s["neza_ace"] === "waitlist", s["neza_ace"]);
  check("14 jugadores con lugar por invitación", Object.values(s).filter((v) => v === "registered").length === 14);

  // Una invitada avisa que ya no puede ir; el lugar no se llena solo.
  await as(users.get("ixchel_07")!, (tx) => tx`select public.unregister(${tid})`);
  s = await st();
  check("Al darse de baja, el lugar no lo toma nadie automáticamente", Object.values(s).filter((v) => v === "registered").length === 13);
  const [{ id: regLalo }] = await sql`select id from public.registrations where tournament_id = ${tid} and user_id = ${users.get("lalo.combo")!}`;
  await as(org, (tx) => tx`select public.staff_move(${regLalo}, 'registered')`);
  step("ixchel_07 libera su lugar; el organizador se lo da a lalo.combo (Dar lugar)");
  const notStaff = await tryAs(users.get("frida_tcg")!, (tx) => tx`select public.staff_move(${regLalo}, 'waitlist')`);
  check("Un jugador no puede mover lugares", !!notStaff, notStaff);
  const guest = await as(org, (tx) => tx`select public.add_guest(${tid}, 'Invitado Sin Cuenta') as id`);
  step("Se agrega un invitado sin cuenta con check-in hecho", { registro: guest[0]!.id });

  // ───── 5. Check-in (el tiempo avanza hasta 10 min antes) ─────
  await sql`update public.tournaments set starts_at = now() + interval '10 minutes' where id = ${tid}`;
  const lateInvite = await tryAs(org, (tx) => tx`select public.create_invites(${tid}, ${["Tarde"]})`);
  check("Con el check-in abierto ya no se crean invitaciones", !!lateInvite, lateInvite);
  const absent = ["rex.bajio", "mictlan99"]; // con lugar, no llegan
  for (const [p, status] of Object.entries(s)) {
    if (status === "removed" || absent.includes(p) || p === "chilango.ex") continue;
    const r = await as(users.get(p)!, (tx) => tx`select public.checkin(${tid}) as s`);
    step(`${p} hace check-in`, { estado: r[0]!.s });
  }
  s = await st();
  step("Estado antes de empezar", s);

  // ───── 6. Empezar (cierra check-in: faltas y lista de espera) ─────
  await startTournament(sql, tid, org);
  s = await st();
  const playing = Object.entries(s).filter(([, v]) => v === "checked_in").map(([k]) => k);
  step("Torneo empezado", { juegan: playing, estados: s });
  check("Los 2 que no hicieron check-in quedan como 'No se presentó'", absent.every((p) => s[p] === "no_show"), absent.map((p) => s[p]));
  check("Su falta queda registrada y avisada", (await sql`select count(*)::int n from public.notifications where user_id = ${users.get("mictlan99")!} and body like '%primera falta%'`)[0]!.n === 1);
  check("Entran los de espera que sí hicieron check-in, hasta el cupo (16 con el invitado)", playing.length === 15, playing.length);
  check("El de espera sin check-in queda fuera sin falta", s["chilango.ex"] === "removed");
  const [{ n: noShowSanctions }] = await sql`select count(*)::int n from public.sanctions where user_id = ${users.get("mictlan99")!}`;
  check("La primera falta no suspende", noShowSanctions === 0);

  // ───── 7. Rondas ─────
  const regUser = new Map((await sql`select id, user_id, guest_name from public.registrations where tournament_id = ${tid}`).map((r) => [r.id, r]));
  const who = (regId: string | null) => (regId ? (regUser.get(regId)!.user_id ? name(regUser.get(regId)!.user_id) : regUser.get(regId)!.guest_name) : "BYE");
  const opponents = new Map<string, Set<string>>();
  let dramaDone = { dispute: false, noshow: false, secret: false };
  for (let guard = 0; guard < 10; guard++) {
    const [t] = await sql`select status, current_round from public.tournaments where id = ${tid}`;
    if (t!.status === "finished") break;
    const [round] = await sql`select * from public.rounds where tournament_id = ${tid} and number = ${t!.current_round}`;
    const ms = await sql`select * from public.matches where round_id = ${round!.id} order by table_no`;
    const pairing = ms.map((m) => `${m.table_no}: ${who(m.a)} vs ${who(m.b)}`);
    step(`Ronda ${round!.number} (${round!.stage}, Bo${round!.best_of}) emparejada`, pairing);
    for (const m of ms) {
      if (!m.b) { check(`R${round!.number}: el bye se confirma solo`, m.status === "confirmed", m.status); continue; }
      if (round!.stage === "swiss") {
        const ka = String(m.a), kb = String(m.b);
        const rematch = opponents.get(ka)?.has(kb) ?? false;
        check(`R${round!.number} mesa ${m.table_no}: sin revancha en suizo`, !rematch, `${who(m.a)} vs ${who(m.b)}`);
        opponents.set(ka, (opponents.get(ka) ?? new Set()).add(kb));
        opponents.set(kb, (opponents.get(kb) ?? new Set()).add(ka));
      }
      const ua = regUser.get(m.a)!.user_id as string | null, ub = regUser.get(m.b)!.user_id as string | null;
      const win = Math.ceil(round!.best_of / 2);
      // Contraseña y datos privados: solo los ven los jugadores de la mesa.
      if (!dramaDone.secret && ua && ub) {
        const outsider = [...users.values()].find((u) => u !== ua && u !== ub && u !== org && u !== judge && u !== superadmin)!;
        const peek = await tryAs(outsider, (tx) => tx`select public.table_private(${m.id})`);
        const own = await as(ua, (tx) => tx`select public.table_private(${m.id}) as p`);
        check("Un jugador ajeno no ve la contraseña de otra mesa", !!peek, peek);
        check("El jugador de la mesa sí ve contraseña y datos del rival", !!own[0]!.p, Object.keys(own[0]!.p ?? {}));
        dramaDone.secret = true;
      }
      // Un jugador no se presenta a su mesa en la ronda 2: el staff lo marca.
      if (!dramaDone.noshow && round!.number === 2 && ua && ub) {
        await as(ua, (tx) => tx`select public.table_checkin(${m.id})`);
        await as(ua, (tx) => tx`select public.call_judge(${m.id}, 'ausente')`);
        await as(judge, (tx) => tx`select public.staff_no_show(${m.id}, ${m.b})`);
        step(`R2 mesa ${m.table_no}: ${who(m.b)} no llega; la jueza marca la falta y queda fuera del torneo`);
        const openCases = await sql`select count(*)::int n from public.cases where match_id = ${m.id} and status <> 'resolved' and kind = 'ausente'`;
        check("El caso de ausencia se cierra al marcar la falta", openCases[0]!.n === 0, openCases[0]!.n);
        dramaDone.noshow = true;
        continue;
      }
      if (ua) await as(ua, (tx) => tx`select public.table_checkin(${m.id})`);
      if (ub) await as(ub, (tx) => tx`select public.table_checkin(${m.id})`);
      if (ua && ub) await as(ua, (tx) => tx`select public.quick_message(${m.id}, 'buscando')`);
      const pa = ua ? skill.get(ua)! : 0.4, pb = ub ? skill.get(ub)! : 0.4;
      let ga = 0, gb = 0;
      while (ga < win && gb < win) { if (rnd() < pa / (pa + pb)) ga++; else gb++; }
      const reporter = ua ?? ub;
      if (!reporter) { await as(judge, (tx) => tx`select public.staff_set_result(${m.id}, ${ga}, ${gb}, 0, false, 'Mesa sin cuentas')`); continue; }
      // En la primera ronda una mesa disputa el marcador y la jueza decide.
      if (!dramaDone.dispute && ua && ub) {
        await as(ua, (tx) => tx`select public.report_result(${m.id}, ${win}, 0, 0)`);
        const c = await as(ub, (tx) => tx`select public.dispute_result(${m.id}) as c`);
        await as(judge, (tx) => tx`select public.staff_set_result(${m.id}, ${ga}, ${gb}, 0, false, 'Revisé las capturas de ambos')`);
        step(`R${round!.number} mesa ${m.table_no}: ${who(m.a)} reporta ${win}-0, ${who(m.b)} lo disputa (caso ${c[0]!.c}); la jueza fija ${ga}-${gb}`);
        const [cs] = await sql`select status from public.cases where id = ${c[0]!.c}`;
        check("El caso de disputa se cierra al poner el resultado", cs!.status === "resolved", cs!.status);
        dramaDone.dispute = true;
        continue;
      }
      const mine = reporter === ua ? [ga, gb] : [gb, ga];
      await as(reporter, (tx) => tx`select public.report_result(${m.id}, ${mine[0]!}, ${mine[1]!}, 0)`);
      const other = reporter === ua ? ub : ua;
      if (other) await as(other, (tx) => tx`select public.confirm_result(${m.id})`);
      else await as(judge, (tx) => tx`select public.staff_set_result(${m.id}, ${ga}, ${gb}, 0, false, 'Confirmó la jueza por el invitado sin cuenta')`);
      step(`R${round!.number} mesa ${m.table_no}: ${who(m.a)} ${ga}-${gb} ${who(m.b)}`);
    }
    const open = await sql`select count(*)::int n from public.matches where round_id = ${round!.id} and status <> 'confirmed'`;
    check(`Ronda ${round!.number}: todas las mesas confirmadas`, open[0]!.n === 0, open[0]!.n);
    const links = ms.map((m) => `/mesa/${m.id}`);
    const notifs = await sql`select count(distinct user_id)::int n from public.notifications where link = any(${links})`;
    step(`Ronda ${round!.number}: jugadores avisados de su mesa`, notifs[0]!.n);
    await nextRound(sql, tid, org);
  }

  // ───── 8. Resultado, PR y medallas ─────
  const [tf] = await sql`select status, current_round from public.tournaments where id = ${tid}`;
  check("El torneo termina con ganador", tf!.status === "finished", tf);
  const results = await sql`select r.*, p.username from public.results r left join public.profiles p on p.id = r.user_id where r.tournament_id = ${tid} order by placement`;
  step("Tabla final", results.map((r) => ({ lugar: r.placement, jugador: r.username ?? "invitado", v: r.wins, d: r.losses, pr: r.pr_delta, medallas: r.new_medals })));
  const placements = results.map((r) => r.placement);
  check("Lugares del 1 al N sin repetir", placements.every((p, i) => p === i + 1), placements);
  const [final] = await sql`select m.*, r.stage from public.matches m join public.rounds r on r.id = m.round_id where m.tournament_id = ${tid} order by r.number desc limit 1`;
  check("El campeón es quien ganó la final", final!.winner === results[0]!.registration_id, { final: final!.winner, primero: results[0]!.registration_id });
  check("El campeón gana PR", results[0]!.pr_delta > 0, results[0]!.pr_delta);
  check("El invitado sin cuenta no recibe PR", results.filter((r) => !r.user_id).every((r) => r.pr_delta === 0));
  const seasons = await sql`select user_id, pr, medals from public.player_seasons where user_id = any(${results.filter((r) => r.user_id).map((r) => r.user_id)})`;
  const bySeason = new Map(seasons.map((x) => [x.user_id, x]));
  const prOk = results.filter((r) => r.user_id).every((r) => bySeason.get(r.user_id)!.pr === Math.max(0, r.pr_delta));
  check("El PR de temporada de cada jugador = lo que ganó en el torneo", prOk, results.map((r) => [r.username, r.pr_delta, bySeason.get(r.user_id)?.pr]));
  const medalOk = results.filter((r) => r.user_id).every((r) => (r.new_medals as string[]).every((m) => (bySeason.get(r.user_id)!.medals as string[]).includes(m)));
  check("Las medallas nuevas quedan guardadas en la temporada", medalOk);
  check("Se otorgó al menos una medalla", results.some((r) => (r.new_medals as string[]).length > 0), results.map((r) => r.new_medals));
  // Quien dejó el torneo (no llegó a su mesa en la R2) recibe derrota por cada ronda suiza que no jugó.
  const quitter = results.find((r) => r.user_id && r.pr_breakdown?.rondasSinJugar > 0);
  const finishers = results.filter((r) => r.user_id && r.pr_breakdown?.rondasSinJugar === 0 && r.placement > 4);
  check("Quien deja el torneo recibe derrota por las rondas suizas que no jugó", !!quitter && quitter.pr_breakdown.unplayed < 0, quitter?.pr_breakdown);
  check("Dejar el torneo nunca da más PR que terminarlo con el mismo número de victorias",
    !!quitter && finishers.filter((f) => f.wins >= quitter.wins).every((f) => quitter.pr_delta <= f.pr_delta),
    { retirado: quitter && [quitter.username, quitter.wins, quitter.pr_delta], terminaron: finishers.map((f) => [f.username, f.wins, f.pr_delta]) });
  const absentPR = await sql`select pr from public.player_seasons where user_id = ${users.get("mictlan99")!}`;
  check("Quien no se presentó no gana PR", (absentPR[0]?.pr ?? 0) === 0, absentPR[0]);
  const resNotes = await sql`select count(distinct user_id)::int n from public.notifications where link like ${"/resultado/" + tid + "%"}`;
  check("Los jugadores reciben aviso de su resultado", resNotes[0]!.n >= results.filter((r) => r.user_id).length, resNotes[0]!.n);
  const audit = await sql`select action, count(*)::int n from public.audit_log where tournament_id = ${tid} group by action order by n desc`;
  step("Bitácora de auditoría del torneo", audit);
  check("Todo queda en la auditoría (inicio, rondas, juez, invitaciones)", audit.length >= 6, audit.length);
  const attendance = await as(org, (tx) => tx`select * from public.tournament_attendance(${tid})`);
  check("Asistencia visible para el staff", attendance.length > 0);
  const hacker = await tryAs(users.get("brisa_gg")!, (tx) => tx`select * from public.tournament_attendance(${tid})`);
  check("Un jugador no puede ver la asistencia del staff", !!hacker, hacker);

  const failed = checks.filter((c) => !c.ok);
  step("Fin de la simulación", { pruebas: checks.length, fallidas: failed.length });
  expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
});
