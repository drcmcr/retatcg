import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { rankFromPR } from "@/lib/game";
import { loadTournament } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { ResultSteps } from "./ResultSteps";

export const metadata = { title: "Tu resultado" };

export default async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe(`/resultado/${id}`);
  const t = await loadTournament(id);
  if (!t) notFound();
  const supabase = await supabaseServer();
  const { data: r } = await supabase.from("results").select("*").eq("tournament_id", id).eq("user_id", me.id).maybeSingle();
  if (!r) notFound();
  const { count } = await supabase.from("results").select("registration_id", { count: "exact", head: true }).eq("tournament_id", id);
  const before = Math.max(0, me.pr - r.pr_delta);
  const rankBefore = rankFromPR(before);
  const rankNow = rankFromPR(me.pr);
  const b = r.pr_breakdown as { wins?: number; losses?: number; draws?: number; placementBonus?: number; multiplier?: number; eligible?: boolean; reason?: string };
  return (
    <main className="app" style={{ minHeight: "auto" }}>
      <ResultSteps
        tournament={{ name: t.name, code: t.code, top: t.top_cut, category: t.category }}
        result={{ placement: r.placement, wins: r.wins, losses: r.losses, draws: r.draws, prDelta: r.pr_delta, newMedals: r.new_medals, players: count ?? 0 }}
        breakdown={b}
        pr={{ before, now: me.pr }}
        rank={{ beforeName: `${rankBefore.name} ${rankBefore.division}`, nowName: `${rankNow.name} ${rankNow.division}`, up: rankNow.index > rankBefore.index || (rankNow.index === rankBefore.index && rankNow.division !== rankBefore.division && r.pr_delta > 0) }}
        card={{ userId: me.id, username: me.username, pr: me.pr, medals: me.medals, titleMedal: me.titleMedal, titleForm: me.titleForm, season: me.season?.id }}
      />
    </main>
  );
}
