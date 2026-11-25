import { redirect } from "next/navigation";
import { requireStaffArea } from "@/lib/staff";
import { TournamentForm } from "../TournamentForm";

export const metadata = { title: "Crear torneo" };

export default async function Crear() {
  const me = await requireStaffArea();
  if (!me.isOrganizer) redirect("/staff");
  return (
    <>
      <h1 className="t1">Crear torneo</h1>
      <TournamentForm superadmin={me.isSuperadmin} />
    </>
  );
}
