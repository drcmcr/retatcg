// Reta · plantilla del correo de bienvenida (HTML para clientes de correo + texto plano).
// Sin dependencias: corre en la función "mail" (Deno) y en las pruebas (Node).
// Reglas de correo: tablas, estilos en línea, logo en PNG con fondo horneado, legible sin imágenes.

export type MailTournament = {
  name: string;
  code: string;
  startsAt: string; // ISO
  checkinMinutes: number;
  pace: string; // en_vivo | jornadas | ventana
  status: string; // registered | checked_in | waitlist
};

export type WelcomeInput = { username: string; siteUrl: string; tournaments: MailTournament[] };
export type Mail = { subject: string; preheader: string; html: string; text: string };

const C = {
  bg: "#0E0E12", card: "#1A1A22", inner: "#121218", ink: "#F4F4F5", white: "#FFFFFF",
  ink2: "#B4B4BE", ink3: "#D6D6DD", lime: "#AAFF01", cyan: "#01EEFE", line: "#3A3A44",
};
const FONT = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',Menlo,Consolas,monospace";
const TZ = "America/Mexico_City";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function when(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { day: day.charAt(0).toUpperCase() + day.slice(1), time };
}

function minus(iso: string, minutes: number): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(Date.parse(iso) - minutes * 60_000));
}

function tournamentLines(t: MailTournament): string[] {
  const w = when(t.startsAt);
  const lines = [`${w.day} · ${w.time} (hora del centro de México)`];
  if (t.pace === "ventana") lines.push("Torneo por ventana: cada ronda tiene un plazo para jugarse.");
  else lines.push(`Check-in desde las ${minus(t.startsAt, t.checkinMinutes)}; hazlo antes de las ${w.time}. Si no haces check-in, pierdes tu lugar.`);
  if (t.status === "waitlist") lines.push("Estás en lista de espera: si se libera un lugar, te avisamos.");
  return lines;
}

// ───────── Piezas HTML ─────────

const p = (html: string, color = C.ink3, size = 16, extra = "") =>
  `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color};${extra}">${html}</p>`;

const label = (text: string, color = C.lime) =>
  `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:13px;line-height:1.2;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};">${esc(text)}</p>`;

const h2 = (text: string) =>
  `<h2 style="margin:0 0 12px 0;font-family:${FONT};font-size:22px;line-height:1.25;font-weight:800;color:${C.white};">${esc(text)}</h2>`;

function button(href: string, text: string, kind: "primary" | "secondary" = "primary"): string {
  const bg = kind === "primary" ? C.lime : C.inner;
  const fg = kind === "primary" ? C.bg : C.ink;
  const border = kind === "primary" ? C.lime : "#6E6E7A";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px 0;"><tr>
<td style="background:${bg};border:2px solid ${border};">
<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:16px;font-weight:800;line-height:1.2;color:${fg};text-decoration:none;">${esc(text)}</a>
</td></tr></table>`;
}

function steps(items: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${items.map((s, i) => `<tr>
<td valign="top" width="34" style="padding:0 0 10px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:${C.lime};color:${C.bg};font-family:${MONO};font-size:13px;font-weight:700;">${i + 1}</span></td>
<td valign="top" style="padding:2px 0 10px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink3};">${s}</td>
</tr>`).join("")}</table>`;
}

const card = (inner: string, bg = C.card) =>
  `<tr><td style="padding:0 0 16px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${bg};"><tr><td style="padding:24px 24px 14px 24px;">${inner}</td></tr></table></td></tr>`;

const b = (s: string) => `<b style="color:${C.white};">${s}</b>`;

export function welcomeMail(input: WelcomeInput): Mail {
  const site = input.siteUrl.replace(/\/$/, "");
  const user = esc(input.username);
  const subject = `Te damos la bienvenida a Reta, ${input.username}`;
  const preheader = "Activa los avisos para que te llegue el check-in y tu mesa, y aprende a usar la app.";
  const ts = input.tournaments.slice(0, 3);

  const tournamentsHtml = ts.length
    ? card(
      label(ts.length > 1 ? "Tus próximos torneos" : "Tu próximo torneo", C.cyan) +
      ts.map((t, i) => `${i ? `<div style="height:1px;background:${C.line};margin:6px 0 16px 0;line-height:1px;font-size:1px;">&nbsp;</div>` : ""}${h2(t.name)}${tournamentLines(t).map((l) => p(esc(l), C.ink3, 15, "margin-bottom:6px;")).join("")}
<p style="margin:4px 0 10px 0;font-family:${MONO};font-size:14px;color:${C.ink2};">Código: <b style="color:${C.lime};">${esc(t.code)}</b></p>${button(`${site}/torneo/${encodeURIComponent(t.code)}`, "Ver torneo", "secondary")}`).join("") +
      `<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>`)
    : "";

  const iphone = steps([
    `Abre ${b("retatcg.vercel.app")} en ${b("Safari")}.`,
    `Toca ${b("Compartir")} (el cuadro con la flecha hacia arriba) y elige ${b("Agregar a inicio")}.`,
    `Abre Reta desde el ícono nuevo en tu pantalla de inicio.`,
    `Ve a ${b("Perfil → Ajustes → Avisos en este teléfono")} y toca ${b("Permitir")}.`,
  ]);
  const android = steps([
    `Abre ${b("retatcg.vercel.app")} en ${b("Chrome")}.`,
    `Ve a ${b("Perfil → Ajustes → Avisos en este teléfono")} y toca ${b("Permitir")}.`,
    `Opcional: en el menú ⋮ de Chrome elige ${b("Instalar app")} para tenerla como app.`,
  ]);

  const html = `<!DOCTYPE html>
<html lang="es-MX" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&amp;family=JetBrains+Mono:wght@700&amp;display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark light;supported-color-schemes:dark light;}
body{margin:0;padding:0;background:${C.bg};}
a{color:${C.lime};}
@media (max-width:620px){.wrap{width:100%!important;}.pad{padding-left:16px!important;padding-right:16px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};"><tr><td align="center" class="pad" style="padding:28px 20px 36px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;">

<tr><td style="padding:0 0 24px 0;"><a href="${esc(site)}" style="text-decoration:none;"><img src="${esc(site)}/email/reta-logo.png" width="180" height="51" alt="Reta" style="display:block;border:0;width:180px;height:51px;color:${C.white};font-family:${FONT};font-size:28px;font-weight:800;background:${C.bg};"></a></td></tr>

${card(label("Bienvenida") +
  `<h1 style="margin:0 0 14px 0;font-family:${FONT};font-size:32px;line-height:1.1;font-weight:800;color:${C.white};">Ya tienes cuenta en Reta, ${user}</h1>` +
  p("Reta organiza tus torneos de TCG Pocket: arma los emparejamientos, te da la contraseña de cada partida para buscar a tu rival en el juego, registra resultados y lleva tu rango, PR y medallas durante la temporada.") +
  p(`Si hay un problema en tu partida, toca ${b("Llamar juez")} y el staff te atiende.`), C.card)}

${tournamentsHtml}

${card(label("Paso importante") + h2("Activa los avisos en tu teléfono") +
  p("Así te llega el recordatorio del torneo, la apertura del check-in y tu mesa con el rival y la contraseña, aunque no tengas la app abierta.") +
  `<p style="margin:10px 0 10px 0;font-family:${FONT};font-size:17px;font-weight:800;color:${C.white};">iPhone</p>` + iphone +
  p(`En iPhone los avisos solo funcionan desde la app instalada en tu pantalla de inicio, no desde Safari.`, C.ink2, 14) +
  `<p style="margin:14px 0 10px 0;font-family:${FONT};font-size:17px;font-weight:800;color:${C.white};">Android</p>` + android +
  p(`Revisa que diga ${b("Activados")} y que ${b("Avisos de torneo")} esté encendido.`, C.ink2, 14) +
  button(`${site}/ajustes`, "Abrir Ajustes en Reta") +
  `<div style="height:10px;line-height:10px;font-size:10px;">&nbsp;</div>`)}

${card(label("Primeros pasos") + h2("Aprende a usar Reta") +
  p("La guía explica cómo inscribirte, hacer check-in, encontrar a tu rival, reportar resultados y cómo funcionan los rangos y medallas.") +
  button(`${site}/guia`, "Ver la guía de Reta", "secondary") +
  `<div style="height:10px;line-height:10px;font-size:10px;">&nbsp;</div>`)}

<tr><td style="padding:8px 4px 0 4px;">
${p(`Recibes este correo porque creaste una cuenta en Reta con esta dirección. Solo te escribimos sobre tu cuenta y tus torneos. Si no fuiste tú, responde a este correo.`, C.ink2, 13)}
${p(`Reta es una app independiente, sin afiliación con The Pokémon Company ni Nintendo.`, C.ink2, 13)}
</td></tr>

</table>
</td></tr></table>
</body>
</html>`;

  const tText = ts.length
    ? `\n${ts.length > 1 ? "TUS PRÓXIMOS TORNEOS" : "TU PRÓXIMO TORNEO"}\n` +
      ts.map((t) => `${t.name}\n${tournamentLines(t).join("\n")}\nCódigo: ${t.code}\n${site}/torneo/${encodeURIComponent(t.code)}`).join("\n\n") + "\n"
    : "";

  const text = `Ya tienes cuenta en Reta, ${input.username}

Reta organiza tus torneos de TCG Pocket: arma los emparejamientos, te da la contraseña de cada partida, registra resultados y lleva tu rango, PR y medallas durante la temporada. Si hay un problema en tu partida, toca "Llamar juez".
${tText}
ACTIVA LOS AVISOS EN TU TELÉFONO
Así te llega el recordatorio del torneo, la apertura del check-in y tu mesa aunque no tengas la app abierta.

iPhone:
1. Abre retatcg.vercel.app en Safari.
2. Toca Compartir y elige "Agregar a inicio".
3. Abre Reta desde el ícono nuevo.
4. Ve a Perfil → Ajustes → Avisos en este teléfono y toca Permitir.
(En iPhone los avisos solo funcionan desde la app instalada.)

Android:
1. Abre retatcg.vercel.app en Chrome.
2. Ve a Perfil → Ajustes → Avisos en este teléfono y toca Permitir.

Ajustes: ${site}/ajustes

APRENDE A USAR RETA
${site}/guia

Recibes este correo porque creaste una cuenta en Reta con esta dirección. Si no fuiste tú, responde a este correo.
Reta es una app independiente, sin afiliación con The Pokémon Company ni Nintendo.
`;

  return { subject, preheader, html, text };
}
