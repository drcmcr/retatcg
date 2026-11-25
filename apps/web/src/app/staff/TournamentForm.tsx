"use client";
import { useMemo, useState, useTransition } from "react";
import { estimateTournamentMinutes, estimateWindowDays, recommendedSwissRounds, recommendedTopCut } from "@reta/torneo";
import { createTournament, updateTournament } from "@/actions/staff";
import { useToast } from "@/components/client";
import { Icon } from "@/components/Icon";
import { CATEGORY } from "@/lib/game";
import { RANK_NAMES } from "@/lib/ranks";
import { describeRestrictions, type Restrictions } from "@/lib/restrictions";

type Session = { startsAt: string; rounds: string };
export type FormValue = {
  name: string; club: string; category: string; format: string; swiss_rounds: number; top_cut: number; swiss_best_of: number; top_best_of: number;
  pace: string; windowHours: number; sessions: Session[]; starts_at: string; checkin_minutes: number; capacity: number; deck_policy: string;
  restrictions: Restrictions; min_rank: number; prizes: string; notes: string; round_minutes: string; expected: number;
};

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function defaultForm(): FormValue {
  const d = new Date(Date.now() + 2 * 86400000); d.setHours(18, 0, 0, 0);
  return {
    name: "", club: "", category: "comunitario", format: "swiss_topcut", swiss_rounds: 5, top_cut: 4, swiss_best_of: 1, top_best_of: 3,
    pace: "en_vivo", windowHours: 24, sessions: [{ startsAt: toLocal(d), rounds: "1,2,3" }], starts_at: toLocal(d), checkin_minutes: 30, capacity: 32,
    deck_policy: "por_ronda", restrictions: {}, min_rank: 0, prizes: "", notes: "", round_minutes: "", expected: 24,
  };
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function TournamentForm({ initial, id, locked, superadmin }: { initial?: FormValue; id?: string; locked?: boolean; superadmin?: boolean }) {
  const [f, setF] = useState<FormValue>(initial ?? defaultForm());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const set = <K extends keyof FormValue>(k: K, v: FormValue[K]) => setF((x) => ({ ...x, [k]: v }));
  const setR = (patch: Partial<Restrictions>) => setF((x) => ({ ...x, restrictions: { ...x.restrictions, ...patch } }));
  const rules = describeRestrictions(f.restrictions);
  const effPolicy = f.deck_policy === "libre" && rules.length ? "por_ronda" : f.deck_policy;

  const estimate = useMemo(() => {
    const top = f.format === "swiss_topcut" ? f.top_cut : f.format === "single_elim" ? f.expected : 0;
    const swiss = f.format === "single_elim" ? 0 : f.swiss_rounds;
    if (f.pace === "ventana") return `${estimateWindowDays({ swissRounds: swiss, topCut: top, windowHours: f.windowHours })} días`;
    const mins = estimateTournamentMinutes({ players: Math.max(2, f.expected), swissBestOf: f.swiss_best_of as 1 | 3, topCut: top, topCutBestOf: f.top_best_of as 1 | 3 });
    return `≈ ${(mins / 60).toFixed(1)} h`;
  }, [f]);

  function payload(): Record<string, unknown> {
    const pace = f.pace === "ventana" ? { kind: "ventana", windowHours: f.windowHours }
      : f.pace === "jornadas" ? { kind: "jornadas", sessions: f.sessions.map((s) => ({ startsAt: new Date(s.startsAt).toISOString(), rounds: s.rounds.split(/[,\s]+/).map(Number).filter(Boolean) })) }
      : { kind: "en_vivo" };
    const startsAt = f.pace === "jornadas" && f.sessions[0] ? new Date(f.sessions[0].startsAt) : new Date(f.starts_at);
    const base: Record<string, unknown> = {
      name: f.name, club: f.club, swiss_rounds: f.swiss_rounds, top_cut: f.top_cut, swiss_best_of: f.swiss_best_of, top_best_of: f.top_best_of,
      pace, starts_at: startsAt.toISOString(), checkin_minutes: f.checkin_minutes, capacity: f.capacity, min_rank: f.min_rank,
      prizes: f.prizes, notes: f.notes, round_minutes: f.round_minutes,
    };
    if (!locked) Object.assign(base, { category: f.category, format: f.format, deck_policy: f.deck_policy, restrictions: f.restrictions });
    return base;
  }

  function submit(publish: boolean) {
    setError(null);
    if (f.name.trim().length < 3) return setError("Ponle nombre al torneo.");
    start(async () => {
      const r = id ? await updateTournament(id, payload()) : await createTournament(payload(), publish);
      if (r && !r.ok) return setError(r.error);
      if (id) toast({ tone: "ok", text: "Cambios guardados." });
    });
  }

  return (
    <div className="grid2">
      <div className="col" style={{ gap: 18 }}>
        <section className="col" style={{ gap: 12 }}>
          <span className="lbl">Lo básico</span>
          <div className="grid2" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
            <div className="fld"><label htmlFor="n">Nombre</label><input id="n" className="inp" value={f.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="Copa Nocturna #13" /></div>
            <div className="fld"><label htmlFor="c">Club u organización</label><input id="c" className="inp" value={f.club} maxLength={40} onChange={(e) => set("club", e.target.value)} /></div>
          </div>
          <div className="fld"><span className="flabel">Categoría</span>
            <Seg label="Categoría" value={f.category} onChange={(v) => !locked && set("category", v)} options={Object.entries(CATEGORY).map(([k, v]) => [k, `${v.label} · ${v.pr}`])} />
            {["clasificatorio", "mayor"].includes(f.category) && !superadmin && <span className="hint"><Icon name="info" size={15} />Clasificatorios y Mayores esperan la aprobación del superadmin.</span>}
          </div>
        </section>

        <section className="col" style={{ gap: 12 }}>
          <span className="lbl">Formato y ritmo</span>
          <Seg label="Formato" value={f.format} onChange={(v) => !locked && set("format", v)} options={[["swiss_topcut", "Suizo + top cut"], ["swiss", "Solo suizo"], ["single_elim", "Eliminación directa"]]} />
          <div className="grid4">
            <div className="fld"><label htmlFor="exp">Jugadores esperados</label><input id="exp" className="inp" type="number" min={2} max={256} value={f.expected}
              onChange={(e) => { const n = Number(e.target.value); setF((x) => ({ ...x, expected: n, swiss_rounds: recommendedSwissRounds(n) || x.swiss_rounds, top_cut: x.format === "swiss_topcut" ? (recommendedTopCut(n) || 4) : x.top_cut })); }} /></div>
            {f.format !== "single_elim" && <div className="fld"><label htmlFor="sr">Rondas suizas</label><input id="sr" className="inp" type="number" min={1} max={12} value={f.swiss_rounds} onChange={(e) => set("swiss_rounds", Number(e.target.value))} /></div>}
            {f.format === "swiss_topcut" && <div className="fld"><label htmlFor="tc">Top cut</label><select id="tc" className="inp" value={f.top_cut} onChange={(e) => set("top_cut", Number(e.target.value))}>{[2, 4, 8, 16].map((n) => <option key={n} value={n}>Top {n}</option>)}</select></div>}
            <div className="fld"><label htmlFor="cap">Cupo</label><input id="cap" className="inp" type="number" min={2} max={256} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} /></div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {f.format !== "single_elim" && <div className="fld"><span className="flabel">Partidas del suizo</span><Seg label="Partidas del suizo" value={f.swiss_best_of} onChange={(v) => set("swiss_best_of", v)} options={[[1, "Bo1"], [3, "Bo3"]]} /></div>}
            {f.format !== "swiss" && <div className="fld"><span className="flabel">Partidas de eliminación</span><Seg label="Partidas de eliminación" value={f.top_best_of} onChange={(v) => set("top_best_of", v)} options={[[1, "Bo1"], [3, "Bo3"]]} /></div>}
          </div>
          <Seg label="Ritmo" value={f.pace} onChange={(v) => set("pace", v)} options={[["en_vivo", "En vivo"], ["jornadas", "Por jornadas"], ["ventana", "Por ventana"]]} />
          {f.pace === "en_vivo" && (
            <div className="grid3">
              <div className="fld"><label htmlFor="st">Inicio</label><input id="st" className="inp" type="datetime-local" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div className="fld"><label htmlFor="ci">Check-in (min antes)</label><input id="ci" className="inp" type="number" min={5} max={180} value={f.checkin_minutes} onChange={(e) => set("checkin_minutes", Number(e.target.value))} /></div>
              <div className="fld"><label htmlFor="rm">Minutos por ronda</label><input id="rm" className="inp" type="number" min={10} max={120} placeholder={f.swiss_best_of === 3 ? "50" : "25"} value={f.round_minutes} onChange={(e) => set("round_minutes", e.target.value)} /></div>
            </div>
          )}
          {f.pace === "ventana" && (
            <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="fld"><label htmlFor="st2">Empieza</label><input id="st2" className="inp" type="datetime-local" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div className="fld"><span className="flabel">Plazo por ronda</span><Seg label="Plazo por ronda" value={f.windowHours} onChange={(v) => set("windowHours", v)} options={[[24, "24 h"], [48, "48 h"]]} /></div>
            </div>
          )}
          {f.pace === "jornadas" && (
            <div className="col">
              {f.sessions.map((s, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                  <div className="fld grow"><label htmlFor={`j${i}`}>Jornada {i + 1}</label><input id={`j${i}`} className="inp" type="datetime-local" value={s.startsAt} onChange={(e) => set("sessions", f.sessions.map((x, k) => (k === i ? { ...x, startsAt: e.target.value } : x)))} /></div>
                  <div className="fld" style={{ width: 160 }}><label htmlFor={`r${i}`}>Rondas</label><input id={`r${i}`} className="inp mono" value={s.rounds} onChange={(e) => set("sessions", f.sessions.map((x, k) => (k === i ? { ...x, rounds: e.target.value } : x)))} placeholder="1,2,3" /></div>
                  <button type="button" className="ib" aria-label="Quitar jornada" onClick={() => set("sessions", f.sessions.filter((_, k) => k !== i))}><Icon name="trash" size={18} /></button>
                </div>
              ))}
              <button type="button" className="btn g sm" onClick={() => set("sessions", [...f.sessions, { startsAt: f.sessions.at(-1)?.startsAt ?? f.starts_at, rounds: "" }])}><Icon name="plus" size={18} />Agregar jornada</button>
              <span className="hint">El check-in de cada jornada abre 30 minutos antes.</span>
            </div>
          )}
        </section>

        <section className="col" style={{ gap: 12 }}>
          <span className="lbl">Mazo y restricciones</span>
          <Seg label="Regla de mazo" value={f.deck_policy} onChange={(v) => !locked && set("deck_policy", v)} options={[["libre", "Libre"], ["por_ronda", "Por ronda"], ["fijo", "Fijo"]]} />
          {f.deck_policy === "libre" && rules.length > 0 && <span className="hint"><Icon name="info" size={15} />Con restricciones, el mazo libre sube a “por ronda” para poder revisarlo.</span>}
          <div className="grid3">
            <div className="fld"><label htmlFor="sets">Sets hasta</label><input id="sets" className="inp" value={f.restrictions.upToSetName ?? ""} onChange={(e) => setR({ upToSetName: e.target.value || undefined })} placeholder="Sin límite" disabled={locked} /></div>
            <div className="fld"><label htmlFor="ex">Pokémon ex</label>
              <select id="ex" className="inp" disabled={locked} value={f.restrictions.ex?.kind ?? "permitidos"} onChange={(e) => setR({ ex: e.target.value === "permitidos" ? undefined : { kind: e.target.value, count: e.target.value === "maximo" ? 2 : undefined } })}>
                <option value="permitidos">Permitidos</option><option value="sin_mega">Sin Mega ex</option><option value="prohibidos">Prohibidos</option><option value="solo_ex">Solo ex</option><option value="maximo">Máximo por mazo</option>
              </select>
            </div>
            {f.restrictions.ex?.kind === "maximo" && <div className="fld"><label htmlFor="exm">Máximo de ex</label><input id="exm" className="inp" type="number" min={1} max={20} value={f.restrictions.ex.count ?? 2} onChange={(e) => setR({ ex: { kind: "maximo", count: Number(e.target.value) } })} disabled={locked} /></div>}
          </div>
          <div className="fld"><label htmlFor="ban">Cartas prohibidas (separadas por coma)</label><input id="ban" className="inp" disabled={locked} value={(f.restrictions.bannedCards ?? []).join(", ")} onChange={(e) => setR({ bannedCards: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>
          <div className="row wrap" style={{ gap: 16 }}>
            {([["onlyDiamondRarity", "Solo rareza de rombos"], ["noPromos", "Sin promos"]] as const).map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" disabled={locked} checked={!!f.restrictions[k]} onChange={(e) => setR({ [k]: e.target.checked || undefined })} /><span className="cb">{f.restrictions[k] && <Icon name="check" size={16} weight={3} />}</span><span>{l}</span></label>
            ))}
          </div>
          <div className="fld"><label htmlFor="free">Otra regla (la revisa el juez)</label><input id="free" className="inp" disabled={locked} value={f.restrictions.freeText ?? ""} maxLength={140} onChange={(e) => setR({ freeText: e.target.value || undefined })} /></div>
        </section>

        <section className="col" style={{ gap: 12 }}>
          <span className="lbl">Detalles</span>
          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="fld"><label htmlFor="mr">Rango mínimo</label><select id="mr" className="inp" value={f.min_rank} onChange={(e) => set("min_rank", Number(e.target.value))}>{RANK_NAMES.slice(0, 6).map((r, i) => <option key={r} value={i}>{i === 0 ? "Ninguno" : r}</option>)}</select></div>
            <div className="fld"><label htmlFor="pz">Premios</label><input id="pz" className="inp" maxLength={200} value={f.prizes} onChange={(e) => set("prizes", e.target.value)} placeholder="Opcional" /></div>
          </div>
          <div className="fld"><label htmlFor="nt">Notas para los jugadores</label><textarea id="nt" className="inp" maxLength={1000} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </section>
      </div>

      <aside className="col" style={{ gap: 12, position: "sticky", top: 22 }}>
        <div className="box n6 col edge-c" style={{ gap: 8 }}>
          <span className="lbl">Duración estimada</span>
          <span className="px20 cyan" style={{ fontSize: 56, lineHeight: 1 }}>{estimate}</span>
          <span className="sm">{f.pace === "ventana" ? "Peor caso: cada ronda usa todo su plazo. Termina antes si las mesas cierran a tiempo." : "Peor caso: cada ronda agota su reloj."}</span>
        </div>
        <div className="box n4 col" style={{ gap: 6 }}>
          <span className="lbl" style={{ fontSize: 16 }}>Así lo ven los jugadores</span>
          <span className="sm">Mazo {effPolicy === "por_ronda" ? "por ronda" : effPolicy}. {rules.length ? rules.join(". ") + "." : "Sin restricciones."}</span>
        </div>
        {error && <div className="banner err n4" role="alert"><Icon name="warn" size={18} />{error}</div>}
        {id ? (
          <button className="btn p" disabled={pending} onClick={() => submit(false)}>{pending ? "Guardando…" : "Guardar cambios"}</button>
        ) : (
          <>
            <button className="btn p" disabled={pending} onClick={() => submit(true)}>{pending ? "Creando…" : "Crear y abrir inscripción"}</button>
            <button className="btn g" disabled={pending} onClick={() => submit(false)}>Guardar como borrador</button>
          </>
        )}
      </aside>
    </div>
  );
}
