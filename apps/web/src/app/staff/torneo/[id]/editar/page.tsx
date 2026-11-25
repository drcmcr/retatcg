import { redirect } from "next/navigation";
import { requireTournamentStaff } from "@/lib/staff";
import { TournamentForm, type FormValue } from "../../../TournamentForm";

export const metadata = { title: "Editar torneo" };

const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, t } = await requireTournamentStaff(id);
  if (!["draft", "pending_approval", "registration"].includes(t.status)) redirect(`/staff/torneo/${id}`);
  const initial: FormValue = {
    name: t.name, club: t.club ?? "", category: t.category, format: t.format, swiss_rounds: t.swiss_rounds, top_cut: t.top_cut || 4,
    swiss_best_of: t.swiss_best_of, top_best_of: t.top_best_of, pace: t.pace.kind, windowHours: t.pace.windowHours ?? 24,
    sessions: (t.pace.sessions ?? []).map((s) => ({ startsAt: toLocal(s.startsAt), rounds: s.rounds.join(",") })),
    starts_at: toLocal(t.starts_at), checkin_minutes: t.checkin_minutes, capacity: t.capacity, deck_policy: t.deck_policy,
    restrictions: t.restrictions, min_rank: t.min_rank, prizes: t.prizes ?? "", prize_list: t.prize_list ?? [], notes: t.notes ?? "", round_minutes: t.round_minutes ? String(t.round_minutes) : "", expected: t.capacity, invite_only: !!t.invite_only,
  };
  return (
    <>
      <h1 className="t1">Editar torneo</h1>
      {t.status === "registration" && <p className="sm">Con la inscripción abierta ya no cambian formato, categoría ni reglas de mazo.</p>}
      <TournamentForm initial={initial} id={id} locked={t.status === "registration"} superadmin={me.isSuperadmin} />
    </>
  );
}
