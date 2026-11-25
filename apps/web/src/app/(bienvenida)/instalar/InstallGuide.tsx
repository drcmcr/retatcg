"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { enablePush, usePushState } from "@/components/Push";
import { useToast } from "@/components/client";
import { Icon } from "@/components/Icon";

const noop = () => () => {};
type BIP = Event & { prompt: () => Promise<void> };

export function InstallGuide() {
  const ios = useSyncExternalStore(noop, () => /iphone|ipad/i.test(navigator.userAgent), () => false);
  const standalone = useSyncExternalStore(noop, () => window.matchMedia("(display-mode: standalone)").matches, () => false);
  const [bip, setBip] = useState<BIP | null>(null);
  const [push, setPush] = usePushState();
  const toast = useToast();
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  return (
    <div className="screen">
      <div className="tb"><span className="grow" /><Link href="/inicio" className="link">Ahora no</Link></div>
      <h1 className="t1">Que no se te pase tu ronda</h1>
      <p className="sm">Te avisamos cuando te emparejen y cuando tu rival reporte.</p>
      {ios && !standalone ? (
        <div className="list">
          {[["share", "1. Toca Compartir", "En la barra de Safari"], ["plus", "2. Agregar a inicio", "Reta queda como app"], ["bell", "3. Activa los avisos", "Desde la app instalada"]].map(([ic, t, s]) => (
            <div key={t} className="li n4"><Icon name={ic as "share"} /><span className="grow"><span className="ttl">{t}</span><span className="xs">{s}</span></span></div>
          ))}
          <p className="xs">En iPhone, los avisos solo funcionan con la app instalada.</p>
        </div>
      ) : (
        <>
          {bip && !standalone && <button className="btn s" onClick={async () => { await bip.prompt(); setBip(null); }}><Icon name="dl" size={20} />Instalar Reta</button>}
          <div className="box n4 row"><Icon name="bell" /><span className="grow sm" style={{ color: "var(--ink)" }}>Avisos: {push === "on" ? "activados" : push === "denied" ? "bloqueados en el navegador" : push === "unsupported" ? "no disponibles aquí" : "sin activar"}</span></div>
        </>
      )}
      {(push === "off") && (
        <button className="btn p mt-a" onClick={async () => { const e = await enablePush(); if (e) toast({ tone: "err", text: e }); else { setPush("on"); toast({ tone: "ok", text: "Avisos activados." }); } }}>Activar avisos</button>
      )}
      <Link href="/inicio" className={`btn ${push === "off" ? "g" : "p mt-a"}`}>Ir a inicio</Link>
    </div>
  );
}
