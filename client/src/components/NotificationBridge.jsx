import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useTaskmasterQueries';
import { sendNotification, subscribeToPush, hasActivePushSubscription, isPushPreferenceEnabled } from '../utils/notifications';

const NotificationBridge = () => {
  const { data } = useNotifications();
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const [pushActive, setPushActive] = useState(false);

  useEffect(() => {
    if (!isPushPreferenceEnabled()) return;
    subscribeToPush()
      .then(() => hasActivePushSubscription())
      .then(setPushActive)
      .catch(() => {});
  }, []);

  useEffect(() => {
    hasActivePushSubscription().then(setPushActive).catch(() => {});
  }, [data]);

  useEffect(() => {
    const notifications = data?.notifications || (Array.isArray(data) ? data : []);
    if (!notifications.length) return;

    if (!initializedRef.current) {
      notifications.forEach((n) => seenRef.current.add(n._id));
      initializedRef.current = true;
      return;
    }

    if (pushActive) return;

    notifications.forEach((n) => {
      if (!n.read && !seenRef.current.has(n._id)) {
        seenRef.current.add(n._id);
        sendNotification(n.title, n.message);
      }
    });
  }, [data, pushActive]);

  return null;
};

export default NotificationBridge;
