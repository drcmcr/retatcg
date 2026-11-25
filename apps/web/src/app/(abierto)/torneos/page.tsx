import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TournamentCard } from "@/components/TournamentCard";
import { Empty } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { RANK_NAMES } from "@/lib/ranks";
import { tournamentCards } from "@/lib/lists";
import { supabaseServer } from "@/lib/supabase/server";
import { rankFromPR } from "@/lib/game";

export const metadata = { title: "Torneos" };

const TABS = [["abiertos", "Abiertos"], ["mios", "Míos"], ["pasados", "Pasados"]] as const;
const CATS = [["", "Todos"], ["comunitario", "Comunitario"], ["clasificatorio", "Clasificatorio"], ["casual", "Casual"]] as const;

export default async function Torneos({ searchParams }: { searchParams: Promise<{ pestana?: string; cat?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.pestana) ? sp.pestana! : "abiertos";
  const cat = CATS.some(([k]) => k === sp.cat) ? sp.cat : "";
  const me = await getMe();
  let ids: string[] | undefined;
  if (tab === "mios") {
    if (!me) return <main className="screen"><Header tab={tab} cat={cat} /><Empty icon="user" title="Entra para ver tus torneos"><Link className="btn p" href="/entrar?siguiente=/torneos">Entrar</Link></Empty></main>;
    const supabase = await supabaseServer();
    const { data } = await supabase.from("registrations").select("tournament_id").eq("user_id", me.id).neq("status", "removed");
    ids = (data ?? []).map((r) => r.tournament_id);
  }
  const list = await tournamentCards({
    status: tab === "pasados" ? ["finished"] : tab === "mios" ? ["registration", "running", "finished"] : ["registration", "running"],
    ids, category: cat || undefined, ascending: tab !== "pasados",
  });
  const myRank = me ? rankFromPR(me.pr).index : 0;
  return (
    <main className="screen">
      <Header tab={tab} cat={cat} />
      {list.length === 0 ? (
        <Empty icon="trophy" title={tab === "pasados" ? "Aún no hay torneos terminados" : "No hay torneos aquí todavía"}>
          <p className="sm">Si un organizador te pasó un código, úsalo en Unirse.</p>
          <Link href="/unirse" className="btn g">Tengo código</Link>
        </Empty>
      ) : (
        <div className="list">
          {list.map((t) => (
            <TournamentCard key={t.id} t={t} locked={t.min_rank > myRank && t.status === "registration" ? `Requiere rango ${RANK_NAMES[t.min_rank]} o superior` : undefined} />
          ))}
        </div>
      )}
    </main>
  );
}

function Header({ tab, cat }: { tab: string; cat: string | undefined }) {
  return (
    <>
      <div className="tb">
        <h1>Torneos</h1>
        <Link href="/unirse" className="ib" aria-label="Unirse con código o QR"><Icon name="qr" /></Link>
      </div>
      <nav className="seg" aria-label="Pestañas de torneos">
        {TABS.map(([k, l]) => <Link key={k} href={`/torneos?pestana=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>
      {tab === "abiertos" && (
        <div className="chips">
          {CATS.map(([k, l]) => <Link key={k} className="chip" href={`/torneos?pestana=abiertos${k ? `&cat=${k}` : ""}`} aria-current={(cat ?? "") === k ? "page" : undefined}>{l}</Link>)}
        </div>
      )}
    </>
  );
}
