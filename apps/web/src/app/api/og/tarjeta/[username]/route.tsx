import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { identicon } from "@/components/Identicon";
import { ISO_D, MEDAL_D, WM_D } from "@/lib/brand-paths";
import { MEDAL_ART, MEDALS, RANK_FINISH, rankFromPR, titleText } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";

// Tarjeta para compartir (historia 9:16 o publicación 4:5). Nunca lleva nombre en Pocket ni ID de amigo.
const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
const fonts = Promise.all(["bricolage800.woff", "bricolage700.woff", "jersey20.woff", "jetbrains700.woff"].map((f) => readFile(join(process.cwd(), "assets/og", f))));

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const format = new URL(req.url).searchParams.get("f") === "post" ? "post" : "story";
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("profiles").select("id,username,title_medal,title_form,is_private").ilike("username", username.replace(/[%_]/g, "\\$&")).maybeSingle();
  if (!p) return new Response("No encontramos a ese jugador.", { status: 404 });
  const { data: season } = await supabase.from("seasons").select("id").is("closed_at", null).order("id", { ascending: false }).limit(1).maybeSingle();
  const { data: ps } = await supabase.from("player_seasons").select("pr,medals").eq("user_id", p.id).eq("season_id", season?.id ?? 1).maybeSingle();
  const pr = ps?.pr ?? 0;
  const medals: string[] = ps?.medals ?? [];
  const r = rankFromPR(pr);
  const title = titleText(p.title_medal, p.title_form);
  const ic = identicon(p.id);
  const [b800, b700, j20, mono] = await fonts;
  const W = 1080, H = format === "story" ? 1920 : 1350;
  const finish = RANK_FINISH[r.name] ?? "#4A4A56";
  const isoW = Math.round((180 * 720) / 1575.29);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 48,
        backgroundColor: "#0E0E12", fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1575.29"><defs><linearGradient id="a" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0" stop-color="#AAFF01"/><stop offset=".55" stop-color="#01EEFE"/><stop offset="1" stop-color="#5820FF"/></linearGradient></defs><path fill="url(#a)" d="${ISO_D}"/></svg>`)} width={isoW} height={180} />
          <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2226.06 382.997"><path fill="#F4F4F5" d="${WM_D}"/></svg>`)} width={520} height={89} />
        </div>
        <div style={{ display: "flex", padding: 18, background: finish, width: 900 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26, background: "#121218", padding: "40px 44px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Jersey", fontSize: 40, color: "#B4B4BE" }}>
              <span>TARJETA DE CAZADOR</span><span>T{season?.id ?? 1}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" shape-rendering="crispEdges"><rect width="7" height="7" fill="#121218"/><path fill="${ic.color}" d="${ic.path}"/></svg>`)} width={96} height={96} />
              <span style={{ fontSize: 72, fontWeight: 800, color: "#F4F4F5" }}>{p.username}</span>
            </div>
            {title && <span style={{ fontFamily: "Jersey", fontSize: 52, color: "#AAFF01" }}>{title.toUpperCase()}</span>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "Jersey", fontSize: 84, color: "#F4F4F5" }}>{`${r.name} ${r.division}`.toUpperCase()}</span>
              <span style={{ fontFamily: "Mono", fontSize: 44, color: "#AAFF01" }}>{p.is_private ? "" : `${pr.toLocaleString("es-MX")} PR`}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ flex: 1, height: 22, background: i < Math.round((r.progress / 100) * 20) ? "#AAFF01" : "#2A2A33" }} />)}
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {MEDALS.map((m) => {
                const on = medals.includes(m);
                return (
                  <div key={m} style={{ display: "flex", width: 86, height: 86, alignItems: "center", justifyContent: "center", background: on ? MEDAL_ART[m].grad : "#0E0E12", border: on ? "none" : "4px solid #6E6E7A" }}>
                    <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="${on ? "#0E0E12" : "#8A8A96"}" d="${MEDAL_D[MEDAL_ART[m].icon]}"/></svg>`)} width={64} height={64} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 40, fontWeight: 700, color: "#D6D6DD" }}>Torneos de TCG Pocket · retatcg</span>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Bricolage", data: b800, weight: 800, style: "normal" },
        { name: "Bricolage", data: b700, weight: 700, style: "normal" },
        { name: "Jersey", data: j20, weight: 400, style: "normal" },
        { name: "Mono", data: mono, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
