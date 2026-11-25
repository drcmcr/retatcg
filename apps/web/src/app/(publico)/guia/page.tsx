import Link from "next/link";
import { Logo } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { getUser } from "@/lib/auth";
import { CHAPTERS } from "@/lib/guia";

export const metadata = { title: "Guía", description: "Cómo funciona Reta: secciones, torneos, mesa, rangos, medallas y panel del staff." };

export default async function Guia() {
  const user = await getUser();
  return (
    <main className="guide">
      <div className="tb">
        <Link href={user ? "/perfil" : "/"} className="ib" aria-label="Volver"><Icon name="back" /></Link>
        <span className="grow" />
        <Link href="/" aria-label="Reta" style={{ textDecoration: "none" }}><Logo h={22} /></Link>
      </div>
      <span className="lp-kick">Guía de Reta</span>
      <h1 className="t1">Todo lo que necesitas para jugar y organizar</h1>
      <p>Nueve capítulos cortos. Léelos en orden la primera vez o ve directo al que necesites.</p>
      <ol className="list plain">
        {CHAPTERS.map((c, i) => (
          <li key={c.slug}>
            <Link href={`/guia/${c.slug}`} className="chap n4">
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span className="grow"><span className="ttl">{c.title}</span><span className="sm">{c.summary}</span></span>
              <Icon name="right" size={20} />
            </Link>
          </li>
        ))}
      </ol>
      <div className="tip n4"><Icon name="judge" size={18} /><span>¿Algo no está aquí? En una partida, llama al juez desde tu mesa. Para lo demás, escribe al organizador de tu torneo.</span></div>
      {!user && <Link href="/entrar" className="btn p">Crear mi cuenta</Link>}
    </main>
  );
}
