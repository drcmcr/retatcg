import Link from "next/link";
import { Logo } from "@/components/Brand";
import { Icon } from "@/components/Icon";

export function HomeBar({ unread }: { unread: number }) {
  return (
    <div className="tb">
      <Link href="/inicio" aria-label="Reta, inicio" style={{ textDecoration: "none" }}><Logo h={22} /></Link>
      <span className="grow" />
      <Link href="/avisos" className="ib bare bell" aria-label={unread ? `Avisos, ${unread} sin leer` : "Avisos"}>
        <Icon name="bell" />
        {unread > 0 && <i />}
      </Link>
    </div>
  );
}
