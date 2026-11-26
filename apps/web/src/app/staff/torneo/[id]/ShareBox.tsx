"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton, useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

/** Compartir un torneo: enlace, mensaje listo para pegar, QR descargable y QR para proyectar. */
export function ShareBox({ id, url, code, svg, message, inviteOnly }: { id: string; url: string; code: string; svg: string; message: string; inviteOnly?: boolean }) {
  const toast = useToast();
  const qrUrl = `/staff/torneo/${id}/qr`;
  const fileName = `reta-${code}.png`;
  // La imagen se pide al abrir la pantalla: así el botón responde en el mismo toque (iPhone lo exige para compartir).
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(qrUrl).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (alive && b) setFile(new File([b], fileName, { type: "image/png" }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [qrUrl, fileName]);
  async function downloadQr() {
    const phone = window.matchMedia("(pointer: coarse)").matches;
    // En el teléfono: hoja de compartir con la imagen (ahí está "Guardar imagen").
    if (phone && file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `QR ${code}` }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    // En computadora (o si no se puede compartir): descarga el archivo.
    if (file) {
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      toast({ tone: "ok", text: "QR descargado." });
      return;
    }
    window.location.href = qrUrl;
  }
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Torneo en Reta", text: message });
      } else {
        await navigator.clipboard.writeText(message);
        toast({ tone: "ok", text: "Mensaje copiado. Pégalo donde quieras." });
      }
    } catch { /* el usuario cerró la hoja de compartir */ }
  }
  return (
    <div className="box n4 col" style={{ gap: 12 }}>
      <b className="t2">{inviteOnly ? "Enlace general (lista de espera)" : "Compartir"}</b>
      <div className="share">
        <div className="qrbox" role="img" aria-label={`Código QR del torneo ${code}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="col" style={{ gap: 8, minWidth: 0 }}>
          <span className="xs">Código</span>
          <span className="mono" style={{ fontSize: 28, letterSpacing: ".08em", color: "var(--ink)" }}>{code}</span>
          <span className="xs">Enlace</span>
          <span className="mono sm" style={{ overflowWrap: "anywhere", color: "var(--ink)" }}>{url}</span>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn p sm" onClick={share}><Icon name="share" size={18} />Compartir</button>
        <CopyButton text={url} label="Copiar enlace" />
        <CopyButton text={message} label="Copiar mensaje" />
        <button type="button" className="btn s sm" onClick={downloadQr}><Icon name="dl" size={18} />Descargar QR</button>
        <Link className="btn g sm" href={`/proyectar/${id}`}><Icon name="qr" size={18} />Proyectar QR</Link>
      </div>
      <span className="xs">{inviteOnly
        ? "Como el torneo es con invitación, este enlace, el QR y el código solo dan lugar en la lista de espera. Para apartar lugares usa las invitaciones personales."
        : "Quien abre el enlace o escanea el QR llega directo al torneo. Si no tiene cuenta, la crea y regresa aquí para inscribirse. También pueden escribir el código en Torneos → ícono de QR."}</span>
    </div>
  );
}
