import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/** Cache GET /api/* reads for offline fallback (excludes auth + live notification feeds). */
registerRoute(
  ({ request, url }) =>
    request.method === 'GET'
    && url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/api/auth')
    && !url.pathname.startsWith('/api/notifications'),
  new NetworkFirst({
    cacheName: 'coreknot-api-read-v1',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 5 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

/** Must match BRAND_ICONS.notification in src/constants/brandIcons.js */
const NOTIFICATION_ICON = new URL('/icons/icon-192.png', self.location.origin).href;

self.addEventListener('push', (event) => {
  let payload = { title: 'Coreknot', body: 'New notification', actionUrl: '/inbox' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (e) {}

  const tag = payload.notificationId || payload.actionUrl || 'coreknot-notification';

  event.waitUntil(
    (async () => {
      const existing = await self.registration.getNotifications({ tag });
      if (existing.length) return;

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag,
        renotify: false,
        data: {
          actionUrl: payload.actionUrl || '/inbox',
          notificationId: payload.notificationId || null,
        },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || '/inbox';
  const absoluteUrl = new URL(actionUrl, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (typeof client.navigate === 'function') {
            client.navigate(absoluteUrl);
          } else if ('url' in client && client.url !== absoluteUrl) {
            return clients.openWindow(absoluteUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(absoluteUrl);
    })
  );
});
