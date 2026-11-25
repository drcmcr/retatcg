import { Medal } from "@/components/Medal";
import { Prog, TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { MEDAL_INFO, MEDALS } from "@/lib/game";
import { FINAL_INVITE_MEDALS } from "@reta/torneo";

export const metadata = { title: "Medallas" };

export default async function Medallas() {
  const me = await requireMe("/perfil/medallas");
  const have = me.medals.length;
  return (
    <main className="screen">
      <TopBar title="Medallas" back="/perfil" />
      <div className="box n4 col" style={{ gap: 6 }}>
        <div className="row between"><b>Final de Temporada</b><span className="mono">{Math.min(have, FINAL_INVITE_MEDALS)} / {FINAL_INVITE_MEDALS}</span></div>
        <Prog filled={Math.min(have, FINAL_INVITE_MEDALS)} of={FINAL_INVITE_MEDALS} />
        <span className="xs">{have >= FINAL_INVITE_MEDALS ? "¡Tienes tu invitación a la Final!" : `Te ${FINAL_INVITE_MEDALS - have === 1 ? "falta 1 medalla" : `faltan ${FINAL_INVITE_MEDALS - have} medallas`} para la invitación.`}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        {MEDALS.map((m) => {
          const on = me.medals.includes(m);
          return (
            <div key={m} className="box n4 row" style={{ gap: 8, padding: 8, alignItems: "flex-start" }}>
              <Medal code={m} size={40} state={on ? "on" : "off"} />
              <div className="col" style={{ gap: 1 }}>
                <span className="px" style={{ fontSize: 18, lineHeight: 1, color: on ? "var(--ink)" : "var(--ink-2)" }}>{MEDAL_INFO[m].name}</span>
                <span className="xs" style={{ fontSize: 12, lineHeight: 1.25 }}>{on ? "Ganada" : MEDAL_INFO[m].how}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="xs">Las medallas se reinician cada temporada. El título que desbloquean se queda para siempre.</p>
    </main>
  );
}
