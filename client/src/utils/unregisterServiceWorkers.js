/** Auth subdomain must not run the app PWA — stale SW precache breaks login. */
export async function unregisterServiceWorkers() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // best-effort
  }
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // best-effort
    }
  }
}
