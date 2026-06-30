import { getNotificationIconUrl } from '../constants/brandIcons';
import { isStandaloneDisplay } from './displayMode';

const PUSH_PREF_KEY = 'coreknot_push_enabled';
const OS_NOTIF_DEDUPE_KEY = 'coreknot_os_notif_dedupe';
const OS_NOTIF_DEDUPE_TTL_MS = 5 * 60 * 1000;
const NOTIF_BC_CHANNEL = 'coreknot-notif';
const SW_READY_TIMEOUT_MS = 15000;

let notifBroadcastChannel = null;

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

export const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/** Web Push API available on this device (iOS requires installed PWA). */
export const canUseWebPush = () => {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  if (import.meta.env?.DEV) return false;
  if (isIosDevice() && !isStandaloneDisplay()) return false;
  return true;
};

/** Human-readable blocker for Settings UI. */
export const getPushUnsupportedReason = () => {
  if (typeof window === 'undefined') return 'Browser not supported';
  if (import.meta.env?.DEV) return 'Push is disabled in local dev (service worker off)';
  if (!('Notification' in window)) return 'This browser does not support notifications';
  if (!('serviceWorker' in navigator)) return 'Service workers are not available';
  if (!('PushManager' in window)) return 'Web Push is not supported on this browser';
  if (isIosDevice() && !isStandaloneDisplay()) {
    return 'On iPhone/iPad, add CoreKnot to your Home Screen first, then enable push here';
  }
  return null;
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
    return localStorage.getItem(PUSH_PREF_KEY) === 'true';
  } catch {
    return false;
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

/** Wait for vite-plugin-pwa registration from LocalFirstRoot — no duplicate register. */
export const waitForPushServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  if (import.meta.env?.DEV) return null;

  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Service worker not ready')), SW_READY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([ready, timeout]);
  } catch {
    return null;
  }
};

export const registerServiceWorker = async () => waitForPushServiceWorker();

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

const keysMatch = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const subscribeToPush = async ({ skipPermissionRequest = false } = {}) => {
  if (!canUseWebPush()) return false;
  if (!isPushPreferenceEnabled() && skipPermissionRequest) return false;

  if (!skipPermissionRequest) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  } else if (Notification.permission !== 'granted') {
    return false;
  }

  const registration = await waitForPushServiceWorker();
  if (!registration?.pushManager) return false;

  const axios = (await import('axios')).default;
  const { AXIOS_SKIP_TOAST } = await import('../lib/notifications');

  try {
    const { data } = await axios.get('/api/notifications/push/vapid-key', AXIOS_SKIP_TOAST);
    if (!data?.publicKey) return false;

    const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const existingKey = subscription.options?.applicationServerKey;
      if (existingKey && !keysMatch(existingKey, applicationServerKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
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
  const supported = canUseWebPush();
  const blocker = getPushUnsupportedReason();
  return {
    permission,
    prefEnabled,
    subscribed,
    supported,
    blocker,
    enabled: prefEnabled && permission === 'granted' && subscribed,
  };
};

/** Re-sync server subscription when permission already granted — no permission prompt. */
export const initPushNotifications = async () => {
  getNotifBroadcastChannel();
  if (!isPushPreferenceEnabled()) return false;
  if (!canUseWebPush()) return false;
  if (Notification.permission !== 'granted') return false;
  return subscribeToPush({ skipPermissionRequest: true });
};

/** User-gesture entry from Settings — requests permission then subscribes. */
export const enablePushNotifications = async () => {
  setPushPreferenceEnabled(true);
  return subscribeToPush({ skipPermissionRequest: false });
};
