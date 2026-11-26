"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendCode, verifyCode } from "@/actions/auth";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/client";

const LEN = 6;

export function CodeForm({ email, next }: { email: string; next?: string }) {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(45);
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function submit(code: string) {
    start(async () => {
      const r = await verifyCode(email, code);
      if (!r.ok) {
        setError(r.error);
        setDigits(Array(LEN).fill(""));
        refs.current[0]?.focus();
        return;
      }
      const safe = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
      // Cuenta nueva: primero el registro y luego de vuelta a donde iba (por ejemplo, el torneo).
      const dest = r.data!.next === "/inicio" ? (safe ?? "/inicio") : safe ? `${r.data!.next}?siguiente=${encodeURIComponent(safe)}` : r.data!.next;
      router.replace(dest);
      router.refresh();
    });
  }

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pegar o autocompletar: reparte los dígitos.
      const all = clean.slice(0, LEN).split("");
      const nd = Array.from({ length: LEN }, (_, k) => all[k] ?? "");
      setDigits(nd);
      if (all.length === LEN) submit(all.join(""));
      else refs.current[all.length]?.focus();
      return;
    }
    const nd = digits.slice();
    nd[i] = clean;
    setDigits(nd);
    setError(null);
    if (clean && i < LEN - 1) refs.current[i + 1]?.focus();
    if (nd.every(Boolean)) submit(nd.join(""));
  }

  return (
    <div className="col" style={{ gap: 14, flex: 1 }}>
      <div className="tb">
        <Link href="/entrar" className="ib" aria-label="Volver"><Icon name="back" /></Link>
      </div>
      <h1 className="t1">Escribe tu código</h1>
      <p className="sm">Lo mandamos a <b style={{ color: "var(--ink)" }}>{email}</b>. Vence en 10 minutos. Si llegó un enlace, también funciona.</p>
      <fieldset className="otp" style={{ border: 0, padding: 0, margin: 0 }} aria-label="Código de 6 dígitos">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Dígito ${i + 1}`}
            maxLength={i === 0 ? LEN : 1}
            autoFocus={i === 0}
            disabled={pending}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
          />
        ))}
      </fieldset>
      {error && <span className="hint err" role="alert"><Icon name="warn" size={15} />{error}</span>}
      <div className="row between">
        <span className="sm">{wait > 0 ? <>Reenviar en <span className="mono">0:{String(wait).padStart(2, "0")}</span></> : " "}</span>
        {wait <= 0 ? (
          <button className="link" onClick={async () => {
            const r = await sendCode(email, next);
            if (r.ok) { toast({ tone: "ok", text: "Te mandamos otro código." }); setWait(45); } else toast({ tone: "err", text: r.error });
          }}>Reenviar código</button>
        ) : (
          <Link className="link" href="/entrar">Cambiar correo</Link>
        )}
      </div>
      <p className="xs mt-a" style={{ textAlign: "center" }}>{pending ? "Revisando…" : "¿No llega? Revisa spam o promociones."}</p>
    </div>
  );
}
