"use client";
import { useEffect, useId, useRef, useState } from "react";
import { searchPlayers, type PlayerHit } from "@/actions/staff";
import { Identicon } from "@/components/Identicon";
import { RANK_NAMES } from "@/lib/ranks";

const ROLE_LABEL: Record<string, string> = { organizer: "Organizador", judge: "Juez" };

/**
 * Campo de usuario con sugerencias (patrón combobox de ARIA): desde 2 letras muestra hasta 8 jugadores.
 * `taken` marca a quien ya tiene el rol y no se puede elegir otra vez.
 */
export function PlayerPicker({ value, onChange, tournamentId, label, disableTaken = false }: {
  value: string; onChange: (v: string) => void; tournamentId?: string; label: string; disableTaken?: boolean;
}) {
  const id = useId();
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const q = value.trim();
    const n = ++seq.current;
    if (q.length < 2) return; // con menos de 2 letras la lista no se muestra
    const t = setTimeout(async () => {
      const r = await searchPlayers(q, tournamentId).catch(() => null);
      if (n !== seq.current) return; // llegó tarde: ya se escribió otra cosa
      setHits(r?.ok ? r.data ?? [] : []);
      setSearched(q);
      setActive(-1);
    }, 200);
    return () => clearTimeout(t);
  }, [value, tournamentId]);

  const pick = (h: PlayerHit) => {
    if (disableTaken && h.role) return;
    onChange(h.username);
    setOpen(false);
    setActive(-1);
  };
  const show = open && value.trim().length >= 2 && searched === value.trim();
  const listId = `${id}-lista`;

  return (
    <div className="picker" style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        className="inp" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={show}
        aria-controls={listId} aria-activedescendant={show && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Escribe 2 letras del usuario"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0 && hits[active]) { e.preventDefault(); pick(hits[active]!); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {show && (
        <ul id={listId} role="listbox" aria-label="Jugadores" className="picker-list">
          {hits.length === 0 && <li className="picker-empty" role="option" aria-disabled="true" aria-selected="false">Ningún jugador con ese nombre</li>}
          {hits.map((h, i) => {
            const off = disableTaken && !!h.role;
            return (
              <li key={h.id} id={`${id}-${i}`} role="option" aria-selected={i === active} aria-disabled={off || undefined}
                className={`picker-opt${i === active ? " on" : ""}${off ? " off" : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                <Identicon seed={h.id} size={28} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ttl">{h.username}</span>
                  <span className="xs">{RANK_NAMES[h.rank_index] ?? RANK_NAMES[0]}</span>
                </span>
                {h.role && <span className="pill">{off ? `Ya es ${ROLE_LABEL[h.role]?.toLowerCase() ?? h.role}` : ROLE_LABEL[h.role] ?? h.role}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
