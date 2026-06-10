import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';
import {
  getNotificationsPayload,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  loadNotifications,
} from '../../utils/localNotificationStore';

const notificationsQueryKey = (userId) => ['notifications', userId];

export const useNotifications = (enabled = true) => {
  const { user } = useAuth();
  const userId = user?._id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: () => getNotificationsPayload(userId, user?.departmentSlug || ''),
    enabled: enabled && !!userId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
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
    mutationFn: (id) => {
      markNotificationRead(user._id, id);
      return Promise.resolve({ _id: id, read: true });
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
    mutationFn: () => {
      markAllNotificationsRead(user._id);
      return Promise.resolve({ ok: true });
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
    mutationFn: () => {
      clearAllNotifications(user._id);
      return Promise.resolve({ ok: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user._id) });
      invalidateStatusCounts(queryClient);
    },
  });
};

export { loadNotifications, notificationsQueryKey };
