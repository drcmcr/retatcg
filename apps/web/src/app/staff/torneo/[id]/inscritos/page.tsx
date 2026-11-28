import { ActionButton, LiveRefresh } from "@/components/client";
import { Identicon } from "@/components/Identicon";
import { Status } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { removeStaff, staffMove, staffRegistration } from "@/actions/staff";
import { now } from "@/lib/time";
import { RANK_NAMES } from "@/lib/ranks";
import { describeRestrictions } from "@/lib/restrictions";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, regName } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { AddGuest, AddJudge } from "./Forms";

export const metadata = { title: "Inscritos y staff" };

type Tone = Parameters<typeof Status>[0]["tone"];
type Look = { tone: Tone; icon: IconName; label: string };

// Estado de la inscripción: siempre color + ícono + texto.
const ST: Record<string, Look> = {
  registered: { tone: "cyan", icon: "ticket", label: "Inscrito" },
  checked_in: { tone: "ok", icon: "check", label: "Check-in listo" },
  waitlist: { tone: "warn", icon: "clock", label: "En espera" },
  dropped: { tone: "muted", icon: "out", label: "Retirado" },
  removed: { tone: "muted", icon: "x", label: "Fuera" },
  no_show: { tone: "err", icon: "ban", label: "No se presentó" },
};

// Estado del mazo declarado para la ronda que toca (o el mazo fijo).
const DECK: Record<string, Look> = {
  none: { tone: "warn", icon: "warn", label: "Sin declarar" },
  unreviewed: { tone: "cyan", icon: "clock", label: "Por revisar" },
  approved: { tone: "ok", icon: "check", label: "Aprobado" },
  infraction: { tone: "err", icon: "ban", label: "Infracción" },
};

export default async function Inscritos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const regs = (await loadRegs(t.id)).filter((r) => r.status !== "removed");
  const supabase = await supabaseServer();
  const { data: staff } = await supabase.from("tournament_staff").select("user_id,role,profile:profiles(username)").eq("tournament_id", t.id);
  const ids = regs.map((r) => r.user_id).filter(Boolean) as string[];
  const { data: prs } = ids.length ? await supabase.from("player_seasons").select("user_id,pr").in("user_id", ids).eq("season_id", t.season_id ?? 1) : { data: [] };
  const pr = new Map((prs ?? []).map((p) => [p.user_id, p.pr]));
  const { data: att } = await supabase.rpc("tournament_attendance", { p_tournament: t.id });
  const attendance = new Map(((att ?? []) as { user_id: string; played: number; no_shows: number }[]).map((a) => [a.user_id, a]));
  const { data: inv } = t.invite_only ? await supabase.from("tournament_invites").select("label,registration_id").eq("tournament_id", t.id).eq("status", "used") : { data: [] };
  const invitedAs = new Map((inv ?? []).map((i) => [i.registration_id as string, i.label as string]));
  // Misma regla que ve el jugador en /torneo/[code]/mazo: "libre" con restricciones se vuelve "por ronda".
  const deckPolicy = t.deck_policy === "libre" && describeRestrictions(t.restrictions).length ? "por_ronda" : t.deck_policy;
  const deckRound = deckPolicy === "fijo" ? 0 : t.status === "running" ? t.current_round + 1 : 1;
  const showDeck = deckPolicy !== "libre" && ["registration", "running"].includes(t.status);
  const { data: decks } = showDeck
    ? await supabase.from("deck_declarations").select("registration_id,status").eq("tournament_id", t.id).eq("round", deckRound)
    : { data: [] };
  const deckOf = new Map((decks ?? []).map((d) => [d.registration_id as string, d.status as string]));
  const deckCell = (r: (typeof regs)[number]) => {
    // Los invitados sin cuenta no declaran mazo; tampoco quien ya salió del torneo.
    if (!r.user_id || ["dropped", "no_show", "removed"].includes(r.status)) return "—";
    const d = DECK[deckOf.get(r.id) ?? "none"];
    const label = deckPolicy === "por_ronda" ? `R${deckRound} · ${d.label}` : d.label;
    return <Status tone={d.tone} icon={d.icon}>{label}</Status>;
  };
  // Mazo por revisar o con infracción: enlace a Revisar mazos (fuera del encabezado desplegable).
  const deckHref = (r: (typeof regs)[number]) => {
    const st = deckOf.get(r.id);
    return st && st !== "approved" ? `/staff/torneo/${t.id}/mazos?estado=${st}` : null;
  };
  // Reacomodar lugares solo antes de que abra el check-in.
  const canMove = t.status === "registration" && now() < new Date(t.starts_at).getTime() - t.checkin_minutes * 60_000;
  const attLabel = (uid: string | null) => {
    const a = uid ? attendance.get(uid) : undefined;
    if (!a || a.played + a.no_shows === 0) return "Nuevo";
    return `${a.played} jugados · ${a.no_shows} ${a.no_shows === 1 ? "falta" : "faltas"}`;
  };
  return (
    <>
      <LiveRefresh channel={`ins-${t.id}`} watch={[{ table: "registrations", filter: `tournament_id=eq.${t.id}` }]} />
      <h1 className="t1">Inscritos</h1>
      <div className="grid2">
        <div className="col" style={{ gap: 8 }}>
          {regs.length > 0 && (
            <p className="xs" style={{ margin: 0 }}>
              {regs.filter((r) => ["registered", "checked_in"].includes(r.status)).length} con lugar
              {regs.some((r) => r.status === "waitlist") && ` · ${regs.filter((r) => r.status === "waitlist").length} en espera`}
              {showDeck && ` · ${regs.filter((r) => r.user_id && !["dropped", "no_show"].includes(r.status) && !deckOf.has(r.id)).length} sin mazo`}
              {" "}· Toca a un jugador para ver más.
            </p>
          )}
          {regs.map((r) => (
            <details key={r.id} className="reg n4">
              <summary>
                <Identicon seed={r.user_id ?? r.id} size={32} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ttl">{regName(r)}{!r.user_id && <span className="xs"> · invitado</span>}</span>
                  <span className="row wrap reg-st">
                    {ST[r.status] ? <Status tone={ST[r.status].tone} icon={ST[r.status].icon}>{ST[r.status].label}</Status> : r.status}
                    {showDeck && deckCell(r) !== "—" && <span className="row" style={{ gap: 4 }}><span className="xs">Mazo:</span>{deckCell(r)}</span>}
                  </span>
                </span>
                <span className="reg-chev" aria-hidden="true"><Icon name="right" size={20} /></span>
              </summary>
              <div className="reg-body col">
                <dl className="reg-dl">
                  <dt>Rango</dt><dd>{r.user_id ? RANK_NAMES[Math.min(5, Math.floor((pr.get(r.user_id) ?? 0) / 300))] : "—"}</dd>
                  <dt>Asistencia</dt><dd className={r.user_id && (attendance.get(r.user_id)?.no_shows ?? 0) > 0 ? "warn" : undefined}>{r.user_id ? attLabel(r.user_id) : "—"}</dd>
                  {invitedAs.has(r.id) && <><dt>Invitación</dt><dd>{invitedAs.get(r.id)}</dd></>}
                </dl>
                <div className="reg-actions">
                  {canMove && r.status === "waitlist" && <ActionButton className="btn p sm" action={staffMove} args={[r.id, "registered"]} ok="Ya tiene lugar."><Icon name="ticket" size={18} />Dar lugar</ActionButton>}
                  {r.status === "registered" && t.status === "registration" && <ActionButton className="btn c sm" action={staffRegistration} args={[r.id, "checkin"]} ok="Check-in hecho."><Icon name="check" size={18} />Hacer check-in</ActionButton>}
                  {showDeck && deckHref(r) && <a className="btn v sm" href={deckHref(r)!}><Icon name="eye" size={18} />Revisar mazo</a>}
                  {canMove && r.status === "registered" && <ActionButton className="btn w sm" action={staffMove} args={[r.id, "waitlist"]} confirm={`¿Pasar a ${regName(r)} a la lista de espera? Le llega un aviso.`} ok="Pasó a lista de espera."><Icon name="clock" size={18} />Pasar a espera</ActionButton>}
                  {!["dropped", "no_show"].includes(r.status) && <ActionButton className="btn d sm" action={staffRegistration} args={[r.id, "remove"]} confirm={`¿Quitar a ${regName(r)}?`} ok="Listo."><Icon name={t.status === "running" ? "out" : "x"} size={18} />{t.status === "running" ? "Retirar del torneo" : "Quitar del torneo"}</ActionButton>}
                </div>
              </div>
            </details>
          ))}
          {!regs.length && <p className="sm">Aún no hay inscritos.</p>}
        </div>
        <div className="col" style={{ gap: 12 }}>
          {["registration", "running"].includes(t.status) && <AddGuest id={t.id} />}
          <div className="box n4 col" style={{ gap: 8 }}>
            <b>Staff del torneo</b>
            {(staff ?? []).map((s) => (
              <div key={s.user_id} className="li n4">
                <Identicon seed={s.user_id} size={28} />
                <span className="grow"><span className="ttl">{(s.profile as { username?: string } | null)?.username}</span><span className="xs">{s.role === "judge" ? "Juez" : "Organizador"}</span></span>
                {s.user_id !== t.organizer_id && <ActionButton className="link" action={removeStaff} args={[t.id, s.user_id]} ok="Quitado.">Quitar</ActionButton>}
              </div>
            ))}
            <AddJudge id={t.id} />
          </div>
        </div>
      </div>
    </>
  );
}
