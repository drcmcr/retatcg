import Link from "next/link";
import { Logo } from "@/components/Brand";
import { requireTournamentStaff } from "@/lib/staff";
import { fmtDateTime } from "@/lib/format";
import { qrSvg, siteOrigin } from "@/lib/share";

export const metadata = { title: "QR del torneo" };

/** Pantalla para proyectar o mostrar el QR en un evento presencial. */
export default async function Proyectar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const url = `${await siteOrigin()}/torneo/${t.code}`;
  const svg = await qrSvg(url);
  return (
    <main className="proj">
      <Logo h={28} />
      <h1 className="t1" style={{ textAlign: "center", margin: 0 }}>{t.name}</h1>
      <span className="sm" style={{ textAlign: "center" }}>{t.club ? `${t.club} · ` : ""}{fmtDateTime(t.starts_at)}</span>
      <div className="qrbox big" role="img" aria-label={`Código QR del torneo ${t.code}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="sm" style={{ textAlign: "center", color: "var(--ink)" }}>Escanéalo con la cámara para inscribirte</span>
      <span className="mono" style={{ fontSize: 40, letterSpacing: ".1em", color: "var(--lime)" }}>{t.code}</span>
      <span className="xs" style={{ textAlign: "center" }}>O entra a {url.replace(/^https?:\/\//, "").replace(/\/torneo\/.*/, "")} → Torneos → ícono de QR y escribe el código.</span>
      <Link href={`/staff/torneo/${t.id}`} className="btn g sm">Volver al panel</Link>
    </main>
  );
}
