import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { ShareCard } from "./ShareCard";

export const metadata = { title: "Compartir tarjeta" };

export default async function Compartir() {
  const me = await requireMe("/perfil/compartir");
  return (
    <main className="screen">
      <TopBar title="Compartir" back="/perfil" />
      <ShareCard username={me.username} />
      <p className="xs">La imagen nunca lleva tu nombre en Pocket ni tu ID de amigo.</p>
    </main>
  );
}
