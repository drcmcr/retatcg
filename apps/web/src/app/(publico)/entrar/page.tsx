import { EmailForm } from "./EmailForm";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="app">
      <div className="screen">
        <EmailForm next={sp.siguiente} linkError={sp.error === "enlace"} />
      </div>
    </main>
  );
}
