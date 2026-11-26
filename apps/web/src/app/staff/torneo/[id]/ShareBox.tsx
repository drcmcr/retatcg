"use client";
import Link from "next/link";
import { CopyButton, useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

/** Compartir un torneo: enlace, mensaje listo para pegar, QR descargable y QR para proyectar. */
export function ShareBox({ id, url, code, svg, png, message, inviteOnly }: { id: string; url: string; code: string; svg: string; png: string; message: string; inviteOnly?: boolean }) {
  const toast = useToast();
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
        <a className="btn s sm" href={png} download={`reta-${code}.png`}><Icon name="dl" size={18} />Descargar QR</a>
        <Link className="btn g sm" href={`/proyectar/${id}`}><Icon name="qr" size={18} />Proyectar QR</Link>
      </div>
      <span className="xs">{inviteOnly
        ? "Como el torneo es con invitación, este enlace, el QR y el código solo dan lugar en la lista de espera. Para apartar lugares usa las invitaciones personales."
        : "Quien abre el enlace o escanea el QR llega directo al torneo. Si no tiene cuenta, la crea y regresa aquí para inscribirse. También pueden escribir el código en Torneos → ícono de QR."}</span>
    </div>
  );
}
