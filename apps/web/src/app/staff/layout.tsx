import { headers } from "next/headers";
import { requireStaffArea } from "@/lib/staff";
import { supabaseServer } from "@/lib/supabase/server";
import { StaffSide } from "./StaffSide";

export const metadata = { title: { default: "Staff", template: "%s · Staff · Reta" } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaffArea();
  const path = (await headers()).get("x-pathname") ?? "";
  const tid = /\/staff\/torneo\/([0-9a-f-]{36})/.exec(path)?.[1];
  let current: { id: string; name: string; cases: number; decks: number } | null = null;
  if (tid) {
    const supabase = await supabaseServer();
    const [{ data: t }, { count: cases }, { count: decks }] = await Promise.all([
      supabase.from("tournaments").select("id,name").eq("id", tid).maybeSingle(),
      supabase.from("cases").select("id", { count: "exact", head: true }).eq("tournament_id", tid).neq("status", "resolved"),
      supabase.from("deck_declarations").select("id", { count: "exact", head: true }).eq("tournament_id", tid).eq("status", "unreviewed"),
    ]);
    if (t) current = { id: t.id, name: t.name, cases: cases ?? 0, decks: decks ?? 0 };
  }
  return (
    <div className="desk">
      <StaffSide me={{ id: me.id, username: me.username }} current={current} superadmin={me.isSuperadmin} organizer={me.isOrganizer} />
      <div className="main">{children}</div>
    </div>
  );
}
