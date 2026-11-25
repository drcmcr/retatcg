import { Empty } from "@/components/ui";
import { describeRestrictions } from "@/lib/restrictions";
import { requireTournamentStaff } from "@/lib/staff";
import { loadRegs, regName } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { DeckReview } from "./DeckReview";

export const metadata = { title: "Revisar mazos" };

export default async function Mazos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await requireTournamentStaff(id);
  const estado = ["unreviewed", "approved", "infraction"].includes(sp.estado ?? "") ? sp.estado! : "unreviewed";
  const supabase = await supabaseServer();
  const [{ data }, regs] = await Promise.all([
    supabase.from("deck_declarations").select("*").eq("tournament_id", t.id).eq("status", estado).order("created_at"),
    loadRegs(t.id),
  ]);
  const byId = new Map(regs.map((r) => [r.id, r]));
  const list = await Promise.all((data ?? []).map(async (d) => {
    const { data: u } = await supabase.storage.from("capturas").createSignedUrl(d.screenshot, 900);
    return { id: d.id as string, player: regName(byId.get(d.registration_id)), archetype: d.archetype as string, round: d.round as number, url: u?.signedUrl ?? null, note: d.note as string | null };
  }));
  return (
    <>
      <div className="row between wrap">
        <h1 className="t1">Revisar mazos</h1>
        <div className="chips">
          {[["unreviewed", "Sin revisar"], ["approved", "Aprobados"], ["infraction", "Infracción"]].map(([k, l]) => (
            <a key={k} href={`?estado=${k}`} className="chip" aria-current={estado === k ? "page" : undefined}>{l}</a>
          ))}
        </div>
      </div>
      {list.length === 0 ? <Empty icon="img" title="Nada por revisar aquí" /> : <DeckReview decks={list} rules={["20 cartas, máximo 2 copias por nombre", ...describeRestrictions(t.restrictions)]} />}
    </>
  );
}
