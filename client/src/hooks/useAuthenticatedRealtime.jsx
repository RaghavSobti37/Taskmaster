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
            <div className="max-w-sm w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] shadow-2xl rounded-2xl pointer-events-auto flex overflow-hidden">
              <div className="p-4 flex-1">
                <div className="flex items-center">
                  <div className="shrink-0 bg-blue-500/10 p-2 rounded-xl">
                    <span className="text-xl">✨</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                      XP Gained!
                    </p>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">
                      +{payload.amount} XP • {actionLabel}
                    </p>
                    <div className="mt-2 w-full bg-[var(--color-bg-border)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
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
