import { BottomNav } from "@/components/BottomNav";
import { LiveRefresh } from "@/components/client";
import { requireMe } from "@/lib/auth";
import { whatsNow } from "@/lib/queries";

/** Pantallas del jugador: cuenta completa y barra inferior con el botón de "lo que te toca". */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const { center } = await whatsNow(me.id);
  return (
    <div className="app nav-pad" data-reduce-motion="false">
      {children}
      <BottomNav center={center} />
      <LiveRefresh channel={`yo-${me.id}`} watch={[{ table: "notifications", filter: `user_id=eq.${me.id}` }]} />
    </div>
  );
}
