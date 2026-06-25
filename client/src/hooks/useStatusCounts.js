import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from './queries/notifications';
import { getUnreadCounts } from '../utils/localNotificationStore';

export const STATUS_COUNTS_QUERY_KEY = ['statusCounts'];

const DEFAULT_COUNTS = {
  tasks: { overdue: 0, today: 0, inReview: 0 },
  followups: { overdue: 0, today: 0 },
  calendar: { today: 0 },
  notifications: { unread: 0, byCategory: {} },
  review: { pending: 0 },
  projects: { overdue: 0, review: 0 },
};

export const useStatusCounts = (enabled = true) => {
  const { user } = useAuth();
  const apiQuery = useQuery({
    queryKey: STATUS_COUNTS_QUERY_KEY,
    queryFn: async () => (await axios.get('/api/notifications/status-counts')).data,
    enabled,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
  const { data: notifData } = useNotifications(enabled && !!user);

  const merged = useMemo(() => {
    const base = apiQuery.data || DEFAULT_COUNTS;
    const notifications = notifData?.notifications || [];
    const localCounts = getUnreadCounts(notifications);
    return {
      ...base,
      notifications: {
        unread: localCounts.unread,
        byCategory: localCounts.byCategory,
        localOnly: true,
      },
    };
  }, [apiQuery.data, notifData]);

  return {
    ...apiQuery,
    data: merged,
  };
};
