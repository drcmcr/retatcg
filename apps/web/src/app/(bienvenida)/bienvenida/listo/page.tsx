import Link from "next/link";
import { HunterCard } from "@/components/HunterCard";
import { requireMe } from "@/lib/auth";

export const metadata = { title: "¡A la caza!" };

export default async function Listo({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const next = sp.siguiente?.startsWith("/") && !sp.siguiente.startsWith("//") ? sp.siguiente : undefined;
  return (
    <main className="app">
      <div className="chk screen" style={{ justifyContent: "center" }}>
        <div className="panel n6 col fade-in" style={{ gap: 14, textAlign: "center" }}>
          <span className="px20 lime" style={{ fontSize: 40, lineHeight: 1 }}>¡A la caza!</span>
          <span className="sm">Esta es tu tarjeta de cazador.</span>
          <div style={{ textAlign: "left" }}>
            <HunterCard d={{ userId: me.id, username: me.username, pr: me.pr, medals: me.medals, titleMedal: null, titleForm: null, season: me.season?.id }} />
          </div>
          {next?.startsWith("/torneo/") ? (
            <>
              <Link href={next} className="btn p">Volver al torneo para inscribirme</Link>
              <Link href="/instalar" className="btn s">Activar avisos (te recuerdan el check-in)</Link>
            </>
          ) : <Link href="/instalar" className="btn p">Siguiente: avisos</Link>}
          <Link href="/guia" className="btn g">Cómo funciona Reta (guía)</Link>
          {!next && <Link href="/inicio" className="btn s">Ir a inicio</Link>}
        </div>
      </div>
    </main>
  );
}
