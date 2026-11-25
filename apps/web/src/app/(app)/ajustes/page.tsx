import Link from "next/link";
import { signOut } from "@/actions/auth";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { SettingsToggles } from "./SettingsToggles";

export const metadata = { title: "Ajustes" };

export default async function Ajustes() {
  const me = await requireMe("/ajustes");
  const supabase = await supabaseServer();
  const { data: priv } = await supabase.from("profile_private").select("pocket_name,friend_id,timezone,notify,reduce_motion").eq("user_id", me.id).single();
  const row = (href: string, icon: Parameters<typeof Icon>[0]["name"], title: string, sub?: string) => (
    <Link href={href} className="li n4"><Icon name={icon} /><span className="grow"><span className="ttl">{title}</span>{sub && <span className="xs">{sub}</span>}</span><Icon name="right" size={20} /></Link>
  );
  return (
    <main className="screen">
      <TopBar title="Ajustes" back="/perfil" />
      <div className="list">
        {row("/perfil/editar", "user", "Cuenta y datos de Pocket", me.email ?? undefined)}
      </div>
      <SettingsToggles isPrivate={me.isPrivate} notify={(priv?.notify ?? {}) as Record<string, boolean>} reduceMotion={!!priv?.reduce_motion}
        pocket={{ name: priv?.pocket_name ?? "", friendId: priv?.friend_id ?? "", tz: priv?.timezone ?? "America/Mexico_City" }} />
      <div className="list">
        {row("/ayuda", "info", "Ayuda y reglamento")}
        {row("/ajustes/privacidad", "shield", "Privacidad y datos", "Descargar o eliminar")}
        {row("/legal/privacidad", "doc", "Aviso de privacidad y términos")}
        {row("/instalar", "phone", "Instalar la app y activar avisos")}
      </div>
      <form action={signOut}><button className="btn g"><Icon name="out" size={20} />Cerrar sesión</button></form>
      <p className="xs" style={{ textAlign: "center" }}>Reta no está afiliada a The Pokémon Company ni a Nintendo.</p>
    </main>
  );
}
