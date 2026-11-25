"use client";
import { useState } from "react";
import { reviewDeck } from "@/actions/staff";
import { useAction } from "@/components/client";

type Deck = { id: string; player: string; archetype: string; round: number; url: string | null; note: string | null };

export function DeckReview({ decks, rules }: { decks: Deck[]; rules: string[] }) {
  const [sel, setSel] = useState(0);
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const d = decks[Math.min(sel, decks.length - 1)]!;
  return (
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0,.7fr) minmax(0,1.7fr)" }}>
      <div className="list">
        {decks.map((x, i) => (
          <button key={x.id} className="li n4" style={i === sel ? { boxShadow: "inset 0 0 0 2px var(--lime)" } : undefined} onClick={() => setSel(i)}>
            <span className="grow ttl" style={{ fontSize: 15 }}>{x.player} · {x.archetype}</span><span className="xs">{x.round ? `R${x.round}` : "Fijo"}</span>
          </button>
        ))}
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
        <div className="chk n6" style={{ padding: 12 }}>
          <div className="panel n4" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
            {d.url ? <a href={d.url} target="_blank" rel="noreferrer"><img src={d.url} alt={`Mazo de ${d.player}`} style={{ maxWidth: "100%", maxHeight: 520 }} /></a> : <span className="sm">No se pudo cargar la captura.</span>}
          </div>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <b className="t2">{d.player}</b>
          <span className="sm">{d.archetype} · {d.round ? `declarado para la ronda ${d.round}` : "mazo fijo"}</span>
          <div className="box n4 col" style={{ gap: 6 }}>
            <span className="lbl" style={{ fontSize: 16 }}>Revisa</span>
            {rules.map((r) => <span key={r} className="sm" style={{ color: "var(--ink)" }}>· {r}</span>)}
          </div>
          <button className="btn p" disabled={pending} onClick={() => run(() => reviewDeck(d.id, true), { ok: "Mazo aprobado." })}>Aprobar</button>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué no cumple (lo ve el jugador)" aria-label="Nota de infracción" />
          <button className="btn d" disabled={pending || !note.trim()} onClick={() => run(() => reviewDeck(d.id, false, note), { ok: "Marcado como infracción. Avisamos al jugador.", then: () => setNote("") })}>Marcar infracción</button>
        </div>
      </div>
    </div>
  );
}
