import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useTaskmasterQueries';
import {
  sendNotification,
  subscribeToPush,
  resolveNotificationDeliveryMode,
  isPushPreferenceEnabled,
  hasActivePushSubscription,
} from '../utils/notifications';

const NotificationBridge = () => {
  const { data } = useNotifications();
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isPushPreferenceEnabled()) return;
    subscribeToPush().catch(() => {});
  }, []);

  useEffect(() => {
    const notifications = data?.notifications || (Array.isArray(data) ? data : []);
    if (!notifications.length) return;

    let cancelled = false;

    (async () => {
      if (!initializedRef.current) {
        notifications.forEach((n) => seenRef.current.add(n._id));
        initializedRef.current = true;
        return;
      }

      const mode = await resolveNotificationDeliveryMode();
      if (cancelled || mode !== 'polling') return;
      if (await hasActivePushSubscription()) return;

      for (const n of notifications) {
        if (cancelled) break;
        if (!n.read && !seenRef.current.has(n._id)) {
          seenRef.current.add(n._id);
          await sendNotification(n.title, n.message, {
            tag: n._id,
            actionUrl: n.actionUrl || '/inbox',
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [data]);

  return null;
};

export default NotificationBridge;
