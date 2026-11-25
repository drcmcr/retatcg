import Link from "next/link";
import { Logo } from "@/components/Brand";
import { BottomNav } from "@/components/BottomNav";
import { getMe } from "@/lib/auth";
import { whatsNow } from "@/lib/queries";

/** Torneos: se ven con o sin cuenta. Con cuenta, aparece la barra inferior. */
export default async function OpenLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) {
    return (
      <div className="app">
        <div className="tb" style={{ padding: "12px 18px 0" }}>
          <Link href="/" aria-label="Reta" style={{ textDecoration: "none" }}><Logo h={22} /></Link>
          <span className="grow" />
          <Link href="/entrar" className="btn p sm">Entrar</Link>
        </div>
        {children}
      </div>
    );
  }
  const { center } = await whatsNow(me.id);
  return (
    <div className="app nav-pad">
      {children}
      <BottomNav center={center} />
    </div>
  );
}
