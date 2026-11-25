"use client";
import { useEffect, useState } from "react";
import { deletePush, savePush } from "@/actions/profile";
import { useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) {
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
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY!) });
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
