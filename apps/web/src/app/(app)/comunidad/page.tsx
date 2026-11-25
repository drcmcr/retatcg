import Link from "next/link";
import { Identicon } from "@/components/Identicon";
import { requireMe } from "@/lib/auth";
import { fmtNum } from "@/lib/format";
import { rankFromPR } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";
import { leaderboardPosition } from "@/lib/profile";
import { Search } from "./Search";

export const metadata = { title: "Comunidad" };

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ pestana?: string; filtro?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireMe("/comunidad");
  const tab = sp.pestana === "buscar" ? "buscar" : "ranking";
  const supabase = await supabaseServer();
  const { data: f } = await supabase.from("follows").select("followee").eq("follower", me.id);
  const followed = new Set((f ?? []).map((x) => x.followee));
  let rows: { user_id: string; pr: number; username: string }[] = [];
  if (tab === "ranking") {
    let q = supabase.from("player_seasons").select("user_id,pr,profile:profiles!inner(username)").eq("season_id", me.season?.id ?? 1).order("pr", { ascending: false }).limit(100);
    if (sp.filtro === "seguidos") q = q.in("user_id", [me.id, ...followed]);
    const { data } = await q;
    rows = ((data ?? []) as unknown as { user_id: string; pr: number; profile: { username: string } }[]).map((r) => ({ user_id: r.user_id, pr: r.pr, username: r.profile.username }));
  }
  const myPos = me.season ? await leaderboardPosition(me.id, me.season.id, me.pr) : 0;
  return (
    <main className="screen">
      <div className="tb"><h1>Comunidad</h1></div>
      <nav className="seg" aria-label="Comunidad">
        <Link href="/comunidad" aria-current={tab === "ranking" ? "page" : undefined}>Ranking</Link>
        <Link href="/comunidad?pestana=buscar" aria-current={tab === "buscar" ? "page" : undefined}>Buscar</Link>
      </nav>
      {tab === "ranking" ? (
        <>
          <div className="chips">
            <Link href="/comunidad" className="chip" aria-current={!sp.filtro ? "page" : undefined}>Todos</Link>
            <Link href="/comunidad?filtro=seguidos" className="chip" aria-current={sp.filtro === "seguidos" ? "page" : undefined}>Seguidos</Link>
          </div>
          <div className="list">
            {rows.map((r, i) => {
              const rk = rankFromPR(r.pr, i + 1);
              return (
                <Link key={r.user_id} href={`/jugador/${r.username}`} className="li n4" style={{ minHeight: 52, padding: "8px 12px", boxShadow: r.user_id === me.id ? "inset 0 0 0 2px var(--lime)" : undefined }}>
                  <span className="px20" style={{ width: 30, fontSize: 22, color: i === 0 ? "var(--lime)" : undefined }}>{i + 1}</span>
                  <Identicon seed={r.user_id} size={30} />
                  <span className="grow"><span className="ttl">{r.username}</span><span className="xs">{rk.name}</span></span>
                  <span className="mono nw">{fmtNum(r.pr)}</span>
                </Link>
              );
            })}
            {!rows.length && <p className="sm">Todavía no hay PR esta temporada. ¡Juega un torneo Comunitario!</p>}
          </div>
          <div className="li n4 stick-bottom" style={{ boxShadow: "inset 0 0 0 2px var(--lime)" }}>
            <span className="px20" style={{ width: 40, fontSize: 22 }}>{myPos}</span>
            <Identicon seed={me.id} size={30} />
            <span className="grow"><span className="ttl">{me.username}</span><span className="xs">{rankFromPR(me.pr).name}</span></span>
            <span className="mono nw">{fmtNum(me.pr)}</span>
          </div>
        </>
      ) : (
        <Search initial={sp.q ?? ""} followed={[...followed]} meId={me.id} />
      )}
    </main>
  );
}
