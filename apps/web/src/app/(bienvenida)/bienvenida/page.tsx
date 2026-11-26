import { redirect } from "next/navigation";
import { getMe, getUser } from "@/lib/auth";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Crea tu cuenta" };

export default async function Page({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const sp = await searchParams;
  const next = sp.siguiente?.startsWith("/") && !sp.siguiente.startsWith("//") ? sp.siguiente : undefined;
  const user = await getUser();
  if (!user) redirect(next ? `/entrar?siguiente=${encodeURIComponent(next)}` : "/entrar");
  if (await getMe()) redirect(next ?? "/inicio");
  return (
    <main className="app">
      <Onboarding seed={user.id} next={next} />
    </main>
  );
}
