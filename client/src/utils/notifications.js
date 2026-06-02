const PUSH_PREF_KEY = 'coreknot_push_enabled';
const OS_NOTIF_DEDUPE_KEY = 'coreknot_os_notif_dedupe';
const OS_NOTIF_DEDUPE_TTL_MS = 5 * 60 * 1000;
const NOTIF_BC_CHANNEL = 'coreknot-notif';

let notifBroadcastChannel = null;

export const getNotificationIconUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/icons/icon-192.png`;
  }
  return '/icons/icon-192.png';
};

const readDedupeMap = () => {
  try {
    const raw = localStorage.getItem(OS_NOTIF_DEDUPE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeDedupeMap = (map) => {
  try {
    localStorage.setItem(OS_NOTIF_DEDUPE_KEY, JSON.stringify(map));
  } catch (_) {}
};

const pruneDedupeMap = (map) => {
  const now = Date.now();
  const pruned = {};
  for (const [tag, ts] of Object.entries(map)) {
    if (now - ts < OS_NOTIF_DEDUPE_TTL_MS) pruned[tag] = ts;
  }
  return pruned;
};

const getNotifBroadcastChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!notifBroadcastChannel) {
    notifBroadcastChannel = new BroadcastChannel(NOTIF_BC_CHANNEL);
    notifBroadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'shown' && event.data.tag) {
        markOsNotificationShown(event.data.tag, false);
      }
    };
  }
  return notifBroadcastChannel;
};

export const wasRecentlyShownOsNotification = (tag) => {
  if (!tag) return false;
  try {
    const map = pruneDedupeMap(readDedupeMap());
    const ts = map[tag];
    return Boolean(ts && Date.now() - ts < OS_NOTIF_DEDUPE_TTL_MS);
  } catch {
    return false;
  }
};

export const markOsNotificationShown = (tag, broadcast = true) => {
  if (!tag) return;
  try {
    const map = pruneDedupeMap(readDedupeMap());
    map[tag] = Date.now();
    writeDedupeMap(map);
    if (broadcast) {
      getNotifBroadcastChannel()?.postMessage({ type: 'shown', tag });
    }
  } catch (_) {}
};

export const isPushPreferenceEnabled = () => {
  try {
    return localStorage.getItem(PUSH_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setPushPreferenceEnabled = (enabled) => {
  try {
    localStorage.setItem(PUSH_PREF_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

/** Polling fallback only — skipped when web push is active (SW handles OS toasts). */
export const sendNotification = async (title, body, options = {}) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (await hasActivePushSubscription()) return;

  const tag = options.tag || title;
  if (wasRecentlyShownOsNotification(tag)) return;

  const icon = getNotificationIconUrl();
  const notifOptions = {
    body,
    icon,
    badge: icon,
    tag,
    renotify: false,
    data: {
      actionUrl: options.actionUrl || '/inbox',
      notificationId: tag,
    },
  };

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      const existing = await registration.getNotifications({ tag });
      if (existing.length) {
        markOsNotificationShown(tag);
        return;
      }
      await registration.showNotification(title, notifOptions);
      markOsNotificationShown(tag);
      return;
    }
  } catch (_) {}

  new Notification(title, notifOptions);
  markOsNotificationShown(tag);
};

/** Returns 'push' | 'polling' | 'none' — only one path should show OS toasts. */
export const resolveNotificationDeliveryMode = async () => {
  if (!isPushPreferenceEnabled()) return 'none';
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'none';
  const subscribed = await hasActivePushSubscription();
  return subscribed ? 'push' : 'polling';
};

export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const isDev = import.meta.env?.DEV || false;
    const swUrl = isDev ? '/dev-sw.js?dev-sw' : '/sw.js';
    return await navigator.serviceWorker.register(swUrl, {
      scope: '/',
      type: isDev ? 'module' : 'classic',
    });
  } catch (err) {
    if (import.meta.env?.DEV) return null;
    console.error('SW registration failed', err);
    return null;
  }
};

export const getPushSubscription = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration?.pushManager?.getSubscription() || null;
  } catch {
    return null;
  }
};

export const hasActivePushSubscription = async () => {
  const sub = await getPushSubscription();
  return Boolean(sub);
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const subscribeToPush = async () => {
  if (!isPushPreferenceEnabled()) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;
  const registration = await registerServiceWorker();
  if (!registration) return false;

  const axios = (await import('axios')).default;
  const { AXIOS_SKIP_TOAST } = await import('../lib/notifications');

  try {
    const { data } = await axios.get('/api/notifications/push/vapid-key', AXIOS_SKIP_TOAST);
    if (!data?.publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    const payload = subscription.toJSON();
    if (!payload?.endpoint || !payload?.keys?.p256dh || !payload?.keys?.auth) {
      return false;
    }

    await axios.post('/api/notifications/push/subscribe', { subscription: payload }, AXIOS_SKIP_TOAST);
    setPushPreferenceEnabled(true);
    return true;
  } catch (err) {
    console.warn('Push subscription failed', err?.response?.status || err?.message);
    return false;
  }
};

export const unsubscribeFromPush = async () => {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    const axios = (await import('axios')).default;
    const { AXIOS_SKIP_TOAST } = await import('../lib/notifications');
    await axios.delete('/api/notifications/push/unsubscribe', {
      data: { endpoint: subscription.endpoint },
      ...AXIOS_SKIP_TOAST,
    });
    await subscription.unsubscribe();
  }
  setPushPreferenceEnabled(false);
};

export const getNotificationPushStatus = async () => {
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const prefEnabled = isPushPreferenceEnabled();
  const subscribed = await hasActivePushSubscription();
  return { permission, prefEnabled, subscribed, enabled: prefEnabled && permission === 'granted' && subscribed };
};

/** Resolves when push subscribe attempt finishes (success or failure). */
export const initPushNotifications = async () => {
  getNotifBroadcastChannel();
  if (!isPushPreferenceEnabled()) return false;
  return subscribeToPush();
};
