import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { CHAPTERS, chapterIndex } from "@/lib/guia";

export const dynamicParams = false;
export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ cap: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ cap: string }> }) {
  const c = CHAPTERS[chapterIndex((await params).cap)];
  return c ? { title: `${c.title} · Guía`, description: c.summary } : {};
}

export default async function Capitulo({ params }: { params: Promise<{ cap: string }> }) {
  const i = chapterIndex((await params).cap);
  if (i < 0) notFound();
  const c = CHAPTERS[i]!;
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  return (
    <main className="guide">
      <div className="tb">
        <Link href="/guia" className="ib" aria-label="Volver a la guía"><Icon name="back" /></Link>
        <span className="lbl grow">Guía · {i + 1} de {CHAPTERS.length}</span>
      </div>
      <h1 className="t1">{c.title}</h1>
      <p className="sm">{c.summary}</p>
      {c.body}
      <nav className="pager" aria-label="Capítulos">
        {prev && <Link href={`/guia/${prev.slug}`} className="n4"><small>Anterior</small>{prev.title}</Link>}
        {next && <Link href={`/guia/${next.slug}`} className="next n4"><small>Siguiente</small>{next.title}</Link>}
      </nav>
      {!next && <Link href="/guia" className="btn g">Volver al índice</Link>}
    </main>
  );
}
