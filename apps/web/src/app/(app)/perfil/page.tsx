import Link from "next/link";
import { HunterCard } from "@/components/HunterCard";
import { Icon } from "@/components/Icon";
import { Stat } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { ordinal } from "@/lib/format";
import { history, leaderboardPosition } from "@/lib/profile";

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const me = await requireMe("/perfil");
  const [h, pos] = await Promise.all([history(me.id, 200), me.season ? leaderboardPosition(me.id, me.season.id, me.pr) : Promise.resolve(undefined)]);
  const w = h.reduce((s, r) => s + r.wins, 0), l = h.reduce((s, r) => s + r.losses, 0), d = h.reduce((s, r) => s + r.draws, 0);
  const best = h.length ? Math.min(...h.map((r) => r.placement)) : null;
  return (
    <main className="screen">
      <div className="tb">
        <h1>Perfil</h1>
        <Link href="/perfil/compartir" className="ib" aria-label="Compartir mi tarjeta"><Icon name="share" /></Link>
        <Link href="/ajustes" className="ib" aria-label="Ajustes"><Icon name="gear" /></Link>
      </div>
      {me.deletingAt && <Link href="/ajustes/privacidad" className="banner err n4">Tu cuenta se borrará pronto. Toca para cancelar.</Link>}
      <HunterCard d={{ userId: me.id, username: me.username, pr: me.pr, medals: me.medals, titleMedal: me.titleMedal, titleForm: me.titleForm, season: me.season?.id, leaderboardPosition: pos }} />
      <div className="row" style={{ gap: 10 }}>
        <Stat value={h.length} label="Torneos" />
        <Stat value={`${w}-${l}-${d}`} label="Récord" />
        <Stat value={best ? ordinal(best) : "—"} label="Mejor" tone="lime" />
      </div>
      <div className="list">
        {[["/perfil/medallas", "star", "Medallas", `${me.medals.length} de 8 esta temporada`], ["/perfil/titulos", "flag", "Títulos", "Elige el que muestras"], ["/perfil/rangos", "chart", "Rangos y temporada", pos ? `#${pos} en el ranking` : ""],
          ["/perfil/historial", "list", "Historial de torneos", ""], ["/perfil/estadisticas", "chart", "Estadísticas", ""], ["/perfil/editar", "edit", "Editar perfil", ""], ["/guia", "doc", "Guía de Reta", "Cómo funciona todo"]].map(([href, ic, l, sub]) => (
          <Link key={href} href={href!} className="li n4">
            <span className="avatar n4" style={{ background: "var(--card)" }}><Icon name={ic as "star"} /></span>
            <span className="grow"><span className="ttl">{l}</span>{sub && <span className="xs">{sub}</span>}</span>
            <Icon name="right" size={20} />
          </Link>
        ))}
        {(me.isOrganizer || me.roles.length > 0) && (
          <Link href="/staff" className="li n4"><span className="avatar n4" style={{ background: "var(--violet)", color: "var(--white)" }}><Icon name="gear" /></span><span className="grow"><span className="ttl">Panel del staff</span><span className="xs">Torneos que organizas o arbitras</span></span><Icon name="right" size={20} /></Link>
        )}
      </div>
    </main>
  );
}
