"use client";
// Piezas de cliente compartidas: avisos flotantes, botones de acción y refresco en tiempo real.
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

type Toast = { tone: "ok" | "err" | "info"; text: string } | null;
const ToastCtx = createContext<(t: Toast) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.tone === "err" ? 6000 : 3200);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <ToastCtx value={setToast}>
      {children}
      {toast && (
        <div className={`toast n4 fade-in ${toast.tone}`} role={toast.tone === "err" ? "alert" : "status"}>
          <Icon name={toast.tone === "err" ? "warn" : toast.tone === "ok" ? "check" : "info"} size={18} weight={2.5} />
          <span className="grow">{toast.text}</span>
          <button className="ib bare" style={{ width: 32, height: 32, color: "inherit" }} onClick={() => setToast(null)} aria-label="Cerrar aviso">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </ToastCtx>
  );
}

export const useToast = () => useContext(ToastCtx);

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

/** Ejecuta una acción del servidor, muestra el resultado y refresca la pantalla. */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<Result>, opts: { ok?: string; then?: (data: unknown) => void } = {}) =>
      new Promise<Result>((resolve) => {
        start(async () => {
          let r: Result;
          // Sin conexión o con el servidor caído la acción lanza: también se avisa.
          try { r = await fn(); } catch (e) {
            // Las redirecciones de Next llegan como error: deben seguir su camino para que la pantalla cambie.
            unstable_rethrow(e);
            r = { ok: false, error: "No hubo conexión con el servidor. Revisa tu internet e inténtalo de nuevo." };
          }
          if (!r.ok) toast({ tone: "err", text: r.error });
          else {
            if (opts.ok) toast({ tone: "ok", text: opts.ok });
            opts.then?.(r.data);
            router.refresh();
          }
          resolve(r);
        });
      }),
    [toast, router],
  );
  return { run, pending };
}

/**
 * Botón que corre una acción del servidor. Desde un Server Component pasa la acción tal cual y sus
 * argumentos en `args` (una función flecha no se puede mandar al cliente); desde un Client Component
 * también se vale una función flecha.
 */
export function ActionButton({
  action, args, children, className = "btn p", ok, confirm, disabled, then, ...rest
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (...a: any[]) => Promise<Result>; args?: unknown[]; children: ReactNode; className?: string; ok?: string; confirm?: string; disabled?: boolean;
  then?: (data: unknown) => void; "aria-label"?: string; style?: React.CSSProperties;
}) {
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        void run(() => action(...(args ?? [])), { ok, then });
      }}
      {...rest}
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}

/** Escucha cambios de tablas y refresca la pantalla (con un pequeño retraso para agrupar cambios). */
export function LiveRefresh({ channel, watch }: { channel: string; watch: { table: string; filter?: string }[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(watch);
  useEffect(() => {
    const supabase = supabaseBrowser();
    const ch = supabase.channel(channel);
    for (const w of JSON.parse(key) as { table: string; filter?: string }[]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 350);
      });
    }
    ch.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(ch);
    };
  }, [channel, key, router]);
  return null;
}

/** Cuenta regresiva hh:mm:ss o mm:ss. */
export function Countdown({ to, paused, className, style }: { to: string | null; paused?: string | null; className?: string; style?: React.CSSProperties }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);
  if (!to) return null;
  const ms = paused ? parseInterval(paused) : Math.max(0, new Date(to).getTime() - now);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const txt = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return <span className={className} style={style} role="timer" aria-live="off">{txt}</span>;
}

function parseInterval(v: string): number {
  const m = /(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/.exec(v);
  if (!m) return 0;
  return ((Number(m[1] ?? 0) * 3600) + Number(m[2]) * 60 + Number(m[3])) * 1000;
}

export function CopyButton({ text, label = "Copiar", className = "btn s sm" }: { text: string; label?: string; className?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ tone: "ok", text: "Copiado" });
        } catch {
          toast({ tone: "err", text: "No se pudo copiar. Mantén presionado para seleccionarlo." });
        }
      }}
      aria-label={`${label}: ${text}`}
    >
      <Icon name="copy" size={18} />
      {label}
    </button>
  );
}
