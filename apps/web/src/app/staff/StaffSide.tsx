"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Brand";
import { Icon, type IconName } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";

type Item = { href: string; label: string; icon: IconName; badge?: number };

export function StaffSide({ me, current, superadmin, organizer }: { me: { id: string; username: string }; current: { id: string; name: string; cases: number; decks: number } | null; superadmin: boolean; organizer: boolean }) {
  const path = usePathname();
  const link = (i: Item, exact = false) => {
    const on = exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
    return (
      <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}>
        <Icon name={i.icon} size={20} />
        <span className="grow">{i.label}</span>
        {!!i.badge && <span className="pill l">{i.badge}</span>}
      </Link>
    );
  };
  return (
    <aside className="side" aria-label="Menú del staff">
      <div style={{ padding: "4px 8px 14px" }}><Link href="/inicio" aria-label="Volver a la app" style={{ textDecoration: "none" }}><Logo h={22} /></Link></div>
      <span className="grp">Torneos</span>
      {link({ href: "/staff", label: "Mis torneos", icon: "trophy" }, true)}
      {organizer && link({ href: "/staff/crear", label: "Crear torneo", icon: "plus" })}
      {current && (
        <>
          <span className="grp" title={current.name}>{current.name.length > 22 ? current.name.slice(0, 21) + "…" : current.name}</span>
          {link({ href: `/staff/torneo/${current.id}`, label: "Control de ronda", icon: "play" }, true)}
          {link({ href: `/staff/torneo/${current.id}/casos`, label: "Casos", icon: "judge", badge: current.cases })}
          {link({ href: `/staff/torneo/${current.id}/mazos`, label: "Revisar mazos", icon: "img", badge: current.decks })}
          {link({ href: `/staff/torneo/${current.id}/inscritos`, label: "Inscritos y staff", icon: "users" })}
          {link({ href: `/staff/torneo/${current.id}/auditoria`, label: "Auditoría", icon: "list" })}
        </>
      )}
      {superadmin && (
        <>
          <span className="grp">Plataforma</span>
          {link({ href: "/staff/plataforma", label: "Temporadas y roles", icon: "shield" })}
        </>
      )}
      <Link href="/perfil" className="mt-a" style={{ marginTop: "auto" }}>
        <Identicon seed={me.id} size={26} /><span className="grow xs">{me.username}{superadmin ? " · superadmin" : ""}</span>
      </Link>
    </aside>
  );
}
