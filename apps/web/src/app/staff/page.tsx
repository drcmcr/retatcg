import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Empty } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { deleteTournament } from "@/actions/staff";
import { requireStaffArea, myStaffTournaments } from "@/lib/staff";
import { fmtDateTime } from "@/lib/format";
import { CATEGORY, PACE_LABEL } from "@/lib/game";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Mis torneos" };

const STATUS: Record<string, [string, string]> = {
  draft: ["Borrador", "o"], pending_approval: ["Esperando aprobación", "o"], registration: ["Inscripción abierta", "c"],
  running: ["En curso", "l"], finished: ["Terminado", "o"], cancelled: ["Cancelado", "e"],
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
        <table className="tbl stack" style={{ fontSize: 15 }}>
          <thead><tr><th>Torneo</th><th>Estado</th><th>Ritmo</th><th>Fecha</th><th className="r">Jugadores</th><th></th></tr></thead>
          <tbody>
            {filtered.map((t) => {
              const [label, pill] = STATUS[t.status]!;
              return (
                <tr key={t.id}>
                  <td className="lead" style={{ fontWeight: 700 }}>{t.name}<div className="xs">{CATEGORY[t.category]?.label}</div></td>
                  <td data-label="Estado"><span className={`pill ${pill}`}>{label}{t.status === "running" ? ` · R${t.current_round}` : ""}</span></td>
                  <td data-label="Ritmo">{PACE_LABEL[t.pace.kind]}</td>
                  <td data-label="Fecha" className="nw">{fmtDateTime(t.starts_at)}</td>
                  <td data-label="Jugadores" className="r mono">{counts.get(t.id) ?? 0} / {t.capacity}</td>
                  <td className="r act">
                    {["draft", "cancelled"].includes(t.status) && t.current_round === 0 && (roleOf.get(t.id) === "organizer" || me.isSuperadmin) && (
                      <ActionButton className="btn d sm" action={deleteTournament} args={[t.id]} ok="Torneo eliminado."
                        confirm={`¿Eliminar "${t.name}"? Se borra con sus inscripciones e invitaciones y no se puede deshacer.`}>
                        <Icon name="trash" size={18} />Eliminar
                      </ActionButton>
                    )}
                    <Link className="btn p sm" href={`/staff/torneo/${t.id}`}>{t.status === "running" ? "Abrir panel" : "Abrir"}<Icon name="right" size={18} /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
