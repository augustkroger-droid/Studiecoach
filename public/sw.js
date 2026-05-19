self.addEventListener("push", (event) => {
    if (!event.data) return;

    const data = event.data.json();

    self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
            url: data.url || "/",
        },
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
            const existingClient = clientsArr.find((client) => client.url.includes(targetUrl));

            if (existingClient) {
                existingClient.focus();
                return;
            }

            clients.openWindow(targetUrl);
        })
    );
});