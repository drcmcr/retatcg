import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ISO_D, WM_D } from "@/lib/brand-paths";
import { fmtDateTime } from "@/lib/format";
import { requireTournamentStaff } from "@/lib/staff";
import { qrSvg, siteOrigin } from "@/lib/share";

// Imagen descargable del QR con el mismo diseño que la pantalla "Proyectar QR" (4:5, sirve para WhatsApp, redes e impresión).
const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
const fonts = Promise.all(["bricolage800c.woff", "bricolage400.woff", "jetbrains500.woff"].map((f) => readFile(join(process.cwd(), "assets/og", f))));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const origin = await siteOrigin();
  const url = `${origin}/torneo/${t.code}`;
  const qr = await qrSvg(url);
  const [cond, regular, mono] = await fonts;
  const W = 1080, H = 1350;
  const isoH = 104, isoW = Math.round((isoH * 720) / 1575.29);
  const wmH = 52, wmW = Math.round((wmH * 2226.06) / 382.997);
  // Las fuentes de marca no traen la flecha: se dibuja.
  const arrow = <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#B4B4BE" stroke-width="2.4" stroke-linecap="square"><path d="M4 12h15M13 6l6 6-6 6"/></svg>`)} width={28} height={28} style={{ marginTop: 6 }} />;
  const host = origin.replace(/^https?:\/\//, "");

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26,
        padding: "56px 64px", backgroundColor: "#0E0E12", fontFamily: "Bricolage", fontWeight: 400, color: "#F4F4F5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1575.29"><defs><linearGradient id="a" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0" stop-color="#AAFF01"/><stop offset=".55" stop-color="#01EEFE"/><stop offset="1" stop-color="#5820FF"/></linearGradient></defs><path fill="url(#a)" d="${ISO_D}"/></svg>`)} width={isoW} height={isoH} />
          <img src={svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2226.06 382.997"><path fill="#F4F4F5" d="${WM_D}"/></svg>`)} width={wmW} height={wmH} />
        </div>
        <div style={{ display: "flex", textAlign: "center", justifyContent: "center", fontFamily: "Condensed", fontSize: t.name.length > 40 ? 72 : 88, fontWeight: 800, lineHeight: 1.04, letterSpacing: -0.5 }}>{t.name}</div>
        <div style={{ display: "flex", fontSize: 34, color: "#B4B4BE" }}>{`${t.club ? `${t.club} · ` : ""}${fmtDateTime(t.starts_at)}`}</div>
        <div style={{ display: "flex", background: "#FFFFFF", padding: 14 }}>
          <img src={svg(qr)} width={520} height={520} />
        </div>
        <div style={{ display: "flex", fontSize: 36 }}>Escanéalo con la cámara para inscribirte</div>
        <div style={{ display: "flex", fontFamily: "Mono", fontSize: 84, letterSpacing: 8, color: "#AAFF01" }}>{t.code}</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, alignItems: "flex-start", fontSize: 28, color: "#B4B4BE" }}>
          <span>{`O entra a ${host}`}</span>{arrow}<span>Torneos</span>{arrow}<span>ícono de QR y escribe el código.</span>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Condensed", data: cond, weight: 800, style: "normal" },
        { name: "Bricolage", data: regular, weight: 400, style: "normal" },
        { name: "Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="reta-${t.code}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
