import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { CaseReply } from "./CaseReply";

export const metadata = { title: "Caso" };

const KIND: Record<string, string> = { marcador: "Marcador distinto", ausente: "Rival ausente", desconexion: "Desconexión", conducta: "Conducta", juez: "Llamada al juez", plazo: "Plazo vencido" };
const CODE: Record<string, string> = { envio_captura: "Envío la captura", no_tengo_captura: "No tengo captura", entendido: "Entendido", sigo_esperando: "Sigo esperando" };

export default async function Caso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe(`/caso/${id}`);
  const supabase = await supabaseServer();
  const { data: c } = await supabase.from("cases").select("*, match:matches(table_no,tournament_id)").eq("id", Number(id)).maybeSingle();
  if (!c) notFound();
  const { data: msgs } = await supabase.from("case_messages").select("id,author,role,code,body,attachment,at,profile:profiles(username)").eq("case_id", c.id).order("at");
  const steps = ["open", "review", "resolved"];
  const idx = steps.indexOf(c.status);
  return (
    <main className="screen">
      <LiveRefresh channel={`caso-${c.id}`} watch={[{ table: "cases", filter: `id=eq.${c.id}` }, { table: "case_messages", filter: `case_id=eq.${c.id}` }]} />
      <TopBar title={`Caso #${c.id}`} back={c.match_id ? `/mesa/${c.match_id}` : "/inicio"} />
      <div className="steps" role="img" aria-label={`Estado: ${["Abierto", "En revisión", "Resuelto"][idx]}`}>
        {steps.map((s, i) => <i key={s} className={i <= idx ? "on" : ""} style={{ background: i <= idx ? "var(--cyan)" : undefined }} />)}
      </div>
      <div className="row between xs"><span>Abierto</span><span>En revisión</span><span>Resuelto</span></div>
      <div className="box n4 col" style={{ gap: 4 }}>
        <span className="lbl" style={{ fontSize: 16 }}>Motivo</span>
        <b>{KIND[c.kind] ?? c.kind}{c.match ? ` · Mesa ${(c.match as { table_no: number }).table_no}` : ""}</b>
        {c.resolution && <span className="sm ok">Resolución: {c.resolution}</span>}
      </div>
      <div className="list">
        {(msgs ?? []).map((m) => {
          const who = m.role === "judge" ? `Juez · ${(m.profile as { username?: string } | null)?.username ?? "staff"}` : m.role === "system" ? "Reta" : m.author === me.id ? "Tú" : "Tu rival";
          return (
            <div key={m.id} className="box n4 col" style={{ gap: 4, boxShadow: m.role === "judge" ? "inset 3px 0 0 var(--violet-soft)" : undefined }}>
              <div className="row between"><b className="sm" style={{ color: "var(--ink)" }}>{who}</b><span className="xs">{relTime(m.at)}</span></div>
              <span className="sm" style={{ color: "var(--ink-3)" }}>{m.body ?? CODE[m.code ?? ""] ?? m.code}</span>
              {m.attachment && <span className="xs row" style={{ gap: 4 }}><Icon name="img" size={14} />Captura adjunta</span>}
            </div>
          );
        })}
      </div>
      {c.status !== "resolved" && <CaseReply caseId={c.id} tournamentId={c.tournament_id} userId={me.id} />}
    </main>
  );
}
