import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Dirección pública de la app según la petición (vercel.app hoy, dominio propio después). */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "retatcg.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** QR oscuro sobre blanco: es el que mejor leen todas las cámaras. */
export async function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0E0E12", light: "#FFFFFF" } });
}

export async function qrPngBuffer(text: string, width = 1024) {
  return QRCode.toBuffer(text, { type: "png", margin: 2, width, errorCorrectionLevel: "M", color: { dark: "#0E0E12", light: "#FFFFFF" } });
}

