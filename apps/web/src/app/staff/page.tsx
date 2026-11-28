import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Empty, Status } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { deleteTournament } from "@/actions/staff";
import { requireStaffArea, myStaffTournaments } from "@/lib/staff";
import { fmtDateTime } from "@/lib/format";
import { CATEGORY, PACE_LABEL } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Mis torneos" };

type Tone = Parameters<typeof Status>[0]["tone"];
// Estado del torneo: siempre color + ícono + texto.
const STATUS: Record<string, { label: string; tone: Tone; icon: Parameters<typeof Icon>[0]["name"] }> = {
  draft: { label: "Borrador", tone: "muted", icon: "edit" },
  pending_approval: { label: "Esperando aprobación", tone: "warn", icon: "clock" },
  registration: { label: "Inscripción abierta", tone: "cyan", icon: "ticket" },
  running: { label: "En curso", tone: "ok", icon: "play" },
  finished: { label: "Terminado", tone: "muted", icon: "trophy" },
  cancelled: { label: "Cancelado", tone: "err", icon: "x" },
};

export default async function StaffHome({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const me = await requireStaffArea();
  const sp = await searchParams;
  const mine = await myStaffTournaments(me.id);
  const roleOf = new Map(mine.map((x) => [x.tournament.id, x.role]));
  const list = mine.map((x) => x.tournament as unknown as { id: string; name: string; status: string; category: string; starts_at: string; pace: { kind: string }; capacity: number; current_round: number });
  const filtered = sp.estado ? list.filter((t) => t.status === sp.estado) : list;
  filtered.sort((a, b) => ["running", "registration", "pending_approval", "draft", "finished", "cancelled"].indexOf(a.status) - ["running", "registration", "pending_approval", "draft", "finished", "cancelled"].indexOf(b.status) || a.starts_at.localeCompare(b.starts_at));
  const supabase = await supabaseServer();
  const ids = filtered.map((t) => t.id);
  const { data: regs } = ids.length ? await supabase.from("registrations").select("tournament_id").in("tournament_id", ids).in("status", ["registered", "checked_in"]) : { data: [] };
  const counts = new Map<string, number>();
  for (const r of regs ?? []) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
  const n = (s: string) => list.filter((t) => t.status === s).length;
  return (
    <>
      <div className="row between wrap">
        <h1 className="t1">Mis torneos</h1>
        {me.isOrganizer && <Link href="/staff/crear" className="btn p sm"><Icon name="plus" size={18} />Crear torneo</Link>}
      </div>
      <div className="chips">
        <Link href="/staff" className="chip" aria-current={!sp.estado ? "page" : undefined}>Todos</Link>
        {[["running", "En curso"], ["registration", "Inscripción"], ["draft", "Borradores"], ["finished", "Terminados"], ["cancelled", "Cancelados"]].map(([k, l]) => (
          <Link key={k} href={`/staff?estado=${k}`} className="chip" aria-current={sp.estado === k ? "page" : undefined}>{l} · {n(k!)}</Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty icon="trophy" title="Aún no tienes torneos">{me.isOrganizer && <Link className="btn p" href="/staff/crear">Crear el primero</Link>}</Empty>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {filtered.map((t) => {
            const st = STATUS[t.status]!;
            const canDelete = ["draft", "cancelled"].includes(t.status) && t.current_round === 0 && (roleOf.get(t.id) === "organizer" || me.isSuperadmin);
            return (
              <div key={t.id} className="trow n4">
                <details className="reg">
                  <summary>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="ttl">{t.name}</span>
                      <span className="row wrap reg-st">
                        <Status tone={st.tone} icon={st.icon}>{st.label}{t.status === "running" ? ` · R${t.current_round}` : ""}</Status>
                        <span className="xs">{fmtDateTime(t.starts_at)}</span>
                        <span className="xs mono">{counts.get(t.id) ?? 0}/{t.capacity}</span>
                      </span>
                    </span>
                    <span className="reg-chev" aria-hidden="true"><Icon name="right" size={20} /></span>
                  </summary>
                  <div className="reg-body col">
                    <dl className="reg-dl">
                      <dt>Categoría</dt><dd>{CATEGORY[t.category]?.label ?? t.category}</dd>
                      <dt>Ritmo</dt><dd>{PACE_LABEL[t.pace.kind]}</dd>
                      <dt>Fecha</dt><dd>{fmtDateTime(t.starts_at)}</dd>
                      <dt>Jugadores</dt><dd className="mono">{counts.get(t.id) ?? 0} / {t.capacity}</dd>
                      <dt>Tu rol</dt><dd>{roleOf.get(t.id) === "judge" ? "Juez" : "Organizador"}</dd>
                    </dl>
                    {canDelete && (
                      <div className="row wrap" style={{ gap: 8 }}>
                        <ActionButton className="btn d sm" action={deleteTournament} args={[t.id]} ok="Torneo eliminado."
                          confirm={`¿Eliminar "${t.name}"? Se borra con sus inscripciones e invitaciones y no se puede deshacer.`}>
                          <Icon name="trash" size={18} />Eliminar
                        </ActionButton>
                      </div>
                    )}
                  </div>
                </details>
                <Link className="btn p sm trow-open" href={`/staff/torneo/${t.id}`} aria-label={`Abrir ${t.name}`}>{t.status === "running" ? "Panel" : "Abrir"}<Icon name="right" size={18} /></Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
