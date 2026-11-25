import { requireTournamentStaff } from "@/lib/staff";
import { fmtDateTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Auditoría" };

export default async function Auditoria({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("audit_log").select("at,action,detail,profile:profiles(username)").eq("tournament_id", t.id).order("at", { ascending: false }).limit(300);
  return (
    <>
      <h1 className="t1">Auditoría</h1>
      <table className="tbl" style={{ fontSize: 15 }}>
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>
          {(data ?? []).map((a, i) => (
            <tr key={i}>
              <td className="mono nw">{fmtDateTime(a.at)}</td>
              <td style={{ fontWeight: 700 }}>{(a.profile as { username?: string } | null)?.username ?? "Reta"}</td>
              <td>{a.action}</td>
              <td className="muted xs">{Object.entries((a.detail ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
