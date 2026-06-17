self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title =
    typeof payload.title === "string" && payload.title ? payload.title : "Nueva notificacion";

  event.waitUntil(
    self.registration.showNotification(title, {
      badge: typeof payload.badge === "string" ? payload.badge : "/icon-192.png",
      body: typeof payload.body === "string" ? payload.body : "",
      data: payload.data ?? { url: "/" },
      icon: typeof payload.icon === "string" ? payload.icon : "/icon-192.png",
      renotify: true,
      requireInteraction: false,
      tag: typeof payload.tag === "string" ? payload.tag : undefined
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl =
        typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
      const normalizedUrl = new URL(targetUrl, self.location.origin).toString();
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windowClients) {
        if ("navigate" in client) {
          await client.navigate(normalizedUrl).catch(() => undefined);
        }

        if ("focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedUrl);
      }

      return undefined;
    })()
  );
});
