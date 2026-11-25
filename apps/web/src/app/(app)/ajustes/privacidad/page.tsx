import { TopBar } from "@/components/ui";
import { requireMe } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PrivacyActions } from "./PrivacyActions";

export const metadata = { title: "Privacidad y datos" };

export default async function Privacidad() {
  const me = await requireMe("/ajustes/privacidad");
  return (
    <main className="screen">
      <TopBar title="Privacidad" back="/ajustes" />
      <PrivacyActions deletingAt={me.deletingAt ? fmtDateTime(me.deletingAt) : null} />
      <p className="xs">Para corregir datos: tu usuario se edita en Perfil y tus datos de Pocket en Ajustes. Para cualquier otra solicitud sobre tus datos, escribe al staff desde Ayuda.</p>
    </main>
  );
}
