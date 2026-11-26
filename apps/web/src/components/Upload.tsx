"use client";
import { useId, useState } from "react";
import { reportClientError } from "@/actions/player";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

const MAX_BYTES = 5 * 1024 * 1024; // límite del bucket "capturas"
const RAW_OK = ["image/jpeg", "image/png", "image/webp"];

class UploadError extends Error {
  constructor(public userMsg: string, detail: string) { super(detail); }
}

/** Decodifica la imagen: createImageBitmap y, si falla (algunos Android), un <img> normal. */
async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }
}

/** Reduce la captura a 1600 px de lado y JPEG antes de subirla (más rápido con datos móviles). */
async function shrink(file: File): Promise<{ blob: Blob; type: string }> {
  try {
    const img = await decode(file);
    const scale = Math.min(1, 1600 / Math.max(img.w, img.h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.w * scale));
    canvas.height = Math.max(1, Math.round(img.h * scale));
    canvas.getContext("2d")!.drawImage(img.src, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob && blob.size > 0) return { blob, type: "image/jpeg" };
    throw new Error("toBlob vacío");
  } catch (e) {
    // Si el teléfono no deja reducirla, se sube tal cual cuando el formato y el tamaño lo permiten.
    if (RAW_OK.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES) return { blob: file, type: file.type };
    if (file.size === 0) throw new UploadError("La imagen está vacía. Si está en la nube (Google Fotos), descárgala al teléfono y vuelve a elegirla.", `archivo vacío: ${file.type}`);
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) throw new UploadError("Ese formato (HEIC) no se puede leer aquí. Toma una captura de pantalla de tu mazo y súbela.", `heic: ${file.type}`);
    throw new UploadError("No se pudo leer la imagen. Usa una captura de pantalla (PNG o JPG) de tu mazo.", `decode: ${file.type} ${file.size}B ${e instanceof Error ? e.message : e}`);
  }
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Sube una captura privada a <torneo>/<usuario>/… y devuelve su ruta. */
export function CaptureUpload({ tournamentId, userId, onUploaded, label = "Subir captura" }: { tournamentId: string; userId: string; onUploaded: (path: string, preview: string) => void; label?: string }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="col" style={{ gap: 6 }}>
      {/* Etiqueta nativa en vez de click() por código: más confiable en Android y navegadores dentro de apps. */}
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/*" className="sr-only" disabled={busy} onChange={async (e) => {
        const input = e.currentTarget;
        const f = input.files?.[0];
        if (!f) return;
        setBusy(true); setErr(null);
        try {
          const { blob, type } = await shrink(f);
          const path = `${tournamentId}/${userId}/${crypto.randomUUID()}.${EXT[type]}`;
          const { error } = await supabaseBrowser().storage.from("capturas").upload(path, blob, { contentType: type, upsert: false });
          if (error) throw new UploadError("No se pudo subir la captura. Revisa tu conexión e inténtalo de nuevo.", `storage: ${error.message}`);
          onUploaded(path, URL.createObjectURL(blob));
        } catch (e) {
          const msg = e instanceof UploadError ? e.userMsg : "No se pudo subir la captura. Inténtalo de nuevo.";
          setErr(msg);
          void reportClientError("captura", `${e instanceof Error ? e.message : String(e)} · ${f.type || "sin tipo"} ${f.size}B · ${navigator.userAgent}`).catch(() => {});
        } finally {
          setBusy(false);
          input.value = "";
        }
      }} />
      <label htmlFor={id} className="btn g" aria-disabled={busy || undefined} style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
        <Icon name="img" size={20} />{busy ? "Subiendo…" : label}
      </label>
      {err && <span className="hint err" role="alert"><Icon name="warn" size={15} />{err}</span>}
    </div>
  );
}
