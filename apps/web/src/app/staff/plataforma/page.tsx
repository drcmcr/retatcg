import { redirect } from "next/navigation";
import { ActionButton } from "@/components/client";
import { approveTournament, handleModReport, moderateRename } from "@/actions/staff";
import { requireStaffArea } from "@/lib/staff";
import { daysUntil, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";
import { Flagged, NameTools, TermList, type Flag, type Term } from "./Names";
import { RoleForm } from "./RoleForm";

export const metadata = { title: "Plataforma" };

export default async function Plataforma() {
  const me = await requireStaffArea();
  if (!me.isSuperadmin) redirect("/staff");
  const supabase = await supabaseServer();
  const [{ data: metrics }, { data: pending }, { data: roles }, { data: reports }, { count: players }, { data: terms }, { data: flagged }] = await Promise.all([
    supabase.rpc("platform_metrics"),
    supabase.from("tournaments").select("id,name,category,starts_at,capacity,organizer:profiles!tournaments_organizer_id_fkey(username)").eq("status", "pending_approval"),
    supabase.from("platform_roles").select("role,user_id,profile:profiles!platform_roles_user_id_fkey(username)"),
    supabase.from("mod_reports").select("id,kind,detail,created_at,target_user,target:profiles!mod_reports_target_user_fkey(username)").eq("status", "open").order("created_at"),
    supabase.from("player_seasons").select("user_id", { count: "exact", head: true }).eq("season_id", me.season?.id ?? 1),
    supabase.from("blocked_terms").select("id,term,kind,fields,whole_word").order("term"),
    supabase.rpc("admin_flagged_names"),
  ]);
  return (
    <>
      <h1 className="t1">Plataforma</h1>
      <Metrics m={metrics as M | null} />
      <div className="grid3 stack1">
        <div className="box n4 col" style={{ gap: 10 }}>
          <b className="t2">{me.season?.name ?? "Sin temporada"}</b>
          {me.season && <><div className="row between sm"><span>Termina</span><b style={{ color: "var(--ink)" }}>{fmtDate(me.season.endsAt)}</b></div>
            <div className="row between sm"><span>Faltan</span><b style={{ color: "var(--ink)" }}>{daysUntil(me.season.endsAt)} días</b></div></>}
          <div className="row between sm"><span>Jugadores en la temporada</span><b style={{ color: "var(--ink)" }}>{players ?? 0}</b></div>
          <span className="xs">Al cerrar: todos bajan un rango y empieza la siguiente. El cierre se programa con el equipo antes del final.</span>
        </div>
        <div className="box n4 col" style={{ gap: 10 }}>
          <b className="t2">Por aprobar · {pending?.length ?? 0}</b>
          {(pending ?? []).map((t) => (
            <div key={t.id} className="box card n4 col" style={{ gap: 6 }}>
              <b>{t.name}</b>
              <span className="xs">{CATEGORY[t.category]?.label} · {(t.organizer as unknown as { username: string } | null)?.username} · {fmtDateTime(t.starts_at)} · {t.capacity} lugares</span>
              <div className="row wrap" style={{ gap: 8 }}>
                <ActionButton className="btn p sm" action={approveTournament} args={[t.id, true]} ok="Aprobado.">Aprobar</ActionButton>
                <ActionButton className="btn g sm" action={approveTournament} args={[t.id, false]} ok="Regresado a borrador.">Rechazar</ActionButton>
              </div>
            </div>
          ))}
          <span className="lbl" style={{ fontSize: 16 }}>Organizadores</span>
          {(roles ?? []).map((r) => <span key={r.user_id + r.role} className="sm">{(r.profile as unknown as { username: string } | null)?.username} · {r.role === "superadmin" ? "superadmin" : "organizador"}</span>)}
          <RoleForm />
        </div>
        <div className="box n4 col" style={{ gap: 10 }}>
          <b className="t2">Moderación · {reports?.length ?? 0}</b>
          {(reports ?? []).map((r) => (
            <div key={r.id} className="box card n4 col" style={{ gap: 6 }}>
              <b>{(r.target as unknown as { username: string } | null)?.username ?? "Usuario"} · {r.kind.replace("_", " ")}</b>
              {r.detail && <span className="xs">{r.detail}</span>}
              <div className="row wrap" style={{ gap: 8 }}>
                {r.target_user && <ActionButton className="btn s sm" action={moderateRename} args={[r.target_user!]} ok="Usuario renombrado.">Renombrar</ActionButton>}
                <ActionButton className="btn g sm" action={handleModReport} args={[r.id, "resolved"]} ok="Resuelto.">Resuelto</ActionButton>
                <ActionButton className="btn g sm" action={handleModReport} args={[r.id, "dismissed"]} ok="Descartado.">Descartar</ActionButton>
              </div>
            </div>
          ))}
          {!reports?.length && <span className="sm">Sin reportes abiertos.</span>}
        </div>
      </div>
      <section className="col" style={{ gap: 12 }} aria-labelledby="nom-h">
        <span id="nom-h" className="lbl">Nombres y textos</span>
        <p className="sm" style={{ margin: 0 }}>Un solo filtro revisa usuarios, invitados, nombres de torneo y club, notas, premios y anuncios. Pokémon se permite en el club, no en el torneo.</p>
        <div className="grid3 stack1">
          <div className="box n4 col" style={{ gap: 10 }}>
            <b className="t2">Por revisar · {(flagged as Flag[] | null)?.length ?? 0}</b>
            <span className="xs">Nombres creados antes de un cambio en la lista que ya no pasan el filtro.</span>
            <Flagged items={(flagged as Flag[] | null) ?? []} />
          </div>
          <div className="box n4 col" style={{ gap: 10 }}>
            <b className="t2">Lista del filtro</b>
            <TermList terms={(terms as Term[] | null) ?? []} />
          </div>
          <div className="box n4 col" style={{ gap: 10 }}>
            <b className="t2">Herramientas</b>
            <NameTools />
          </div>
        </div>
      </section>
    </>
  );
}

type M = {
  cuentas: number; perfiles: number; con_id_amigo: number; jugaron_1: number; jugaron_2: number; activos_7: number; activos_30: number;
  jugaron_30: number; repiten_semana: number; asistencia: { llegaron: number; faltas: number }; sin_registro_completo: number; aviso_inactividad: number;
};

/** Actividad real: cuántos juegan, no cuántos se registraron. */
function Metrics({ m }: { m: M | null }) {
  if (!m) return null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const funnel: [string, number][] = [["Crearon cuenta", m.cuentas], ["Completaron su perfil", m.perfiles], ["Jugaron 1 torneo", m.jugaron_1], ["Jugaron 2 o más", m.jugaron_2]];
  const totalAsis = m.asistencia.llegaron + m.asistencia.faltas;
  return (
    <section className="col" style={{ gap: 12 }} aria-labelledby="act-h">
      <span id="act-h" className="lbl">Actividad</span>
      <div className="grid4">
        {[["Activos 7 días", m.activos_7], ["Activos 30 días", m.activos_30], ["Jugaron en 30 días", m.jugaron_30], ["Repiten semana a semana", m.repiten_semana]].map(([k, v]) => (
          <div key={k} className="box n4 col" style={{ gap: 2 }}><b className="px20 lime" style={{ fontSize: 40, lineHeight: 1 }}>{v}</b><span className="xs">{k}</span></div>
        ))}
      </div>
      <div className="grid2">
        <div className="box n4 col" style={{ gap: 10 }}>
          <b className="t2">Embudo</b>
          {funnel.map(([k, v], i) => (
            <div key={k} className="col" style={{ gap: 4 }}>
              <div className="row between sm"><span>{k}</span><b style={{ color: "var(--ink)" }}>{v}{i > 0 ? ` · ${pct(v, funnel[i - 1]![1])}` : ""}</b></div>
              <div className="bar" aria-hidden="true"><i style={{ width: pct(v, m.cuentas) === "—" ? "0%" : pct(v, m.cuentas) }} /></div>
            </div>
          ))}
          <span className="xs">El porcentaje es contra el paso anterior: ahí ves dónde se cae la gente.</span>
        </div>
        <div className="box n4 col" style={{ gap: 10 }}>
          <b className="t2">Asistencia y limpieza</b>
          <div className="row between sm"><span>Asistencia en la temporada</span><b style={{ color: "var(--ink)" }}>{pct(m.asistencia.llegaron, totalAsis)}</b></div>
          <div className="row between sm"><span>Faltas sin aviso</span><b style={{ color: "var(--ink)" }}>{m.asistencia.faltas}</b></div>
          <div className="row between sm"><span>Con ID de amigo</span><b style={{ color: "var(--ink)" }}>{m.con_id_amigo}</b></div>
          <div className="row between sm"><span>Registro sin terminar</span><b style={{ color: "var(--ink)" }}>{m.sin_registro_completo}</b></div>
          <div className="row between sm"><span>Avisadas por inactividad</span><b style={{ color: "var(--ink)" }}>{m.aviso_inactividad}</b></div>
          <span className="xs">Registros sin terminar se borran a los 7 días. Cuentas sin uso en 12 meses reciben aviso y se borran 30 días después si no vuelven.</span>
        </div>
      </div>
    </section>
  );
}
