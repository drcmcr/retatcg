import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getMe, getUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { AcceptInvite } from "./AcceptInvite";

export const metadata = { title: "Invitación" };

type Info = { state: string; label?: string; code?: string; name?: string; club?: string | null; starts_at?: string };

const BAD: Record<string, [string, string]> = {
  invalid: ["Esta invitación no existe", "Revisa que el enlace esté completo o pídele uno nuevo a quien te invitó."],
  used: ["Esta invitación ya se usó", "Cada enlace sirve para una sola persona. Si era para ti, pídele uno nuevo al organizador."],
  cancelled: ["Esta invitación se canceló", "Pídele un enlace nuevo al organizador."],
  expired: ["Esta invitación venció", "Ya abrió el check-in del torneo. Puedes abrir el torneo y ver si quedan lugares en la lista de espera."],
  closed: ["La inscripción ya cerró", "El torneo ya empezó o terminó."],
  unpublished: ["El torneo todavía no se publica", "Vuelve a abrir este enlace más tarde."],
};

/** Enlace personal de invitación: aparta un lugar seguro en un torneo con invitación. */
export default async function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const here = `/i/${token}`;
  const supabase = await supabaseServer();
  const { data } = /^[0-9a-f]{32}$/.test(token) ? await supabase.rpc("invite_info", { p_token: token }) : { data: { state: "invalid" } };
  const i = (data ?? { state: "invalid" }) as Info;
  if (i.state === "mine") redirect(`/torneo/${i.code}`);

  const user = await getUser();
  const me = user ? await getMe() : null;
  if (user && !me && i.state === "open") redirect(`/bienvenida?siguiente=${encodeURIComponent(here)}`);

  return (
    <main className="screen" style={{ justifyContent: "center" }}>
      <div className="panel n6 col fade-in" style={{ gap: 14 }}>
        {i.state === "open" ? (
          <>
            <span className="lbl lime">Invitación personal</span>
            <h1 className="t1" style={{ margin: 0 }}>{i.name}</h1>
            <div className="col sm" style={{ gap: 4 }}>
              {i.club && <span>Organiza: <b style={{ color: "var(--ink)" }}>{i.club}</b></span>}
              <span>Fecha: <b style={{ color: "var(--ink)" }}>{fmtDateTime(i.starts_at!)}</b></span>
              <span>Para: <b style={{ color: "var(--ink)" }}>{i.label}</b></span>
            </div>
            <p className="sm" style={{ margin: 0 }}>Este enlace te aparta un lugar seguro y sirve una sola vez. Si no eres {i.label}, no lo uses: pídele tu propio enlace al organizador.</p>
            {me ? <AcceptInvite token={token} /> : (
              <>
                <Link href={`/entrar?siguiente=${encodeURIComponent(here)}`} className="btn p">Entrar para aceptar</Link>
                <span className="xs">Si no tienes cuenta, la creas en un minuto y regresas aquí.</span>
              </>
            )}
            <Link href={`/torneo/${i.code}`} className="btn g sm">Ver el torneo</Link>
          </>
        ) : (
          <>
            <span className="row warn" style={{ gap: 6 }}><Icon name="warn" size={20} /><b>{BAD[i.state]?.[0] ?? "No se pudo abrir"}</b></span>
            {i.name && <span className="sm">{i.name}</span>}
            <p className="sm" style={{ margin: 0 }}>{BAD[i.state]?.[1]}</p>
            {i.code && <Link href={`/torneo/${i.code}`} className="btn s">Ver el torneo</Link>}
            <Link href="/" className="btn g sm">Ir a Reta</Link>
          </>
        )}
      </div>
    </main>
  );
}
