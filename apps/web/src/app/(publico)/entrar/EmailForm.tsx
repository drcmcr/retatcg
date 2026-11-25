"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendCode } from "@/actions/auth";
import { Icon } from "@/components/Icon";

export function EmailForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(linkError ? "El enlace venció o ya se usó. Pide un código nuevo." : null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="col"
      style={{ gap: 14, flex: 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendCode(email, next);
          if (!r.ok) return setError(r.error);
          const q = new URLSearchParams({ correo: email.trim().toLowerCase(), ...(next ? { siguiente: next } : {}) });
          router.push(`/entrar/codigo?${q}`);
        });
      }}
    >
      <div className="tb">
        <Link href="/" className="ib" aria-label="Volver"><Icon name="back" /></Link>
      </div>
      <h1 className="t1">Entra o crea tu cuenta</h1>
      <p className="sm">Te mandamos un código de 6 dígitos. No necesitas contraseña.</p>
      <div className="fld">
        <label htmlFor="correo">Correo</label>
        <input id="correo" className={`inp ${error ? "bad" : ""}`} type="email" inputMode="email" autoComplete="email" required
          value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="tu@correo.mx" aria-describedby="correo-err" />
        {error && <span id="correo-err" className="hint err" role="alert"><Icon name="warn" size={15} />{error}</span>}
      </div>
      <button className="btn p mt-a" disabled={pending || !email}>{pending ? "Enviando…" : "Enviar código"}</button>
    </form>
  );
}
