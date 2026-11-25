"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { callRpc, type ActionResult } from "@/lib/server-action";

const email = z.string().trim().toLowerCase().email("Revisa tu correo.");

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Manda el código de acceso. Mismo camino para entrar o crear cuenta; nunca revela si el correo existe. */
export async function sendCode(raw: string, next?: string): Promise<ActionResult> {
  const parsed = email.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisa tu correo." };
  const supabase = await supabaseServer();
  const redirectTo = `${await origin()}/auth/confirm${next ? `?siguiente=${encodeURIComponent(next)}` : ""}`;
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: true, emailRedirectTo: redirectTo } });
  if (error) {
    if (/rate|seconds|too many/i.test(error.message)) return { ok: false, error: "Espera un minuto antes de pedir otro código." };
    return { ok: false, error: "No pudimos mandar el código. Inténtalo de nuevo." };
  }
  return { ok: true };
}

export async function verifyCode(rawEmail: string, rawCode: string): Promise<ActionResult<{ next: string }>> {
  const e = email.safeParse(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  if (!e.success || code.length < 6) return { ok: false, error: "Escribe el código completo." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email: e.data, token: code, type: "email" });
  if (error) return { ok: false, error: /expired/i.test(error.message) ? "El código venció. Pide uno nuevo." : "Ese código no es correcto." };
  const { data: u } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("id").eq("id", u.user!.id).maybeSingle();
  return { ok: true, data: { next: p ? "/inicio" : "/bienvenida" } };
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export async function checkUsername(name: string): Promise<boolean> {
  const r = await callRpc<boolean>("username_available", { p_username: name });
  return r.ok ? !!r.data : false;
}

const onboarding = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9._]{3,16}$/, "El usuario debe tener de 3 a 16 caracteres: letras, números, punto o guion bajo."),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisa tu fecha de nacimiento."),
  pocketName: z.string().trim().min(1, "Escribe tu nombre en Pocket.").max(20),
  friendId: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().length(16, "El ID de amigo tiene 16 números.")),
  timezone: z.string().max(60).optional(),
  accept: z.literal(true, { message: "Acepta los términos y el reglamento para continuar." }),
});

export async function completeOnboarding(input: z.input<typeof onboarding>): Promise<ActionResult> {
  const p = onboarding.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Revisa tus datos." };
  const r = await callRpc("complete_onboarding", {
    p_username: p.data.username, p_birthdate: p.data.birthdate, p_pocket_name: p.data.pocketName,
    p_friend_id: p.data.friendId, p_timezone: p.data.timezone ?? "America/Mexico_City",
  });
  if (!r.ok && /mayores de 18/.test(r.error)) {
    // Beta solo para adultos: no se guarda nada y se cierra la sesión.
    await callRpc("delete_minor_account");
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/beta-18");
  }
  return r;
}
