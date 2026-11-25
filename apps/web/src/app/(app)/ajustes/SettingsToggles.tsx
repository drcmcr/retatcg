"use client";
import { setPrivateProfile, updatePrivateData } from "@/actions/profile";
import { useAction } from "@/components/client";
import { Icon, type IconName } from "@/components/Icon";
import { PushToggle } from "@/components/Push";

function Toggle({ on, onChange, label, sub, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string; icon: IconName }) {
  return (
    <button className="li n4" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <Icon name={icon} />
      <span className="grow"><span className="ttl">{label}</span>{sub && <span className="xs">{sub}</span>}</span>
      <span aria-hidden="true" style={{ width: 44, height: 26, padding: 3, background: on ? "var(--lime)" : "var(--card)", boxShadow: on ? "none" : "inset 0 0 0 2px var(--line)", display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
        <i style={{ width: 20, height: 20, background: on ? "var(--bg)" : "var(--line)" }} />
      </span>
    </button>
  );
}

export function SettingsToggles({ isPrivate, notify, reduceMotion, pocket }: { isPrivate: boolean; notify: Record<string, boolean>; reduceMotion: boolean; pocket: { name: string; friendId: string; tz: string } }) {
  const { run } = useAction();
  const save = (n: Record<string, boolean>, rm?: boolean) => run(() => updatePrivateData(pocket.name, pocket.friendId, pocket.tz, n, rm));
  return (
    <div className="list">
      <PushToggle />
      <Toggle icon="trophy" label="Avisos de torneo" sub="Rondas, mesas, casos y anuncios" on={notify.torneo !== false} onChange={(v) => save({ ...notify, torneo: v })} />
      <Toggle icon="users" label="Avisos sociales" sub="Seguidores y actividad" on={!!notify.social} onChange={(v) => save({ ...notify, social: v })} />
      <Toggle icon="eye" label="Perfil privado" sub="Solo te ve quien juega contigo; sales del ranking público" on={isPrivate} onChange={(v) => run(() => setPrivateProfile(v), { ok: v ? "Tu perfil ahora es privado." : "Tu perfil ahora es público." })} />
      <Toggle icon="zap" label="Reducir movimiento" sub="Apaga brillos y animaciones" on={reduceMotion} onChange={(v) => { document.documentElement.dataset.reduceMotion = String(v); save(notify, v); }} />
    </div>
  );
}
