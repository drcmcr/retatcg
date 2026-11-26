"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { checkUsername, completeOnboarding } from "@/actions/auth";
import { Icon } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { Steps } from "@/components/ui";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ageOn(y: number, m: number, d: number): number {
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

export function Onboarding({ seed, next }: { seed: string; next?: string }) {
  const [step, setStep] = useState(1);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<{ name: string; ok: boolean } | null>(null);
  const available = check && check.name === username ? check.ok : null;
  const [pocketName, setPocketName] = useState("");
  const [friendId, setFriendId] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const birth = useMemo(() => {
    const d = Number(day), m = Number(month), y = Number(year);
    if (!d || !m || !y || y < 1900 || d > 31) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) return null;
    return { iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, age: ageOn(y, m, d) };
  }, [day, month, year]);

  useEffect(() => {
    if (!/^[A-Za-z0-9._]{3,16}$/.test(username)) return;
    const id = setTimeout(async () => setCheck({ name: username, ok: await checkUsername(username) }), 400);
    return () => clearTimeout(id);
  }, [username]);

  const friendDigits = friendId.replace(/\D/g, "");
  const fmtFriend = friendDigits.replace(/(\d{4})(?=\d)/g, "$1 ");

  function finish() {
    setError(null);
    start(async () => {
      const r = await completeOnboarding({
        username, birthdate: birth!.iso, pocketName, friendId: friendDigits,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accept: accept as true,
      });
      if (!r.ok) {
        setError(r.error);
        if (/usuario/i.test(r.error)) setStep(2);
        return;
      }
      router.replace(next ? `/bienvenida/listo?siguiente=${encodeURIComponent(next)}` : "/bienvenida/listo");
      router.refresh();
    });
  }

  return (
    <div className="screen">
      <div className="tb">
        {step > 1 ? (
          <button className="ib" aria-label="Paso anterior" onClick={() => setStep(step - 1)}><Icon name="back" /></button>
        ) : (
          <Link className="ib" href="/" aria-label="Salir"><Icon name="back" /></Link>
        )}
      </div>
      <Steps n={step} of={3} />

      {step === 1 && (
        <>
          <h1 className="t1">¿Cuándo naciste?</h1>
          <p className="sm">Solo la usamos para tu división y para cuidar la beta, que es para mayores de 18. Nadie más la ve.</p>
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <div className="fld" style={{ width: 76 }}>
              <label htmlFor="dia">Día</label>
              <input id="dia" className="inp" inputMode="numeric" maxLength={2} value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))} autoComplete="bday-day" />
            </div>
            <div className="fld grow">
              <label htmlFor="mes">Mes</label>
              <select id="mes" className="inp" value={month} onChange={(e) => setMonth(e.target.value)} autoComplete="bday-month">
                <option value="">Elige</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="fld" style={{ width: 96 }}>
              <label htmlFor="anio">Año</label>
              <input id="anio" className="inp" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} autoComplete="bday-year" />
            </div>
          </div>
          {birth && birth.age < 18 && (
            <div className="box card n4 row sm" style={{ color: "var(--ink)" }}>
              <Icon name="info" size={18} /> La beta es para mayores de 18. Si continúas, no guardaremos tus datos.
            </div>
          )}
          <button className="btn p mt-a" disabled={!birth} onClick={() => setStep(2)}>Siguiente</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="t1">Tu identidad</h1>
          <div className="fld">
            <label htmlFor="usuario">Usuario de Reta</label>
            <input id="usuario" className={`inp ${available === true ? "okb" : available === false ? "bad" : ""}`} value={username}
              onChange={(e) => setUsername(e.target.value.trim())} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} />
            {available === true && <span className="hint ok"><Icon name="check" size={15} weight={3} />Disponible</span>}
            {available === false && <span className="hint err"><Icon name="x" size={15} />No disponible</span>}
            {available === null && <span className="hint">3 a 16 caracteres: letras, números, punto o guion bajo. Es público.</span>}
          </div>
          <div className="box n4 row" style={{ gap: 12 }}>
            <Identicon seed={seed} size={48} />
            <span className="sm grow">Este es tu ícono. Se genera solo, es único de tu cuenta y no cambia aunque cambies de usuario.</span>
          </div>
          <div className="fld">
            <label htmlFor="pocket">Nombre en Pocket</label>
            <input id="pocket" className="inp" value={pocketName} maxLength={20} onChange={(e) => setPocketName(e.target.value)} />
            <span className="hint"><Icon name="lock" size={15} />Solo lo ve tu rival de mesa</span>
          </div>
          <div className="fld">
            <label htmlFor="amigo">ID de amigo</label>
            <input id="amigo" className="inp mono" inputMode="numeric" value={fmtFriend} onChange={(e) => setFriendId(e.target.value)} placeholder="0000 0000 0000 0000" />
            <span className="hint"><Icon name="info" size={15} />En Pocket: Social, Amigos, Agregar amigo. Son 16 números.</span>
          </div>
          <button className="btn p mt-a" disabled={!available || !pocketName.trim() || friendDigits.length !== 16} onClick={() => setStep(3)}>Siguiente</button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="t1">Antes de empezar</h1>
          <div className="box n4 col sm" style={{ gap: 10, color: "var(--ink-3)" }}>
            <span className="row"><Icon name="eye" size={18} />Tu usuario, rango y resultados son públicos.</span>
            <span className="row"><Icon name="lock" size={18} />Tu correo, fecha, nombre en Pocket e ID de amigo, no.</span>
            <span className="row"><Icon name="msg" size={18} />No hay chat: solo mensajes rápidos dentro de la mesa.</span>
            <span className="row"><Icon name="trash" size={18} />Puedes descargar o borrar tus datos cuando quieras.</span>
          </div>
          <Link href="/legal/privacidad" className="link" target="_blank">Leer el aviso de privacidad completo</Link>
          <label className="check">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span className="cb">{accept && <Icon name="check" size={16} weight={3} />}</span>
            <span>Acepto los <Link href="/legal/terminos" target="_blank">términos de uso</Link> y el <Link href="/legal/reglamento" target="_blank">reglamento de juego</Link>.</span>
          </label>
          {error && <span className="hint err" role="alert"><Icon name="warn" size={15} />{error}</span>}
          <button className="btn p mt-a" disabled={!accept || pending} onClick={finish}>{pending ? "Creando tu cuenta…" : "Empezar"}</button>
        </>
      )}
    </div>
  );
}
