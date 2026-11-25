"use client";
import { useState } from "react";
import { setAnnouncement } from "@/actions/staff";
import { useAction } from "@/components/client";

export function Announcement({ id, current }: { id: string; current: string | null }) {
  const [text, setText] = useState(current ?? "");
  const { run, pending } = useAction();
  return (
    <div className="box n4 col" style={{ gap: 8 }}>
      <b>Anuncio fijado</b>
      <span className="sm">Se fija en el torneo y llega como aviso a todos los inscritos.</span>
      <textarea className="inp" maxLength={280} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texto del anuncio" />
      <div className="row between"><span className="xs">{text.length}/280</span>
        <button className="btn p sm" disabled={pending || text === (current ?? "")} onClick={() => run(() => setAnnouncement(id, text), { ok: text ? "Anuncio publicado." : "Anuncio quitado." })}>{text ? "Publicar y avisar" : "Quitar anuncio"}</button>
      </div>
    </div>
  );
}
