import { requireTournamentStaff } from "@/lib/staff";
import { qrPngBuffer, siteOrigin } from "@/lib/share";

/** QR del torneo como archivo PNG real (los enlaces data: no se descargan en iPhone ni en la app instalada). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await requireTournamentStaff(id);
  const png = await qrPngBuffer(`${await siteOrigin()}/torneo/${t.code}`);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="reta-${t.code}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
