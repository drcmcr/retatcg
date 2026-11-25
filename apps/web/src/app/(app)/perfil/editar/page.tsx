import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { EditForm } from "./EditForm";

export const metadata = { title: "Editar perfil" };

export default async function Editar() {
  const me = await requireMe("/perfil/editar");
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("profiles").select("username_changed_at").eq("id", me.id).single();
  const { data: priv } = await supabase.from("profile_private").select("pocket_name,friend_id,timezone").eq("user_id", me.id).single();
  const next = p?.username_changed_at ? new Date(new Date(p.username_changed_at).getTime() + 30 * 86400000) : null;
  return (
    <main className="screen">
      <TopBar title="Editar perfil" back="/perfil" />
      <EditForm seed={me.id} username={me.username} nextChange={next && next > new Date() ? next.toISOString() : null}
        pocketName={priv?.pocket_name ?? ""} friendId={priv?.friend_id ?? ""} timezone={priv?.timezone ?? "America/Mexico_City"} />
    </main>
  );
}
