// Plantilla del correo de bienvenida: contenido, enlaces y escape de texto.
import { describe, expect, it } from "vitest";
import { esc, welcomeMail } from "../functions/mail/template";

const SITE = "https://retatcg.vercel.app";

describe("correo de bienvenida", () => {
  it("trae bienvenida, pasos de avisos, guía y aviso de no afiliación", () => {
    const m = welcomeMail({ username: "Kairo", siteUrl: SITE + "/", tournaments: [] });
    expect(m.subject).toBe("Te damos la bienvenida a Reta, Kairo");
    for (const s of ["Ya tienes cuenta en Reta, Kairo", "Agregar a inicio", "Avisos en este teléfono", `${SITE}/ajustes`, `${SITE}/guia`, `${SITE}/email/reta-logo.png`, "sin afiliación"]) {
      expect(m.html).toContain(s);
    }
    expect(m.html).not.toContain("Tu próximo torneo");
    expect(m.text).toContain(`${SITE}/guia`);
    expect(m.html).not.toMatch(/<svg|<script/i);
  });

  it("incluye el torneo con fecha y check-in en hora de México", () => {
    const m = welcomeMail({ username: "Kairo", siteUrl: SITE, tournaments: [
      { name: "Reta Zero - Torneo Beta testers", code: "RETA-31", startsAt: "2026-11-30T00:00:00Z", checkinMinutes: 30, pace: "en_vivo", status: "registered" },
    ] });
    expect(m.html).toContain("Tu próximo torneo");
    expect(m.html).toContain("Domingo, 29 de noviembre · 18:00");
    expect(m.html).toContain("Check-in desde las 17:30; hazlo antes de las 18:00");
    expect(m.html).toContain(`${SITE}/torneo/RETA-31`);
    expect(m.text).toContain("RETA-31");
  });

  it("la lista de espera lo dice y el texto del usuario se escapa", () => {
    const m = welcomeMail({ username: "x", siteUrl: SITE, tournaments: [
      { name: "<b>Copa</b> & \"amigos\"", code: "COPA-12", startsAt: "2026-12-05T20:00:00Z", checkinMinutes: 30, pace: "en_vivo", status: "waitlist" },
    ] });
    expect(m.html).toContain(esc("<b>Copa</b> & \"amigos\""));
    expect(m.html).not.toContain("<b>Copa</b>");
    expect(m.html).toContain("lista de espera");
  });
});
