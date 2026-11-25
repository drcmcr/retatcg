"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

/** Reduce la captura a 1600 px de lado y JPEG antes de subirla (más rápido con datos móviles). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo leer la imagen."))), "image/jpeg", 0.85));
}

/** Sube una captura privada a <torneo>/<usuario>/… y devuelve su ruta. */
export function CaptureUpload({ tournamentId, userId, onUploaded, label = "Subir captura" }: { tournamentId: string; userId: string; onUploaded: (path: string, preview: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="col" style={{ gap: 6 }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true); setErr(null);
        try {
          const blob = await shrink(f);
          const path = `${tournamentId}/${userId}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabaseBrowser().storage.from("capturas").upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (error) throw error;
          onUploaded(path, URL.createObjectURL(blob));
        } catch {
          setErr("No se pudo subir la captura. Inténtalo de nuevo.");
        } finally {
          setBusy(false);
          if (input.current) input.current.value = "";
        }
      }} />
      <button type="button" className="btn g" onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="img" size={20} />{busy ? "Subiendo…" : label}
      </button>
      {err && <span className="hint err" role="alert"><Icon name="warn" size={15} />{err}</span>}
    </div>
  );
}
