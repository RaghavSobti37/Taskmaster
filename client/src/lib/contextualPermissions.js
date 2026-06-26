/**
 * Contextual notification permission — call from explicit user action only.
 */
export async function requestNotificationPermissionContextual() {
  if (!('Notification' in window)) {
    return { granted: false, reason: 'unsupported' };
  }
  if (Notification.permission === 'granted') {
    return { granted: true, reason: 'already-granted' };
  }
  if (Notification.permission === 'denied') {
    return { granted: false, reason: 'denied' };
  }
  const result = await Notification.requestPermission();
  return { granted: result === 'granted', reason: result };
}
