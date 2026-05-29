const PUSH_PREF_KEY = 'coreknot_push_enabled';

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

export const sendNotification = (title, body, options = {}) => {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.svg', ...options });
};

export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
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
  if (!localStorage.getItem('coreknot_token')) return false;

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
