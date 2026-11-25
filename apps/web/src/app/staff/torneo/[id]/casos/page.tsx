import Link from "next/link";
import { LiveRefresh } from "@/components/client";
import { Empty } from "@/components/ui";
import { relTime } from "@/lib/format";
import { CASE_KIND as KIND } from "@/lib/game";
import { requireTournamentStaff } from "@/lib/staff";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Casos" };

export default async function Casos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("cases").select("id,kind,status,created_at,match:matches(table_no)").eq("tournament_id", t.id).order("status").order("created_at", { ascending: false });
  const list = data ?? [];
  return (
    <>
      <LiveRefresh channel={`casos-${t.id}`} watch={[{ table: "cases", filter: `tournament_id=eq.${t.id}` }]} />
      <h1 className="t1">Casos</h1>
      {!list.length ? <Empty icon="judge" title="Sin casos por ahora" /> : (
        <div className="list" style={{ maxWidth: 720 }}>
          {list.map((c) => (
            <Link key={c.id} href={`/staff/torneo/${t.id}/casos/${c.id}`} className="li n4" style={c.status !== "resolved" ? { boxShadow: "inset 3px 0 0 var(--warn)" } : undefined}>
              <span className="grow"><span className="ttl">#{c.id} · {KIND[c.kind]}{c.match ? ` · Mesa ${(c.match as unknown as { table_no: number }).table_no}` : ""}</span>
                <span className="xs">{c.status === "resolved" ? "Resuelto" : c.status === "review" ? "En revisión" : "Abierto"}</span></span>
              <span className="xs nw">{relTime(c.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
