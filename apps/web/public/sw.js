// Service worker de Reta: avisos push y una pantalla sin conexión.
const OFFLINE = "/offline";
const CACHE = "reta-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Solo las navegaciones usan la página sin conexión; todo lo demás va directo a la red.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Reta", body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Reta", {
      body: data.body || "",
      icon: "/icons/notification-96.png",
      badge: "/icons/badge-72.png",
      tag: data.tag,
      data: { link: data.link || "/avisos" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/avisos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(link); return c.focus(); }
      return self.clients.openWindow(link);
    }),
  );
});
