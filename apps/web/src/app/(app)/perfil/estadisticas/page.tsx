import { Identicon } from "@/components/Identicon";
import { Empty, Stat, TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { history } from "@/lib/profile";

export const metadata = { title: "Estadísticas" };

export default async function Estadisticas() {
  const me = await requireMe("/perfil/estadisticas");
  const supabase = await supabaseServer();
  const h = (await history(me.id, 200)).slice().reverse();
  if (!h.length) return <main className="screen"><TopBar title="Estadísticas" back="/perfil" /><Empty icon="chart" title="Juega tu primer torneo para ver tus números" /></main>;
  const w = h.reduce((s, r) => s + r.wins, 0), l = h.reduce((s, r) => s + r.losses, 0), d = h.reduce((s, r) => s + r.draws, 0);
  // Rivales frecuentes: encuentros confirmados donde jugaste.
  const { data: regs } = await supabase.from("registrations").select("id").eq("user_id", me.id);
  const mine = (regs ?? []).map((r) => r.id);
  const { data: ms } = mine.length ? await supabase.from("matches").select("a,b,winner,double_loss").eq("status", "confirmed").or(`a.in.(${mine.join(",")}),b.in.(${mine.join(",")})`) : { data: [] };
  const rivalRegs = new Map<string, { w: number; l: number }>();
  for (const m of ms ?? []) {
    if (!m.b) continue;
    const meReg = mine.includes(m.a) ? m.a : m.b;
    const rv = meReg === m.a ? m.b : m.a;
    const x = rivalRegs.get(rv) ?? { w: 0, l: 0 };
    if (m.winner === meReg) x.w++; else if (m.winner || m.double_loss) x.l++;
    rivalRegs.set(rv, x);
  }
  const { data: rv } = rivalRegs.size ? await supabase.from("registrations").select("id,user_id,profile:profiles(username)").in("id", [...rivalRegs.keys()]) : { data: [] };
  const byUser = new Map<string, { name: string; w: number; l: number }>();
  for (const r of rv ?? []) {
    if (!r.user_id) continue;
    const s = rivalRegs.get(r.id)!;
    const cur = byUser.get(r.user_id) ?? { name: (r.profile as unknown as { username: string } | null)?.username ?? "Jugador", w: 0, l: 0 };
    cur.w += s.w; cur.l += s.l;
    byUser.set(r.user_id, cur);
  }
  const top = [...byUser.entries()].sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l)).slice(0, 5);
  // Curva de PR acumulado.
  const points: number[] = [];
  for (const r of h) points.push((points.at(-1) ?? 0) + r.pr_delta);
  const acc = points.at(-1) ?? 0;
  const max = Math.max(100, ...points);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / Math.max(1, points.length - 1)) * 300} ${100 - (p / max) * 90}`).join(" ");
  return (
    <main className="screen">
      <TopBar title="Estadísticas" back="/perfil" />
      <div className="row" style={{ gap: 10 }}>
        <Stat value={`${Math.round((w / Math.max(1, w + l + d)) * 100)}%`} label="Encuentros" />
        <Stat value={h.length} label="Torneos" />
        <Stat value={w} label="Victorias" tone="lime" />
      </div>
      <div className="box n4 col" style={{ gap: 8 }}>
        <div className="row between"><span className="lbl" style={{ fontSize: 16 }}>PR por torneo</span><span className="mono lime">{acc}</span></div>
        <svg viewBox="0 0 300 100" style={{ width: "100%", height: 120 }} role="img" aria-label={`PR acumulado: ${acc}`}>
          {[300, 600, 900, 1200, 1500].filter((v) => v < max).map((v) => <line key={v} x1="0" x2="300" y1={100 - (v / max) * 90} y2={100 - (v / max) * 90} stroke="#3A3A44" strokeDasharray="3 3" />)}
          <path d={path} fill="none" stroke="#AAFF01" strokeWidth="2.5" />
        </svg>
      </div>
      {top.length > 0 && (
        <section className="col">
          <span className="lbl">Rivales frecuentes</span>
          <div className="list">
            {top.map(([id, x]) => (
              <div key={id} className="li n4" style={{ minHeight: 48, padding: "8px 12px" }}>
                <Identicon seed={id} size={28} /><span className="grow ttl">{x.name}</span><span className="mono">{x.w}-{x.l}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
