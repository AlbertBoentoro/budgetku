self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || "Budgetku";
  const options = {
    body: payload.body || "Jangan lupa mencatat transaksi hari ini.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/transactions/new" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  const safePath =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
      ? path
      : "/transactions";
  const target = new URL(safePath, self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existing) {
          return existing.navigate(target.href).then(() => existing.focus());
        }
        return self.clients.openWindow(target.href);
      }),
  );
});
