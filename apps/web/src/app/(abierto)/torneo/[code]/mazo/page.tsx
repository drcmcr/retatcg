import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { describeRestrictions } from "@/lib/restrictions";
import { loadTournamentByCode } from "@/lib/tournament";
import { supabaseServer } from "@/lib/supabase/server";
import { DeckForm } from "./DeckForm";

export const metadata = { title: "Declarar mazo" };

export default async function Mazo({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await requireMe(`/torneo/${code}/mazo`);
  const t = await loadTournamentByCode(code);
  if (!t) notFound();
  const rules = describeRestrictions(t.restrictions);
  const policy = t.deck_policy === "libre" && rules.length ? "por_ronda" : t.deck_policy;
  if (policy === "libre") redirect(`/torneo/${t.code}`);
  const round = policy === "fijo" ? 0 : t.status === "running" ? t.current_round + 1 : 1;
  const supabase = await supabaseServer();
  const { data: reg } = await supabase.from("registrations").select("id").eq("tournament_id", t.id).eq("user_id", me.id).maybeSingle();
  const { data: prev } = reg
    ? await supabase.from("deck_declarations").select("archetype,round,status,note").eq("registration_id", reg.id).order("round", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  return (
    <main className="screen">
      <TopBar title="Declarar mazo" back={`/torneo/${t.code}`} />
      <span className="sm">{policy === "fijo" ? "Mazo fijo: el mismo para todo el torneo." : `Para la ronda ${round}: declara antes de que salga el emparejamiento.`} Solo lo ve el staff.</span>
      {prev?.status === "infraction" && (
        <div className="banner err n4" role="alert">El staff marcó tu mazo anterior: {prev.note ?? "no cumple las reglas"}. Declara uno corregido.</div>
      )}
      <DeckForm tournamentId={t.id} userId={me.id} round={round} rules={rules} initialArchetype={prev?.archetype ?? ""} code={t.code} />
    </main>
  );
}
