import Link from "next/link";
import { notFound } from "next/navigation";
import { HunterCard } from "@/components/HunterCard";
import { Stat, TopBar } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { history, leaderboardPosition, loadProfileByUsername } from "@/lib/profile";
import { supabaseServer } from "@/lib/supabase/server";
import { ordinal } from "@/lib/format";
import { PlayerActions } from "./PlayerActions";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: username, openGraph: { images: [`/api/og/tarjeta/${encodeURIComponent(username)}?f=post`] } };
}

export default async function Jugador({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await loadProfileByUsername(decodeURIComponent(username));
  if (!p) notFound();
  const me = await getMe();
  const supabase = await supabaseServer();
  const { data: season } = await supabase.from("seasons").select("id").is("closed_at", null).order("id", { ascending: false }).limit(1).maybeSingle();
  const { data: ps } = await supabase.from("player_seasons").select("pr,medals").eq("user_id", p.id).eq("season_id", season?.id ?? 1).maybeSingle();
  const hidden = p.is_private && me?.id !== p.id;
  const [h, pos] = hidden ? [[], undefined] : await Promise.all([history(p.id, 100), ps ? leaderboardPosition(p.id, season?.id ?? 1, ps.pr) : Promise.resolve(undefined)]);
  let vs: { w: number; l: number; n: number } | null = null;
  let following = false;
  if (me && me.id !== p.id) {
    const [{ data: f }, { data: myRegs }, { data: theirRegs }] = await Promise.all([
      supabase.from("follows").select("followee").eq("follower", me.id).eq("followee", p.id).maybeSingle(),
      supabase.from("registrations").select("id").eq("user_id", me.id),
      supabase.from("registrations").select("id").eq("user_id", p.id),
    ]);
    following = !!f;
    const mine = new Set((myRegs ?? []).map((r) => r.id)), theirs = new Set((theirRegs ?? []).map((r) => r.id));
    if (mine.size && theirs.size) {
      const { data: ms } = await supabase.from("matches").select("a,b,winner").eq("status", "confirmed").in("a", [...mine, ...theirs]);
      const rel = (ms ?? []).filter((m) => m.b && ((mine.has(m.a) && theirs.has(m.b)) || (theirs.has(m.a) && mine.has(m.b))));
      if (rel.length) vs = { n: rel.length, w: rel.filter((m) => m.winner && mine.has(m.winner)).length, l: rel.filter((m) => m.winner && theirs.has(m.winner)).length };
    }
  }
  const w = h.reduce((s, r) => s + r.wins, 0), l = h.reduce((s, r) => s + r.losses, 0), d = h.reduce((s, r) => s + r.draws, 0);
  return (
    <main className="screen">
      <TopBar title="" back="/comunidad" />
      {hidden ? (
        <div className="box n4 col" style={{ gap: 6 }}><b className="t2">{p.username}</b><span className="sm">Este perfil es privado.</span></div>
      ) : (
        <>
          <HunterCard d={{ userId: p.id, username: p.username, pr: ps?.pr ?? 0, medals: ps?.medals ?? [], titleMedal: p.title_medal, titleForm: p.title_form, season: season?.id, leaderboardPosition: pos }} />
          <div className="row" style={{ gap: 10 }}>
            <Stat value={h.length} label="Torneos" />
            <Stat value={`${w}-${l}-${d}`} label="Récord" />
            <Stat value={h.length ? ordinal(Math.min(...h.map((r) => r.placement))) : "—"} label="Mejor" tone="lime" />
          </div>
        </>
      )}
      {vs && <div className="box n4 row between"><span className="col" style={{ gap: 0 }}><span className="lbl" style={{ fontSize: 16 }}>Tú contra {p.username}</span><b>{vs.n} encuentros</b></span><span className="px20" style={{ fontSize: 34 }}>{vs.w}-{vs.l}</span></div>}
      {!hidden && h.length > 0 && (
        <div className="list">
          {h.slice(0, 5).map((r) => (
            <Link key={r.tournament_id} href={`/torneo/${r.code}?pestana=tabla`} className="li n4">
              <span className="px20" style={{ width: 46, fontSize: 24 }}>{ordinal(r.placement)}</span>
              <span className="grow"><span className="ttl">{r.name}</span><span className="xs">{r.wins}-{r.losses}-{r.draws}</span></span>
            </Link>
          ))}
        </div>
      )}
      {me && me.id !== p.id && <PlayerActions userId={p.id} username={p.username} following={following} />}
    </main>
  );
}
