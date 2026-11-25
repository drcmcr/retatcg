import { redirect } from "next/navigation";
import { getMe, getUser } from "@/lib/auth";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Crea tu cuenta" };

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  if (await getMe()) redirect("/inicio");
  return (
    <main className="app">
      <Onboarding seed={user.id} />
    </main>
  );
}
