import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useTaskmasterQueries';
import {
  sendNotification,
  initPushNotifications,
  resolveNotificationDeliveryMode,
  isPushPreferenceEnabled,
  hasActivePushSubscription,
} from '../utils/notifications';

const NotificationBridge = () => {
  const { data } = useNotifications();
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const pushInitDoneRef = useRef(!isPushPreferenceEnabled());
  const pushInitPromiseRef = useRef(null);

  useEffect(() => {
    if (pushInitDoneRef.current) return;
    pushInitPromiseRef.current = initPushNotifications().finally(() => {
      pushInitDoneRef.current = true;
    });
  }, []);

  useEffect(() => {
    const notifications = data?.notifications || (Array.isArray(data) ? data : []);
    if (!notifications.length) return;

    let cancelled = false;

    (async () => {
      if (!pushInitDoneRef.current && pushInitPromiseRef.current) {
        await pushInitPromiseRef.current;
      }
      if (cancelled) return;

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
