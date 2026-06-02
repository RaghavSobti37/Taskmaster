import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToChannel } from '../../lib/realtime';
import { invalidateTaskDomain, invalidateReviewTasks } from '../../lib/queryInvalidation';

/** Single socket listener for task changes — mount once when authenticated. */
export function useTaskDomainRealtimeSync(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToChannel('tasks', 'task_change', () => {
      invalidateTaskDomain(queryClient);
      invalidateReviewTasks(queryClient);
    });
  }, [queryClient, enabled]);
}
