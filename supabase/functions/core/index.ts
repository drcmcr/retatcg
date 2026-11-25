// Función "core" de Reta: acciones que necesitan el motor del torneo.
// La llaman el servidor de la app (con la sesión del usuario) y pg_cron (acción "tick", sin sesión).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import { closeRoundEarly, nextRound, startTournament, tick, UserError } from "./logic.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 4, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const API_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Valida la sesión con el servicio de Auth (funciona con llaves nuevas y heredadas). */
async function userFrom(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: API_KEY } });
  if (!res.ok) return null;
  const u = await res.json();
  return typeof u?.id === "string" ? u.id : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Usa POST." }, 405);
  let body: { action?: string; tournamentId?: string };
  try { body = await req.json(); } catch { return json({ error: "Cuerpo no válido." }, 400); }
  try {
    // "tick" es idempotente y solo procesa lo que ya venció: no necesita sesión.
    if (body.action === "tick") return json({ ok: true, data: await tick(sql) });
    const uid = await userFrom(req);
    if (!uid) return json({ error: "Inicia sesión para continuar." }, 401);
    if (!body.tournamentId) return json({ error: "Falta el torneo." }, 400);
    switch (body.action) {
      case "start": return json({ ok: true, data: await startTournament(sql, body.tournamentId, uid) });
      case "next": return json({ ok: true, data: await nextRound(sql, body.tournamentId, uid) });
      case "close_early": return json({ ok: true, data: await closeRoundEarly(sql, body.tournamentId, uid) });
      default: return json({ error: "Acción desconocida." }, 400);
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: "Algo falló en el servidor. Intenta de nuevo." }, 500);
  }
});
