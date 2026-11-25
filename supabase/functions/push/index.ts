// Función "push": manda los avisos nuevos como notificaciones push. La llama pg_cron cada minuto.
// Las llaves VAPID se generan aquí la primera vez y se guardan en private.config: nunca salen de la base.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";
import webpush from "npm:web-push@3.6.7";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });
const SOCIAL = new Set(["social", "seguidor"]);

async function vapid(): Promise<{ pub: string; priv: string }> {
  const rows = await sql`select key, value from private.config where key in ('vapid_public', 'vapid_private')`;
  const m = new Map(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  if (m.get("vapid_public") && m.get("vapid_private")) return { pub: m.get("vapid_public")!, priv: m.get("vapid_private")! };
  const k = webpush.generateVAPIDKeys();
  await sql`insert into private.config (key, value) values ('vapid_public', ${k.publicKey}), ('vapid_private', ${k.privateKey}) on conflict (key) do nothing`;
  return vapid();
}

Deno.serve(async () => {
  try {
    const k = await vapid();
    webpush.setVapidDetails(Deno.env.get("PUSH_SUBJECT") ?? "https://retatcg.vercel.app", k.pub, k.priv);
    const rows = await sql`
      with n as (
        update public.notifications set pushed_at = now()
        where id in (select id from public.notifications where pushed_at is null and created_at > now() - interval '15 minutes' order by id limit 200 for update skip locked)
        returning *)
      select n.id, n.user_id, n.kind, n.title, n.body, n.link, coalesce(pp.notify, '{}'::jsonb) as notify
      from n left join public.profile_private pp on pp.user_id = n.user_id`;
    let sent = 0;
    for (const n of rows) {
      const social = SOCIAL.has(n.kind);
      if (social ? n.notify.social !== true : n.notify.torneo === false) continue;
      const subs = await sql`select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = ${n.user_id}`;
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: n.title, body: n.body ?? "", link: n.link ?? "/avisos", tag: `${n.kind}-${n.id}` }),
            { TTL: 600, urgency: n.kind === "ronda" || n.kind === "mesa" ? "high" : "normal" },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sql`delete from public.push_subscriptions where id = ${s.id}`;
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, sent, pending: rows.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
