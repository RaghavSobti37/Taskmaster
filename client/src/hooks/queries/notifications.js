import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';
import {
  getNotificationsPayload,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  loadNotifications,
  addNotification,
  saveNotifications,
} from '../../utils/localNotificationStore';

const notificationsQueryKey = (userId) => ['notifications', userId];

function mergeNotificationLists(serverRows = [], localRows = []) {
  const byId = new Map();
  for (const row of serverRows) {
    if (row?._id) byId.set(row._id, row);
  }
  for (const row of localRows) {
    if (row?._id && !byId.has(row._id)) byId.set(row._id, row);
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);
}

export const useNotifications = (enabled = true) => {
  const { user } = useAuth();
  const userId = user?._id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/notifications');
        const merged = mergeNotificationLists(data.notifications, loadNotifications(userId));
        saveNotifications(userId, merged);
        return { ...data, notifications: merged, localOnly: false };
      } catch {
        return getNotificationsPayload(userId, user?.departmentSlug || '');
      }
    },
    enabled: enabled && !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!userId) return undefined;

    const onStorage = (event) => {
      if (event.key === `coreknot_inbox_${userId}`) {
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
        invalidateStatusCounts(queryClient);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId, queryClient]);

  return query;
};

export const useMarkNotificationRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      markNotificationRead(user._id, id);
      try {
        await axios.patch(`/api/notifications/${id}/read`);
      } catch {
        /* local cache updated */
      }
      return { _id: id, read: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user._id) });
      invalidateStatusCounts(queryClient);
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      markAllNotificationsRead(user._id);
      try {
        await axios.patch('/api/notifications/read-all');
      } catch {
        /* local cache updated */
      }
      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user._id) });
      invalidateStatusCounts(queryClient);
    },
  });
};

export const useClearAllNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      clearAllNotifications(user._id);
      try {
        await axios.delete('/api/notifications');
      } catch {
        /* local cache updated */
      }
      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user._id) });
      invalidateStatusCounts(queryClient);
    },
  });
};

export { loadNotifications, addNotification, notificationsQueryKey };
