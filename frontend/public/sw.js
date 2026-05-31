/* DigiWallet V2 Service Worker - handles Web Push */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = { title: "DigiWallet", body: "You have a new notification", url: "/app", tag: "digiwallet" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    try { data.body = event.data.text(); } catch (e) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url },
      requireInteraction: false,
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      if ("focus" in c) { c.navigate(targetUrl); return c.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});
