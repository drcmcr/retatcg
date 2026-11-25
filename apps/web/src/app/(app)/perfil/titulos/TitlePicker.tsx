"use client";
import Link from "next/link";
import { MEDAL_TITLES } from "@reta/torneo";
import { setTitle } from "@/actions/profile";
import { useAction } from "@/components/client";
import { Medal } from "@/components/Medal";
import { MEDAL_INFO, MEDALS, titleText, type MedalCode } from "@/lib/game";

export function TitlePicker({ unlocked, current, form, username }: { unlocked: string[]; current: string | null; form: string; username: string }) {
  const { run, pending } = useAction();
  const text = titleText(current, form);
  return (
    <>
      <div className="box n4 col" style={{ gap: 6 }}>
        <span className="xs">Así se ve en tu tarjeta</span>
        <b style={{ fontSize: 20 }}>{username}</b>
        {text ? <span className="row" style={{ gap: 6 }}><Medal code={current as MedalCode} size={22} /><span className="px lime" style={{ fontSize: 20 }}>{text}</span></span> : <span className="xs">Sin título</span>}
        <div className="row" style={{ gap: 8 }}>
          <Link href="/perfil/compartir" className="btn p sm">Compartir tarjeta</Link>
          {current && <button className="btn g sm" disabled={pending} onClick={() => run(() => setTitle(null), { ok: "Sin título." })}>Sin título</button>}
        </div>
      </div>
      <div className="list">
        {MEDALS.map((m) => {
          const info = MEDAL_TITLES[m];
          const has = unlocked.includes(m);
          const inUse = current === m;
          return (
            <div key={m} className="box n4 col" style={{ gap: 8, opacity: has ? 1 : 0.55, boxShadow: inUse ? "inset 0 0 0 2px var(--lime)" : undefined }}>
              <div className="row">
                <Medal code={m} size={36} state={has ? "on" : "off"} />
                <div className="grow col" style={{ gap: 0 }}>
                  <b className="px" style={{ fontSize: 20 }}>{info.forms.join(" / ")}</b>
                  <span className="xs">Medalla {MEDAL_INFO[m].name}{has ? "" : ` · ${MEDAL_INFO[m].how}`}</span>
                </div>
                {inUse && <span className="px lime" style={{ fontSize: 16 }}>En uso</span>}
              </div>
              {has && (
                info.forms.length === 2 ? (
                  <div className="row" style={{ gap: 8 }}>
                    {info.forms.map((f, i) => {
                      const code = i === 0 ? "a" : "b";
                      const on = inUse && form === code;
                      return <button key={f} className={`btn sm ${on ? "p" : "g"}`} style={{ flex: 1 }} disabled={pending || on} onClick={() => run(() => setTitle(m, code), { ok: `Ahora eres ${f}.` })}>{f}</button>;
                    })}
                  </div>
                ) : !inUse && <button className="btn g sm" disabled={pending} onClick={() => run(() => setTitle(m, "a"), { ok: `Ahora eres ${info.forms[0]}.` })}>Usar</button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
