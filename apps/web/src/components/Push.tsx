"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deletePush, pushPublicKey, savePush } from "@/actions/profile";
import { useToast } from "@/components/client";
import { Icon } from "@/components/Icon";


function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registra el service worker al cargar la app. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function usePushState() {
  const [state, setState] = useState<"loading" | "unsupported" | "needs-install" | "off" | "on" | "denied">("loading");
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const ios = /iphone|ipad/i.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        return setState(ios && !standalone ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);
  return [state, setState] as const;
}

export async function enablePush(): Promise<string | null> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Sin permiso no podemos avisarte de tus rondas.";
  const key = await pushPublicKey();
  if (!key.ok || !key.data) return "Los avisos todavía no están listos. Inténtalo en un minuto.";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key.data) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const r = await savePush(j.endpoint, j.keys.p256dh, j.keys.auth);
  return r.ok ? null : r.error;
}

export function PushToggle() {
  const [state, setState] = usePushState();
  const toast = useToast();
  const label = { loading: "Revisando…", unsupported: "Este navegador no recibe avisos", "needs-install": "Instala la app para recibir avisos", off: "Desactivados", on: "Activados", denied: "Bloqueados en el navegador" }[state];
  return (
    <button className="li n4" disabled={state === "loading" || state === "unsupported" || state === "denied"} onClick={async () => {
      if (state === "needs-install") return window.location.assign("/instalar");
      if (state === "on") {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await deletePush(sub.endpoint); await sub.unsubscribe(); }
        setState("off");
        return;
      }
      const err = await enablePush();
      if (err) toast({ tone: "err", text: err }); else { setState("on"); toast({ tone: "ok", text: "Avisos activados." }); }
    }}>
      <Icon name="bell" />
      <span className="grow"><span className="ttl">Avisos en este teléfono</span><span className="xs">{label}</span></span>
      <span className={state === "on" ? "ok" : "muted"}><Icon name={state === "on" ? "check" : "right"} size={20} /></span>
    </button>
  );
}

/** Invitación a activar los avisos para quien está inscrito en un torneo y no los tiene en este teléfono. */
export function PushNudge() {
  const [state, setState] = usePushState();
  const toast = useToast();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let until = 0;
    try { until = Number(localStorage.getItem("reta:aviso-push-oculto") ?? 0); } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se decide al montar según lo que el jugador ocultó
    setHidden(Date.now() < until);
  }, []);
  if (hidden || !["off", "needs-install", "denied"].includes(state)) return null;
  const hide = () => {
    try { localStorage.setItem("reta:aviso-push-oculto", String(Date.now() + 24 * 3_600_000)); } catch { /* nada */ }
    setHidden(true);
  };
  return (
    <div className="box n4 col" role="region" aria-label="Activar avisos" style={{ gap: 10 }}>
      <span className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <Icon name="bell" size={22} />
        <span className="col" style={{ gap: 4 }}>
          <b>Activa los avisos en este teléfono</b>
          <span className="sm">
            {state === "denied"
              ? "Los bloqueaste en el navegador. Permite las notificaciones de retatcg.vercel.app en la configuración del navegador para que te llegue el check-in y tu mesa."
              : state === "needs-install"
                ? "En iPhone primero instala Reta en tu pantalla de inicio. Así te llega el check-in y tu mesa aunque no tengas la app abierta."
                : "Así te llega el recordatorio, la apertura del check-in y tu mesa con el rival, aunque no tengas la app abierta."}
          </span>
        </span>
      </span>
      <div className="row wrap" style={{ gap: 8 }}>
        {state === "off" && (
          <button className="btn p sm" disabled={busy} onClick={async () => {
            setBusy(true);
            const err = await enablePush().catch(() => "No se pudieron activar. Inténtalo desde Ajustes.");
            setBusy(false);
            if (err) toast({ tone: "err", text: err }); else { setState("on"); toast({ tone: "ok", text: "Avisos activados." }); }
          }}><Icon name="bell" size={18} />{busy ? "Activando…" : "Activar avisos"}</button>
        )}
        {state === "needs-install" && <Link className="btn p sm" href="/instalar"><Icon name="dl" size={18} />Cómo instalar</Link>}
        <button className="btn g sm" onClick={hide}>Ahora no</button>
      </div>
    </div>
  );
}
