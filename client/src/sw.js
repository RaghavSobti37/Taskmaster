import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const NOTIFICATION_ICON = new URL('/icons/icon-192.png', self.location.origin).href;

self.addEventListener('push', (event) => {
  let payload = { title: 'CoreKnot', body: 'New notification', actionUrl: '/inbox' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: payload.notificationId || payload.actionUrl || 'coreknot-notification',
      renotify: false,
      data: {
        actionUrl: payload.actionUrl || '/inbox',
        notificationId: payload.notificationId || null,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || '/inbox';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(actionUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(actionUrl);
    })
  );
});
