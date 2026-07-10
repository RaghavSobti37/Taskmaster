import { addNotification } from '../utils/localNotificationStore';
import { notificationsQueryKey } from '../hooks/queries/notifications';
import { invalidateStatusCounts } from './queryInvalidation';

const PUSH_MESSAGE_TYPE = 'coreknot-push-notification';

export function initPushInboxBridge({ userId, queryClient }) {
  if (!userId || typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return () => {};
  }

  const onMessage = (event) => {
    const data = event?.data;
    if (!data || data.type !== PUSH_MESSAGE_TYPE || !data.payload?.title) return;

    addNotification(userId, data.payload);
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
    invalidateStatusCounts(queryClient);
  };

  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}

export { PUSH_MESSAGE_TYPE };
