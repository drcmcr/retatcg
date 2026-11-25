import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Empty, TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { MarkAll } from "./MarkAll";

export const metadata = { title: "Avisos" };

const ICON: Record<string, IconName> = { ronda: "play", mesa: "msg", caso: "judge", anuncio: "megaphone", resultado: "trophy", torneo: "cal", staff: "gear", sancion: "flag", mazo: "img", rol: "shield", moderacion: "warn" };

export default async function Avisos() {
  const me = await requireMe("/avisos");
  const supabase = await supabaseServer();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", me.id).order("created_at", { ascending: false }).limit(80);
  const list = data ?? [];
  return (
    <main className="screen">
      <TopBar title="Avisos" back="/inicio" right={list.some((n) => !n.read_at) ? <MarkAll /> : undefined} />
      {!list.length ? <Empty icon="bell" title="Sin avisos por ahora"><p className="sm">Aquí llegan tus rondas, reportes, casos y anuncios de los torneos.</p></Empty> : (
        <div className="list">
          {list.map((n) => (
            <Link key={n.id} href={n.link ?? "#"} className="li n4" style={!n.read_at ? { boxShadow: "inset 3px 0 0 var(--lime)" } : undefined}>
              <span className="avatar n4" style={{ background: n.kind === "ronda" && !n.read_at ? "var(--lime)" : "var(--card)", color: n.kind === "ronda" && !n.read_at ? "var(--bg)" : "var(--ink)" }}><Icon name={ICON[n.kind] ?? "bell"} size={20} /></span>
              <span className="grow"><span className="ttl" style={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</span>{n.body && <span className="xs">{n.body}</span>}</span>
              <span className="xs nw">{relTime(n.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
