import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/client";
import { relTime } from "@/lib/format";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, loadRounds, regName } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { ResultForm } from "../../mesa/[match]/ResultForm";
import { CASE_KIND as KIND } from "@/lib/game";
import { JudgeTools } from "./JudgeTools";

export const metadata = { title: "Caso" };
const CODE: Record<string, string> = { envio_captura: "Envío la captura", no_tengo_captura: "No tengo captura", entendido: "Entendido", sigo_esperando: "Sigo esperando" };

export default async function Caso({ params }: { params: Promise<{ id: string; caso: string }> }) {
  const { id, caso } = await params;
  const { t } = await requireTournamentStaff(id);
  const supabase = await supabaseServer();
  const { data: c } = await supabase.from("cases").select("*").eq("id", Number(caso)).eq("tournament_id", t.id).maybeSingle();
  if (!c) notFound();
  const [{ data: msgs }, regs, { rounds, matches }] = await Promise.all([
    supabase.from("case_messages").select("id,role,code,body,attachment,at,author,profile:profiles(username)").eq("case_id", c.id).order("at"),
    loadRegs(t.id), loadRounds(t.id),
  ]);
  const m = matches.find((x) => x.id === c.match_id);
  const round = m ? rounds.find((r) => r.id === m.round_id) : undefined;
  const byId = new Map(regs.map((r) => [r.id, r]));
  const players = m ? [byId.get(m.a), m.b ? byId.get(m.b) : undefined].filter(Boolean) : [];
  const urls = new Map<string, string>();
  for (const x of msgs ?? []) if (x.attachment) {
    const { data } = await supabase.storage.from("capturas").createSignedUrl(x.attachment, 600);
    if (data) urls.set(x.attachment, data.signedUrl);
  }
  const { data: events } = m ? await supabase.from("match_events").select("at,kind,data,profile:profiles(username)").eq("match_id", m.id).order("at") : { data: [] };
  return (
    <>
      <LiveRefresh channel={`caso-staff-${c.id}`} watch={[{ table: "case_messages", filter: `case_id=eq.${c.id}` }, { table: "cases", filter: `id=eq.${c.id}` }]} />
      <Link href={`/staff/torneo/${t.id}/casos`} className="link" style={{ padding: 0 }}>← Casos</Link>
      <div className="row between wrap"><h1 className="t1">#{c.id} · {KIND[c.kind]}</h1><span className={`pill ${c.status === "resolved" ? "o" : "c"}`}>{c.status === "resolved" ? "Resuelto" : c.status === "review" ? "En revisión" : "Abierto"}</span></div>
      {m && <span className="sm">Mesa {m.table_no} · ronda {round?.number} · {regName(byId.get(m.a))} vs {regName(byId.get(m.b ?? ""))} · estado {m.status}{m.reported_by ? ` · reportó ${regName(byId.get(m.reported_by))}: ${m.games_a}-${m.games_b}` : ""}</span>}
      <div className="grid2">
        <div className="col" style={{ gap: 12 }}>
          <div className="box n4 col" style={{ gap: 8 }}>
            <span className="lbl" style={{ fontSize: 16 }}>Mensajes</span>
            {(msgs ?? []).map((x) => (
              <div key={x.id} className="col" style={{ gap: 2 }}>
                <span className="xs">{x.role === "judge" ? "Juez" : x.role === "system" ? "Reta" : (x.profile as { username?: string } | null)?.username} · {relTime(x.at)}</span>
                <span className="sm" style={{ color: "var(--ink)" }}>{x.body ?? CODE[x.code ?? ""] ?? x.code}</span>
                {x.attachment && urls.get(x.attachment) && <a href={urls.get(x.attachment)} target="_blank" rel="noreferrer"><img src={urls.get(x.attachment)} alt="Captura enviada" style={{ maxWidth: 260, maxHeight: 200 }} /></a>}
              </div>
            ))}
            {!msgs?.length && <span className="sm">Sin mensajes.</span>}
          </div>
          <div className="box n4 col" style={{ gap: 4 }}>
            <span className="lbl" style={{ fontSize: 16 }}>Registro de la mesa</span>
            {(events ?? []).map((e, i) => <span key={i} className="xs" style={{ color: "var(--ink-3)" }}>{new Date(e.at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {(e.profile as { username?: string } | null)?.username ?? "Reta"}: {(e.data as { texto?: string })?.texto ?? e.kind}</span>)}
          </div>
        </div>
        <div className="col" style={{ gap: 12 }}>
          {m && m.b && round && m.status !== "confirmed" && (
            <ResultForm matchId={m.id} a={regName(byId.get(m.a))} b={regName(byId.get(m.b))} bestOf={round.best_of} stage={round.stage} current={{ a: m.games_a, b: m.games_b, d: m.game_draws, dl: m.double_loss, status: m.status }} />
          )}
          <JudgeTools caseId={c.id} tournamentId={t.id} resolved={c.status === "resolved"} players={players.filter((p) => p?.user_id).map((p) => ({ id: p!.user_id!, name: regName(p) }))} />
        </div>
      </div>
    </>
  );
}
