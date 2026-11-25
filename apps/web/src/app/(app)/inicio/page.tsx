import Link from "next/link";
import { Countdown } from "@/components/client";
import { HomeBar } from "@/components/HomeBar";
import { HunterCard } from "@/components/HunterCard";
import { Icon } from "@/components/Icon";
import { Empty, Prog } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { daysUntil, fmtDateTime } from "@/lib/format";
import { PACE_LABEL } from "@/lib/game";
import { unreadCount, whatsNow } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Inicio" };

export default async function Inicio() {
  const me = await requireMe();
  const supabase = await supabaseServer();
  const [{ banner }, unread, { data: regs }] = await Promise.all([
    whatsNow(me.id),
    unreadCount(me.id),
    supabase
      .from("registrations")
      .select("status,tournament:tournaments!inner(id,code,name,status,starts_at,pace,current_round,swiss_rounds)")
      .eq("user_id", me.id)
      .in("status", ["registered", "checked_in", "waitlist"])
      .in("tournament.status", ["registration", "running"])
      .order("created_at", { ascending: false }),
  ]);
  const mine = (regs ?? []) as unknown as { status: string; tournament: { id: string; code: string; name: string; status: string; starts_at: string; pace: { kind: string }; current_round: number } }[];
  const seasonDays = me.season ? daysUntil(me.season.endsAt) : 0;

  return (
    <main className="screen">
      <HomeBar unread={unread} />
      {banner && (
        <Link href={banner.href} className="btn p n4" style={{ justifyContent: "space-between" }}>
          <span className="row"><Icon name="play" size={20} weight={2.4} />{banner.text}</span>
          {banner.ends && <Countdown to={banner.ends} className="mono" />}
        </Link>
      )}
      <Link href="/perfil" style={{ textDecoration: "none", color: "inherit" }} aria-label="Ver mi perfil">
        <HunterCard d={{ userId: me.id, username: me.username, pr: me.pr, medals: me.medals, titleMedal: me.titleMedal, titleForm: me.titleForm, season: me.season?.id }} />
      </Link>
      {mine.length === 0 ? (
        <Empty icon="trophy" title="Encuentra tu primera reta">
          <p className="sm">Inscríbete a un torneo abierto o entra con el código que te dio el organizador.</p>
          <div className="btns" style={{ width: "100%" }}>
            <Link href="/torneos" className="btn p n4">Ver torneos</Link>
            <Link href="/unirse" className="btn g">Tengo código</Link>
            <Link href="/guia" className="link" style={{ textAlign: "center" }}>¿Primera vez? Lee la guía</Link>
          </div>
        </Empty>
      ) : (
        <section className="col" aria-labelledby="tus-torneos">
          <div className="row between">
            <h2 id="tus-torneos" className="lbl" style={{ margin: 0 }}>Tus torneos</h2>
            <Link href="/torneos?pestana=mios" className="link" style={{ padding: 0 }}>Ver todo</Link>
          </div>
          <div className="list">
            {mine.map(({ status, tournament: t }) => (
              <Link key={t.id} href={`/torneo/${t.code}`} className="li n4">
                <span className="avatar n4" style={{ background: t.status === "running" ? "var(--violet)" : "var(--surface)", color: "var(--white)" }}>
                  <Icon name={t.status === "running" ? "play" : "cal"} />
                </span>
                <span className="grow">
                  <span className="ttl">{t.name}</span>
                  <span className="xs">
                    {t.status === "running" ? `En curso · ronda ${t.current_round}` : fmtDateTime(t.starts_at)} · {PACE_LABEL[t.pace.kind]} ·{" "}
                    {status === "waitlist" ? "Lista de espera" : status === "checked_in" ? "Check-in listo" : "Inscrito"}
                  </span>
                </span>
                <Icon name="right" size={20} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {me.season && (
        <section className="col" style={{ gap: 6 }}>
          <div className="row between">
            <span className="lbl">{me.season.name}</span>
            <span className="xs">Faltan {seasonDays} días</span>
          </div>
          <Prog filled={Math.max(1, Math.round(20 - (seasonDays / 92) * 20))} />
        </section>
      )}
    </main>
  );
}
