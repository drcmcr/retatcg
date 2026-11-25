"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import type { Center } from "@/lib/queries";

const ITEMS: { href: string; label: string; icon: IconName; match: RegExp }[] = [
  { href: "/inicio", label: "Inicio", icon: "home", match: /^\/inicio/ },
  { href: "/torneos", label: "Torneos", icon: "trophy", match: /^\/(torneos|torneo)/ },
  { href: "/comunidad", label: "Comunidad", icon: "users", match: /^\/(comunidad|jugador)/ },
  { href: "/perfil", label: "Perfil", icon: "user", match: /^\/(perfil|ajustes|ayuda)/ },
];

export function BottomNav({ center }: { center: Center }) {
  const path = usePathname();
  const item = (i: (typeof ITEMS)[number]) => {
    const on = i.match.test(path);
    return (
      <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
        <Icon name={i.icon} size={24} />
        <span>{i.label}</span>
      </Link>
    );
  };
  return (
    <nav className="nav" aria-label="Navegación principal">
      {item(ITEMS[0]!)}
      {item(ITEMS[1]!)}
      <Link href={center.href} className={`ctr ${center.idle ? "idle" : ""}`}>
        <b className={`n4 ${center.pulse ? "pulse" : ""}`}><Icon name={center.icon} size={26} weight={2.4} /></b>
        <span>{center.label}</span>
      </Link>
      {item(ITEMS[2]!)}
      {item(ITEMS[3]!)}
    </nav>
  );
}
