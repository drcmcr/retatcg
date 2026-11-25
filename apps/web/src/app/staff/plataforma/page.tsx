import { redirect } from "next/navigation";
import { ActionButton } from "@/components/client";
import { approveTournament, handleModReport, moderateRename } from "@/actions/staff";
import { requireStaffArea } from "@/lib/staff";
import { daysUntil, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";
import { RoleForm } from "./RoleForm";

export const metadata = { title: "Plataforma" };

export default async function Plataforma() {
  const me = await requireStaffArea();
  if (!me.isSuperadmin) redirect("/staff");
  const supabase = await supabaseServer();
  const [{ data: pending }, { data: roles }, { data: reports }, { count: players }] = await Promise.all([
    supabase.from("tournaments").select("id,name,category,starts_at,capacity,organizer:profiles!tournaments_organizer_id_fkey(username)").eq("status", "pending_approval"),
    supabase.from("platform_roles").select("role,user_id,profile:profiles!platform_roles_user_id_fkey(username)"),
    supabase.from("mod_reports").select("id,kind,detail,created_at,target_user,target:profiles!mod_reports_target_user_fkey(username)").eq("status", "open").order("created_at"),
    supabase.from("player_seasons").select("user_id", { count: "exact", head: true }).eq("season_id", me.season?.id ?? 1),
  ]);
  return (
    <>
      <h1 className="t1">Plataforma</h1>
      <div className="grid3">
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
              <div className="row" style={{ gap: 8 }}>
                <ActionButton className="btn p sm" action={() => approveTournament(t.id, true)} ok="Aprobado.">Aprobar</ActionButton>
                <ActionButton className="btn g sm" action={() => approveTournament(t.id, false)} ok="Regresado a borrador.">Rechazar</ActionButton>
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
              <div className="row" style={{ gap: 8 }}>
                {r.target_user && <ActionButton className="btn s sm" action={() => moderateRename(r.target_user!)} ok="Usuario renombrado.">Renombrar</ActionButton>}
                <ActionButton className="btn g sm" action={() => handleModReport(r.id, "resolved")} ok="Resuelto.">Resuelto</ActionButton>
                <ActionButton className="btn g sm" action={() => handleModReport(r.id, "dismissed")} ok="Descartado.">Descartar</ActionButton>
              </div>
            </div>
          ))}
          {!reports?.length && <span className="sm">Sin reportes abiertos.</span>}
        </div>
      </div>
    </>
  );
}
