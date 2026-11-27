// Función "mail": manda los correos pendientes de public.email_outbox. La llama pg_cron cuando hay algo listo.
// Envía por SMTP de Gmail en el puerto 465 (Supabase bloquea 25 y 587). Credenciales solo como secretos de la función:
//   GMAIL_USER (retatcg.app@gmail.com) y GMAIL_APP_PASSWORD (contraseña de aplicación). Nunca en el código ni en la base.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import nodemailer from "npm:nodemailer@6.9.16";
import { welcomeMail, type MailTournament } from "./template.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });
const SITE = Deno.env.get("SITE_URL") ?? "https://retatcg.vercel.app";
const MAX_ATTEMPTS = 5;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  // Sin credenciales no se toca la cola: los correos esperan a que se configuren.
  if (!user || !pass) return json({ ok: false, error: "Faltan GMAIL_USER y GMAIL_APP_PASSWORD." });

  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  const rows = await sql`
    update public.email_outbox set attempts = attempts + 1, send_after = now() + interval '10 minutes'
    where id in (select id from public.email_outbox where status = 'pending' and send_after <= now()
                 order by id limit 20 for update skip locked)
    returning id, user_id, kind, attempts`;
  let sent = 0, failed = 0;
  for (const r of rows) {
    try {
      const [u] = await sql`select u.email, p.username from auth.users u join public.profiles p on p.id = u.id where u.id = ${r.user_id}`;
      if (!u?.email) { await sql`update public.email_outbox set status = 'skipped', last_error = 'sin correo' where id = ${r.id}`; continue; }
      const ts = await sql`
        select t.name, t.code, t.starts_at, t.checkin_minutes, t.pace->>'kind' as pace, g.status
        from public.registrations g join public.tournaments t on t.id = g.tournament_id
        where g.user_id = ${r.user_id} and g.status in ('registered', 'checked_in', 'waitlist')
          and t.status in ('registration', 'running') and t.starts_at > now() - interval '1 hour'
        order by t.starts_at limit 3`;
      const tournaments: MailTournament[] = ts.map((t: Record<string, unknown>) => ({
        name: String(t.name), code: String(t.code), startsAt: new Date(t.starts_at as string).toISOString(),
        checkinMinutes: Number(t.checkin_minutes), pace: String(t.pace), status: String(t.status),
      }));
      const mail = welcomeMail({ username: u.username, siteUrl: SITE, tournaments });
      await transport.sendMail({
        from: { name: "Reta", address: user }, replyTo: user, to: u.email,
        subject: mail.subject, html: mail.html, text: mail.text,
        headers: { "X-Entity-Ref-ID": `reta-${r.kind}-${r.id}` },
      });
      await sql`update public.email_outbox set status = 'sent', sent_at = now(), last_error = null where id = ${r.id}`;
      sent++;
    } catch (e) {
      failed++;
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      console.error(`[mail] ${r.id}: ${msg}`);
      await sql`update public.email_outbox set last_error = ${msg},
        status = case when attempts >= ${MAX_ATTEMPTS} then 'failed' else status end where id = ${r.id}`;
    }
  }
  return json({ ok: true, sent, failed, pending: rows.length });
});
