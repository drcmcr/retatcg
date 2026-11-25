import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/env";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const FRIENDLY: Record<string, string> = {
  "Failed to fetch": "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
};

function friendly(message: string | undefined): string {
  if (!message) return "Algo falló. Inténtalo de nuevo.";
  return FRIENDLY[message] ?? message;
}

/** Llama una acción de la base (RPC). Los errores de las reglas ya vienen en español. */
export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<ActionResult<T>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as T };
}

/** Llama a la función "core" (emparejar, empezar, cerrar ronda) con la sesión del usuario. */
export async function callCore<T = unknown>(action: string, tournamentId: string): Promise<ActionResult<T>> {
  const supabase = await supabaseServer();
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) return { ok: false, error: "Inicia sesión para continuar." };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/core`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, tournamentId }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) return { ok: false, error: body.error ?? "Algo falló en el servidor." };
    return { ok: true, data: body.data as T };
  } catch {
    return { ok: false, error: "No pudimos conectar con el servidor. Inténtalo de nuevo." };
  }
}
