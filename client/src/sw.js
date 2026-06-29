import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const STATIC_CACHE = 'coreknot-static-v2';
const SW_UPDATE_CHANNEL = 'coreknot-sw-update';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Enterprise: no skipWaiting on install — client prompts user first
self.addEventListener('install', () => {
  // Intentionally wait until user confirms via SKIP_WAITING message
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

/** Versioned build assets — cache first */
registerRoute(
  ({ request, url }) =>
    request.destination === 'script'
    || request.destination === 'style'
    || /\.(?:js|css)$/.test(url.pathname),
  new CacheFirst({
    cacheName: `${STATIC_CACHE}-immutable`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

/** Fonts/images — stale-while-revalidate */
registerRoute(
  ({ request }) =>
    request.destination === 'font'
    || request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: `${STATIC_CACHE}-media`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 14 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

/** Navigation — network with offline shell fallback (no API caching) */
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event, request }) => {
    try {
      const preload = await event.preloadResponse;
      if (preload) return preload;
      return await fetch(request);
    } catch {
      const cache = await caches.open(`${STATIC_CACHE}-shell`);
      return (await cache.match('/index.html')) || (await cache.match('/'));
    }
  },
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

if (typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel(SW_UPDATE_CHANNEL);
  channel.onmessage = (event) => {
    if (event.data?.type === 'skip-waiting') {
      self.skipWaiting();
    }
  };
}

/** Must match BRAND_ICONS.notification in src/constants/brandIcons.js */
const NOTIFICATION_ICON = new URL('/icons/icon-192.png', self.location.origin).href;

self.addEventListener('push', (event) => {
  let payload = { title: 'CoreKnot', body: 'New notification', actionUrl: '/inbox' };
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

      const inboxPayload = {
        _id: payload.notificationId || tag,
        title: payload.title,
        message: payload.body || payload.message || '',
        category: payload.category || 'system',
        actionUrl: payload.actionUrl || '/inbox',
        iconType: payload.iconType || 'system',
        read: false,
        createdAt: new Date().toISOString(),
      };

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'coreknot-push-notification', payload: inboxPayload });
      }
    })(),
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
    }),
  );
});

self.addEventListener('error', (event) => {
  const clientList = self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  event.waitUntil(
    clientList.then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'coreknot-sw-error',
          message: event.message || 'Service worker error',
        });
      }
    }),
  );
});
