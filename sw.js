// CampusHub Service Worker — push notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "CampusHub", body: event.data ? event.data.text() : "New message" }; }

  const title = data.title || "CampusHub";
  const options = {
    body: data.body || "New message",
    icon: data.icon || "https://res.cloudinary.com/dybylicd7/image/upload/v1/campushub-icon.png",
    badge: data.badge || "https://res.cloudinary.com/dybylicd7/image/upload/v1/campushub-icon.png",
    tag: data.room || "campushub",
    renotify: true,
    data: { room: data.room || "general", url: data.url || "./" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
