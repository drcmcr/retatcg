import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Me = {
  id: string;
  email: string | null;
  username: string;
  titleMedal: string | null;
  titleForm: string;
  isPrivate: boolean;
  deletingAt: string | null;
  roles: string[];
  isOrganizer: boolean;
  isSuperadmin: boolean;
  season: { id: number; name: string; endsAt: string } | null;
  pr: number;
  highestRank: number;
  medals: string[];
};

/** Usuario de la sesión (o null). Una sola lectura por petición. */
export const getUser = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Perfil completo del jugador con la sesión; null si aún no termina de crear su cuenta. */
export const getMe = cache(async (): Promise<Me | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await supabaseServer();
  const [{ data: p }, { data: roles }, { data: season }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", user.id),
    supabase.from("seasons").select("id,name,ends_at").is("closed_at", null).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!p) return null;
  const { data: ps } = season
    ? await supabase.from("player_seasons").select("pr,highest_rank,medals").eq("user_id", user.id).eq("season_id", season.id).maybeSingle()
    : { data: null };
  const r = (roles ?? []).map((x) => x.role as string);
  return {
    id: user.id,
    email: user.email ?? null,
    username: p.username,
    titleMedal: p.title_medal,
    titleForm: p.title_form,
    isPrivate: p.is_private,
    deletingAt: p.deleting_at,
    roles: r,
    isOrganizer: r.includes("organizer") || r.includes("superadmin"),
    isSuperadmin: r.includes("superadmin"),
    season: season ? { id: season.id, name: season.name, endsAt: season.ends_at } : null,
    pr: ps?.pr ?? 0,
    highestRank: ps?.highest_rank ?? 0,
    medals: ps?.medals ?? [],
  };
});

/** Para páginas que exigen cuenta completa. */
export async function requireMe(next?: string): Promise<Me> {
  const user = await getUser();
  if (!user) redirect(`/entrar${next ? `?siguiente=${encodeURIComponent(next)}` : ""}`);
  const me = await getMe();
  if (!me) redirect("/bienvenida");
  return me;
}
