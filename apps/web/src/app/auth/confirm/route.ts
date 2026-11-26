import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Respaldo del código: el enlace del correo también inicia sesión. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as "email" | "magiclink" | "signup";
  const next = url.searchParams.get("siguiente");
  const wanted = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (tokenHash) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(await destination(supabase, wanted), url.origin));
  }
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(await destination(supabase, wanted), url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
}

/** Cuenta sin perfil: pasa por el registro y luego regresa a donde iba. */
async function destination(supabase: Awaited<ReturnType<typeof supabaseServer>>, wanted: string | null) {
  const { data: u } = await supabase.auth.getUser();
  const { data: p } = u.user ? await supabase.from("profiles").select("id").eq("id", u.user.id).maybeSingle() : { data: null };
  if (!p) return wanted ? `/bienvenida?siguiente=${encodeURIComponent(wanted)}` : "/bienvenida";
  return wanted ?? "/inicio";
}
