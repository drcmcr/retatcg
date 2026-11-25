import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { TitlePicker } from "./TitlePicker";

export const metadata = { title: "Títulos" };

export default async function Titulos() {
  const me = await requireMe("/perfil/titulos");
  const supabase = await supabaseServer();
  const { data } = await supabase.from("titles").select("medal").eq("user_id", me.id);
  return (
    <main className="screen">
      <TopBar title="Títulos" back="/perfil" />
      <TitlePicker unlocked={(data ?? []).map((x) => x.medal)} current={me.titleMedal} form={me.titleForm} username={me.username} />
    </main>
  );
}
