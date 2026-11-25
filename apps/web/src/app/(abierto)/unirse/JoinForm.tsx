"use client";
import { useState, useTransition } from "react";
import { findByCode } from "@/actions/player";
import { Icon } from "@/components/Icon";

export function JoinForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="col" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await findByCode(code); if (r && !r.ok) setError(r.error); }); }}>
      <label htmlFor="codigo" className="sr-only">Código</label>
      <input id="codigo" className={`inp mono ${error ? "bad" : ""}`} style={{ fontSize: 26, letterSpacing: ".12em", textAlign: "center", textTransform: "uppercase" }}
        value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} placeholder="NOCT-12" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
      {error && <span className="hint err" role="alert"><Icon name="warn" size={15} />{error}</span>}
      <button className="btn p" disabled={pending || code.trim().length < 4}>{pending ? "Buscando…" : "Buscar torneo"}</button>
    </form>
  );
}
