import Link from "next/link";
import { redirect } from "next/navigation";
import { Iso, Wordmark } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { getMe, getUser } from "@/lib/auth";

export default async function Bienvenida() {
  if (await getUser()) redirect((await getMe()) ? "/inicio" : "/bienvenida");
  return (
    <main className="app">
      <div className="chk" style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "42dvh" }}>
        <Iso h={190} />
      </div>
      <div className="screen" style={{ flex: "none", gap: 14, paddingBottom: 28 }}>
        <Wordmark h={36} />
        <h1 className="t1" style={{ fontSize: 30 }}>Torneos de TCG Pocket</h1>
        <ul className="col sm" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6, color: "var(--ink-3)" }}>
          <li className="row"><Icon name="lock" size={18} />Contraseña de partida automática</li>
          <li className="row"><Icon name="chart" size={18} />Ranking y rangos por temporada</li>
          <li className="row"><Icon name="star" size={18} />Tu tarjeta de cazador y medallas</li>
        </ul>
        <div className="btns" style={{ marginTop: 8 }}>
          <Link href="/entrar" className="btn p">Entrar con correo</Link>
          <Link href="/torneos" className="btn g">Ver torneos</Link>
        </div>
        <p className="xs" style={{ textAlign: "center" }}>Reta no está afiliada a The Pokémon Company ni a Nintendo. Beta para mayores de 18 años.</p>
      </div>
    </main>
  );
}
