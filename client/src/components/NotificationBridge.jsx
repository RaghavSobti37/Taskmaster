import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useTaskmasterQueries';
import {
  sendNotification,
  subscribeToPush,
  resolveNotificationDeliveryMode,
  isPushPreferenceEnabled,
} from '../utils/notifications';

const NotificationBridge = () => {
  const { data } = useNotifications();
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const [deliveryMode, setDeliveryMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushPreferenceEnabled()) {
        if (!cancelled) setDeliveryMode('none');
        return;
      }
      await subscribeToPush().catch(() => {});
      const mode = await resolveNotificationDeliveryMode();
      if (!cancelled) setDeliveryMode(mode);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const notifications = data?.notifications || (Array.isArray(data) ? data : []);
    if (!notifications.length || deliveryMode === null) return;

    if (!initializedRef.current) {
      notifications.forEach((n) => seenRef.current.add(n._id));
      initializedRef.current = true;
      return;
    }

    notifications.forEach((n) => {
      if (!n.read && !seenRef.current.has(n._id)) {
        seenRef.current.add(n._id);
        if (deliveryMode === 'polling') {
          sendNotification(n.title, n.message, { tag: n._id });
        }
      }
    });
  }, [data, deliveryMode]);

  return null;
};

export default NotificationBridge;
