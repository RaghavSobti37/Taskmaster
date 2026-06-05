import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pushCustomToast } from '../lib/notifications';
import { invalidateTaskDomain, invalidateReviewTasks } from '../lib/queryInvalidation';

/** Socket.io channels — dynamic import so public routes do not load socket.io-client. */
export function useAuthenticatedRealtime({ userId, sessionReady, setUser }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionReady || !userId) return undefined;

    let cancelled = false;
    let cleanups = [];

    const setup = async () => {
      const { subscribeToChannel } = await import('../lib/realtime');
      if (cancelled) return;

      const unsubTask = subscribeToChannel('tasks', 'task_change', () => {
        invalidateTaskDomain(queryClient);
        invalidateReviewTasks(queryClient);
      });

      const unsubAwarded = subscribeToChannel(`user-${userId}`, 'xp_awarded', (payload) => {
        setUser((prev) => ({
          ...prev,
          exp: payload.newTotal,
          level: payload.newLevel ?? prev.level,
        }));

        queryClient.invalidateQueries({ queryKey: ['gamification'] });
        queryClient.invalidateQueries({ queryKey: ['missions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });

        const actionLabel = payload.actionLabel || payload.action?.replace(/_/g, ' ') || 'XP';
        pushCustomToast(
          () => (
            <div
              className="max-w-xs w-full bg-[var(--token-surface-1)] shadow-lg rounded-xl pointer-events-auto border-l-[2px] px-3 py-2.5"
              style={{ borderLeftColor: '#27a644' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
                +{payload.amount} XP
              </p>
              <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 truncate">
                {actionLabel}
              </p>
            </div>
          ),
          { id: `xp-${payload.action}`, duration: 4000 }
        );
      });

      const unsubRecalc = subscribeToChannel(`user-${userId}`, 'xp_recalculated', (payload) => {
        if (payload.newExp != null) {
          setUser((prev) => ({
            ...prev,
            exp: payload.newExp,
            level: payload.newLevel ?? prev.level,
          }));
        }
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
        queryClient.refetchQueries({ queryKey: ['gamification', 'leaderboard'] });
      });

      const unsubGlobalRecalc = subscribeToChannel('gamification', 'gamification_recalculated', () => {
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
        queryClient.refetchQueries({ queryKey: ['gamification', 'leaderboard'] });
      });

      cleanups = [unsubTask, unsubAwarded, unsubRecalc, unsubGlobalRecalc];
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(setup, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
        cleanups.forEach((unsub) => unsub?.());
      };
    }

    const timer = window.setTimeout(setup, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cleanups.forEach((unsub) => unsub?.());
    };
  }, [userId, sessionReady, setUser, queryClient]);
}

export async function disconnectAuthenticatedRealtime() {
  const { disconnectRealtime } = await import('../lib/realtime');
  disconnectRealtime();
}
