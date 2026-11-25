"use client";
import { useState } from "react";
import { useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

export function ShareCard({ username }: { username: string }) {
  const [f, setF] = useState<"story" | "post">("story");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const src = `/api/og/tarjeta/${encodeURIComponent(username)}?f=${f}`;
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/jugador/${username}` : "";
  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `reta-${username}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi tarjeta de cazador", text: `Mi tarjeta en Reta: ${profileUrl}` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast({ tone: "err", text: "No se pudo compartir. Descarga la imagen y súbela tú." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="seg">
        <button aria-selected={f === "story"} onClick={() => setF("story")}>Historia 9:16</button>
        <button aria-selected={f === "post"} onClick={() => setF("post")}>Publicación 4:5</button>
      </div>
      <div className="chk n6" style={{ padding: 12, display: "grid", placeItems: "center" }}>
        <img src={src} alt="Vista previa de tu tarjeta de cazador" style={{ width: "100%", maxWidth: f === "story" ? 260 : 340, aspectRatio: f === "story" ? "9/16" : "4/5", background: "#0E0E12" }} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn p" disabled={busy} onClick={share}><Icon name="share" size={20} />{busy ? "Preparando…" : "Compartir"}</button>
        <a className="ib" href={src} download={`reta-${username}.png`} aria-label="Descargar imagen"><Icon name="dl" /></a>
        <button className="ib" aria-label="Copiar enlace a mi perfil" onClick={async () => { await navigator.clipboard.writeText(profileUrl); toast({ tone: "ok", text: "Enlace copiado." }); }}><Icon name="copy" /></button>
      </div>
    </>
  );
}
