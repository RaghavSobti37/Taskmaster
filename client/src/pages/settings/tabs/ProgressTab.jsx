import React, { useMemo, useState } from 'react';
import { Target, Activity } from 'lucide-react';
import { Card, Badge, Button } from '../../../components/ui';
import {
  useGamificationProgress,
  useGamificationHistory,
  useGamificationMissions,
} from '../../../hooks/useTaskmasterQueries';
import { motion } from 'framer-motion';

const formatTimestamp = (value) => {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ProgressTab() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: progress, isLoading: progressLoading } = useGamificationProgress(true);
  const { data: historyData, isLoading: historyLoading } = useGamificationHistory(page, limit, true);
  const { data: missions = [], isLoading: missionsLoading } = useGamificationMissions(true);

  const level = progress?.level || 1;
  const exp = progress?.exp || 0;
  const currentLevelExp = progress?.currentLevelExp ?? 0;
  const nextLevelExp = progress?.nextLevelExp ?? currentLevelExp + (progress?.stepXp || 100);
  const progressPercent = useMemo(() => {
    const span = nextLevelExp - currentLevelExp;
    if (span <= 0) return 0;
    return Math.min(100, Math.max(0, ((exp - currentLevelExp) / span) * 100));
  }, [exp, currentLevelExp, nextLevelExp]);

  const logsList = historyData?.logs || [];
  const totalLogs = historyData?.total || 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Progress & XP</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Track your level, daily missions, and XP history.</p>
        </div>
        <Badge variant="warning" className="px-3 py-1.5 text-sm">Level {level}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 flex flex-col justify-center">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Current Journey</h3>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              {progressLoading ? 'Loading…' : `You are ${progressPercent.toFixed(1)}% through Level ${level}`}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest shrink-0">
                Lvl {level}
              </span>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest shrink-0">
                Lvl {level + 1}
              </span>
            </div>

            <div className="w-full h-4 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-bg-border)] relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
              />
            </div>

            <p className="pt-1 text-[10px] font-bold text-[var(--color-text-muted)] text-center uppercase tracking-widest tabular-nums">
              {exp} / {nextLevelExp} XP
            </p>
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center space-y-3 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Target size={28} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-black text-[var(--color-text-primary)]">Keep going!</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Complete tasks, log time, and finish daily missions to rank up.</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Target size={14} className="text-emerald-500" /> Daily Missions
          </h3>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {missionsLoading && (
            <p className="px-6 py-8 text-sm text-[var(--color-text-muted)]">Loading missions…</p>
          )}
          {!missionsLoading && missions.length === 0 && (
            <p className="px-6 py-8 text-sm text-[var(--color-text-muted)]">No missions for today yet.</p>
          )}
          {!missionsLoading && missions.map((mission) => {
            const pct = Math.min(100, Math.round(((mission.currentCount || 0) / mission.targetCount) * 100));
            return (
              <div key={mission._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{mission.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{mission.description}</p>
                  <div className="mt-2 h-2 bg-[var(--color-bg-border)] rounded-full overflow-hidden max-w-md">
                    <div
                      className={`h-full rounded-full ${mission.completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-[var(--color-text-muted)]">
                    {mission.currentCount || 0}/{mission.targetCount}
                  </span>
                  <Badge variant={mission.completed ? 'success' : 'warning'}>+{mission.expReward} XP</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> Recent XP Activity
          </h3>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Action</th>
                  <th className="px-6 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">XP</th>
                  <th className="px-6 py-3 text-right font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {historyLoading && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                      Loading XP history…
                    </td>
                  </tr>
                )}
                {!historyLoading && logsList.map((log) => (
                  <tr key={log._id} className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                      {log.message || log.actionLabel}
                    </td>
                    <td className="px-6 py-4 text-amber-500 font-black tabular-nums">
                      +{log.amount}
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                      {formatTimestamp(log.createdAt)}
                    </td>
                  </tr>
                ))}
                {!historyLoading && logsList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                      No XP activity yet. Complete tasks or log time to earn XP!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(page > 1 || page * limit < totalLogs) && (
            <div className="p-4 border-t border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
              <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                Page {page} of {Math.max(1, Math.ceil(totalLogs / limit))}
              </span>
              <Button size="xs" variant="outline" disabled={page * limit >= totalLogs} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
