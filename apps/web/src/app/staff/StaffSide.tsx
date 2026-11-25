"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Brand";
import { Icon, type IconName } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";

type Item = { href: string; label: string; short?: string; icon: IconName; badge?: number; exact?: boolean };
type Current = { id: string; name: string; cases: number; decks: number } | null;

function tournamentItems(current: Current) {
  const tournament: Item[] = current
    ? [
        { href: `/staff/torneo/${current.id}`, label: "Control de ronda", short: "Control", icon: "play", exact: true },
        { href: `/staff/torneo/${current.id}/casos`, label: "Casos", icon: "judge", badge: current.cases },
        { href: `/staff/torneo/${current.id}/mazos`, label: "Revisar mazos", short: "Mazos", icon: "img", badge: current.decks },
        { href: `/staff/torneo/${current.id}/inscritos`, label: "Inscritos y staff", short: "Inscritos", icon: "users" },
        { href: `/staff/torneo/${current.id}/auditoria`, label: "Auditoría", icon: "list" },
      ]
    : [];
  return tournament;
}

export function StaffSide({ me, current, superadmin, organizer }: { me: { id: string; username: string }; current: Current; superadmin: boolean; organizer: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const tItems = tournamentItems(current);
  const isOn = (i: Item) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));

  const link = (i: Item) => (
    <Link key={i.href} href={i.href} aria-current={isOn(i) ? "page" : undefined}>
      <Icon name={i.icon} size={20} />
      <span className="grow">{i.label}</span>
      {!!i.badge && <span className="pill l">{i.badge}</span>}
    </Link>
  );

  const nav = (
    <>
      <span className="grp">Torneos</span>
      {link({ href: "/staff", label: "Mis torneos", icon: "trophy", exact: true })}
      {organizer && link({ href: "/staff/crear", label: "Crear torneo", icon: "plus" })}
      {current && (
        <>
          <span className="grp" title={current.name}>{current.name.length > 22 ? current.name.slice(0, 21) + "…" : current.name}</span>
          {tItems.map(link)}
        </>
      )}
      {superadmin && (
        <>
          <span className="grp">Plataforma</span>
          {link({ href: "/staff/plataforma", label: "Temporadas y roles", icon: "shield" })}
        </>
      )}
      <span className="grp">App</span>
      {link({ href: "/inicio", label: "Volver a la app", icon: "back" })}
      <Link href="/perfil" style={{ marginTop: "auto" }}>
        <Identicon seed={me.id} size={26} /><span className="grow xs">{me.username}{superadmin ? " · superadmin" : ""}</span>
      </Link>
    </>
  );

  return (
    <>
      {/* Escritorio: menú lateral fijo */}
      <aside className="side" aria-label="Menú del staff">
        <div style={{ padding: "4px 8px 14px" }}><Link href="/inicio" aria-label="Volver a la app" style={{ textDecoration: "none" }}><Logo h={22} /></Link></div>
        {nav}
      </aside>

      {/* Teléfono: barra superior, pestañas del torneo y menú desplegable */}
      <header className="smob">
        <div className="smob-bar">
          <Link href="/staff" aria-label="Mis torneos" className="ib bare"><Icon name="trophy" /></Link>
          <div className="grow col" style={{ gap: 0 }}>
            <span className="lbl" style={{ fontSize: 14 }}>Staff</span>
            <b className="smob-title">{current ? current.name : path.startsWith("/staff/crear") ? "Crear torneo" : path.startsWith("/staff/plataforma") ? "Plataforma" : "Mis torneos"}</b>
          </div>
          <button className="ib" aria-label="Abrir menú del staff" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="list" /></button>
        </div>
        {current && (
          <nav className="smob-tabs" aria-label={`Secciones de ${current.name}`}>
            {tItems.map((i) => (
              <Link key={i.href} href={i.href} aria-current={isOn(i) ? "page" : undefined}>
                <Icon name={i.icon} size={16} />{i.short ?? i.label}
                {!!i.badge && <span className="pill l">{i.badge}</span>}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {open && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Menú del staff"
          onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) setOpen(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <div className="side">
            <div className="row between" style={{ padding: "0 4px 10px 8px" }}>
              <Logo h={20} />
              <button className="ib" aria-label="Cerrar menú" autoFocus onClick={() => setOpen(false)}><Icon name="x" /></button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
