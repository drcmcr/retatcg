"use client";
import { useState } from "react";
import { addBlockedTerm, adminRenameClub, adminRenameTournament, moderateRename, removeBlockedTerm, testText } from "@/actions/staff";
import { ActionButton, useAction } from "@/components/client";
import { Icon } from "@/components/Icon";

export type Term = { id: number; term: string; kind: string; fields: string[]; whole_word: boolean };
export type Flag = { kind: string; ref: string; value: string; issue: string };

const KINDS: [string, string, string][] = [
  ["ofensivo", "Ofensivo", "Groserías y odio."],
  ["contacto", "Contacto", "Redes y apps para sacar a la gente de Reta. Teléfonos, correos y enlaces ya se bloquean solos."],
  ["marca", "Marca u oficial", "Marcas y palabras que hacen parecer oficial un torneo."],
  ["reservado", "Reservado", "Nombres que suplantan al equipo de Reta o a un juez."],
  ["permitido", "Excepción", "Palabras normales que contienen una bloqueada (computadora, disputa)."],
];
const FIELDS: [string, string][] = [["usuario", "Usuarios"], ["invitado", "Invitados"], ["torneo", "Torneos"], ["club", "Clubes"], ["texto", "Textos"]];
const ISSUE: Record<string, string> = { ofensivo: "Ofensivo", contacto: "Datos de contacto", marca: "Marca u oficial", reservado: "Reservado" };

/** Nombres que ya existían y no pasan el filtro actual. */
export function Flagged({ items }: { items: Flag[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  if (!items.length) return <span className="sm">Todos los nombres actuales pasan el filtro.</span>;
  return (
    <ul className="col" style={{ gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((f) => {
        const key = f.kind + f.ref;
        return (
          <li key={key} className="box card n4 col" style={{ gap: 6 }}>
            <span className="row between wrap" style={{ gap: 8 }}>
              <b style={{ overflowWrap: "anywhere" }}>{f.value}</b>
              <span className="xs warn row" style={{ gap: 4 }}><span style={{ flex: "none", display: "inline-flex" }}><Icon name="warn" size={14} /></span>{f.kind} · {ISSUE[f.issue] ?? f.issue}</span>
            </span>
            {f.kind === "usuario" ? (
              <ActionButton className="btn s sm" action={() => moderateRename(f.ref)} ok="Usuario renombrado. Se le avisó.">Cambiar a nombre genérico</ActionButton>
            ) : open === key ? (
              <div className="col" style={{ gap: 6 }}>
                <input className="inp" value={name} maxLength={f.kind === "club" ? 40 : 60} onChange={(e) => setName(e.target.value)}
                  placeholder={f.kind === "club" ? "Nombre nuevo (vacío = quitar club)" : "Nombre nuevo"} aria-label="Nombre nuevo" />
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn p sm" disabled={pending || (f.kind === "torneo" && name.trim().length < 3)}
                    onClick={() => run(() => (f.kind === "club" ? adminRenameClub(f.value, name) : adminRenameTournament(f.ref, name)),
                      { ok: "Renombrado. Se avisó al organizador.", then: () => { setOpen(null); setName(""); } })}>Guardar</button>
                  <button className="btn g sm" onClick={() => setOpen(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn s sm" onClick={() => { setOpen(key); setName(""); }}>Renombrar</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lista editable del filtro. */
export function TermList({ terms }: { terms: Term[] }) {
  const [kind, setKind] = useState("ofensivo");
  const [term, setTerm] = useState("");
  const [fields, setFields] = useState<string[]>(FIELDS.map(([k]) => k));
  const [whole, setWhole] = useState(false);
  const { run, pending } = useAction();
  const shown = terms.filter((t) => t.kind === kind);
  const hint = KINDS.find(([k]) => k === kind)![2];
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="fld"><label htmlFor="bt-kind">Tipo</label>
        <select id="bt-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([k, l]) => <option key={k} value={k}>{l} · {terms.filter((t) => t.kind === k).length}</option>)}
        </select>
      </div>
      <span className="xs">{hint}</span>
      <div className="row wrap" style={{ gap: 6 }}>
        {shown.map((t) => (
          <span key={t.id} className="pill o" style={{ gap: 2, paddingRight: 0 }} title={`Aplica en: ${t.fields.join(", ")}${t.whole_word ? " · palabra completa" : ""}`}>
            {t.term}{t.whole_word ? " ⌴" : ""}
            <ActionButton className="ib bare" style={{ width: 28, height: 28 }} aria-label={`Quitar ${t.term}`} action={() => removeBlockedTerm(t.id)} ok="Quitada."
              confirm={`¿Quitar "${t.term}" del filtro?`}><Icon name="x" size={14} /></ActionButton>
          </span>
        ))}
        {!shown.length && <span className="sm">Sin palabras de este tipo.</span>}
      </div>
      {shown.some((t) => t.whole_word) && <span className="xs">⌴ = solo cuenta como palabra completa.</span>}
      <div className="box card n4 col" style={{ gap: 8 }}>
        <div className="fld"><label htmlFor="bt-term">Agregar a {KINDS.find(([k]) => k === kind)![1].toLowerCase()}</label>
          <input id="bt-term" className="inp" value={term} maxLength={40} onChange={(e) => setTerm(e.target.value)} placeholder="Palabra o frase" /></div>
        <fieldset className="row wrap" style={{ gap: 10, border: 0, padding: 0, margin: 0 }}>
          <legend className="xs" style={{ marginBottom: 4 }}>Dónde aplica</legend>
          {FIELDS.map(([k, l]) => (
            <label key={k} className="row sm" style={{ gap: 6 }}>
              <input type="checkbox" style={{ flex: "none" }} checked={fields.includes(k)} onChange={(e) => setFields(e.target.checked ? [...fields, k] : fields.filter((x) => x !== k))} />{l}
            </label>
          ))}
        </fieldset>
        <label className="row sm" style={{ gap: 8, alignItems: "flex-start" }}>
          <input type="checkbox" style={{ flex: "none", marginTop: 3 }} checked={whole} onChange={(e) => setWhole(e.target.checked)} />
          Solo como palabra completa (para palabras cortas que aparecen dentro de otras)
        </label>
        <button className="btn p sm" disabled={pending || term.trim().length < 2 || !fields.length}
          onClick={() => run(() => addBlockedTerm(term.trim(), kind, fields, whole), { ok: "Agregada.", then: () => setTerm("") })}>Agregar</button>
        <span className="xs">Se ignoran acentos, mayúsculas, separadores, letras repetidas y cambios como 0 por o.</span>
      </div>
    </div>
  );
}

/** Prueba un texto y renombra por código o por club, sin depender de la lista de revisión. */
export function NameTools() {
  const [txt, setTxt] = useState("");
  const [field, setField] = useState("torneo");
  const [res, setRes] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [tName, setTName] = useState("");
  const [club, setClub] = useState("");
  const [club2, setClub2] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="col" style={{ gap: 6 }}>
        <span className="lbl" style={{ fontSize: 16 }}>Probar un texto</span>
        <select className="inp" value={field} onChange={(e) => { setField(e.target.value); setRes(undefined); }} aria-label="Dónde se usa">
          {FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input className="inp" value={txt} onChange={(e) => { setTxt(e.target.value); setRes(undefined); }} placeholder="Texto a probar" aria-label="Texto a probar" />
        <button className="btn s sm" disabled={pending || !txt.trim()} onClick={() => run(() => testText(txt, field), { then: (d) => setRes((d as string | null) ?? null) })}>Probar</button>
        {res !== undefined && (res === null
          ? <span className="sm ok row" style={{ gap: 4 }}><span style={{ flex: "none", display: "inline-flex" }}><Icon name="check" size={15} /></span>Pasa el filtro.</span>
          : <span className="sm err row" style={{ gap: 4 }}><span style={{ flex: "none", display: "inline-flex" }}><Icon name="warn" size={15} /></span>Se bloquea: {ISSUE[res] ?? res}.</span>)}
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="lbl" style={{ fontSize: 16 }}>Renombrar torneo</span>
        <input className="inp mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código del torneo" aria-label="Código del torneo" />
        <input className="inp" value={tName} maxLength={60} onChange={(e) => setTName(e.target.value)} placeholder="Nombre nuevo" aria-label="Nombre nuevo del torneo" />
        <button className="btn s sm" disabled={pending || !code.trim() || tName.trim().length < 3}
          onClick={() => run(() => adminRenameTournament(code, tName), { ok: "Torneo renombrado. Se avisó al organizador.", then: () => { setCode(""); setTName(""); } })}>Renombrar torneo</button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="lbl" style={{ fontSize: 16 }}>Renombrar club</span>
        <input className="inp" value={club} maxLength={40} onChange={(e) => setClub(e.target.value)} placeholder="Nombre actual" aria-label="Nombre actual del club" />
        <input className="inp" value={club2} maxLength={40} onChange={(e) => setClub2(e.target.value)} placeholder="Nombre nuevo (vacío = quitar)" aria-label="Nombre nuevo del club" />
        <button className="btn s sm" disabled={pending || !club.trim()}
          onClick={() => run(() => adminRenameClub(club, club2), { ok: "Club renombrado en todos sus torneos.", then: () => { setClub(""); setClub2(""); } })}>Renombrar club</button>
        <span className="xs">Úsalo también si un titular de derechos pide un cambio. Al organizador le llega un aviso.</span>
      </div>
    </div>
  );
}
