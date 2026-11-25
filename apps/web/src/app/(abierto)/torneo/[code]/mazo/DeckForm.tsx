"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { declareDeck } from "@/actions/player";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";
import { CaptureUpload } from "@/components/Upload";

export function DeckForm({ tournamentId, userId, round, rules, initialArchetype, code }: { tournamentId: string; userId: string; round: number; rules: string[]; initialArchetype: string; code: string }) {
  const [archetype, setArchetype] = useState(initialArchetype);
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>(() => [false, ...rules.map(() => false)]);
  const { run, pending } = useAction();
  const router = useRouter();
  const allChecked = checks.every(Boolean);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="fld">
        <label htmlFor="arq">Arquetipo</label>
        <input id="arq" className="inp" value={archetype} maxLength={40} onChange={(e) => setArchetype(e.target.value)} placeholder="Ej. Agua · Control" />
      </div>
      <div className="chk n6" style={{ padding: 12 }}>
        <div className="panel n4 col" style={{ alignItems: "center", gap: 8 }}>
          {preview ? <img src={preview} alt="Captura de tu mazo" style={{ maxWidth: "100%", maxHeight: 280 }} /> : <span className="sm">La captura debe mostrar las 20 cartas.</span>}
        </div>
      </div>
      <CaptureUpload tournamentId={tournamentId} userId={userId} label={preview ? "Cambiar captura" : "Subir captura del mazo"} onUploaded={(p, url) => { setPath(p); setPreview(url); }} />
      <div className="col">
        <span className="lbl">Revisa tu mazo</span>
        {["20 cartas, máximo 2 copias por nombre", ...rules].map((r, i) => (
          <label key={r} className="check">
            <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((c) => c.map((v, k) => (k === i ? e.target.checked : v)))} />
            <span className="cb">{checks[i] && <Icon name="check" size={16} weight={3} />}</span>
            <span>{r}</span>
          </label>
        ))}
      </div>
      <button className="btn p" disabled={!path || archetype.trim().length < 2 || !allChecked || pending}
        onClick={() => run(() => declareDeck(tournamentId, round, archetype, path!), { ok: "Mazo enviado al staff.", then: () => router.push(`/torneo/${code}`) })}>
        {pending ? "Enviando…" : "Enviar mazo"}
      </button>
    </div>
  );
}
