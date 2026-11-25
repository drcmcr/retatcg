import { redirect } from "next/navigation";
import { CodeForm } from "./CodeForm";

export const metadata = { title: "Escribe tu código" };

export default async function Codigo({ searchParams }: { searchParams: Promise<{ correo?: string; siguiente?: string }> }) {
  const sp = await searchParams;
  if (!sp.correo) redirect("/entrar");
  return (
    <main className="app">
      <div className="screen">
        <CodeForm email={sp.correo} next={sp.siguiente} />
      </div>
    </main>
  );
}
