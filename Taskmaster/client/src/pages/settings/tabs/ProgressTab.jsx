import React, { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Badge, Button, LoadingText, Spinner } from '../../../components/ui';
import { formatDisplayDateTime } from '../../../utils/dateDisplay';
import {
  useGamificationProgress,
  useGamificationHistory,
  useGamificationMissions,
} from '../../../hooks/useTaskmasterQueries';

const formatTimestamp = (value) => formatDisplayDateTime(value);

export default function ProgressTab() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: progress, isLoading: progressLoading } = useGamificationProgress(true);
  const { data: historyData, isLoading: historyLoading } = useGamificationHistory(page, limit, true);
  const { data: missions = [], isLoading: missionsLoading } = useGamificationMissions(true);

  const exp = progress?.exp || 0;
  const totalXp = useMemo(() => Number(exp) || 0, [exp]);

  const logsList = historyData?.logs || [];
  const totalLogs = historyData?.total || 0;
  const lastRecalculatedAt = progress?.lastRecalculatedAt || historyData?.lastRecalculatedAt;
  const showRecalcNotice = Boolean(lastRecalculatedAt || progress?.hasAdjustedHistory);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Progress & XP</h1>
        </div>
        <Badge variant="warning" className="px-3 py-1.5 text-sm tabular-nums">Total XP {totalXp}</Badge>
      </div>

      {showRecalcNotice && (
        <div className="flex items-start gap-3 rounded-[var(--radius-atomic)] border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <RefreshCw size={16} className="text-sky-500 shrink-0 mt-0.5" />
          <p>
            XP totals and weekly leaderboard were rebuilt from activity history using current rules.
            {lastRecalculatedAt && (
              <span className="block text-xs text-[var(--color-text-muted)] mt-1">
                Last recalculated {formatTimestamp(lastRecalculatedAt)}
              </span>
            )}
            {' '}Rows marked <span className="font-bold text-sky-500">Adjusted</span> show corrected amounts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8 border-b border-[var(--color-bg-border)]">
        <div className="md:col-span-2 flex flex-col justify-center gap-2">
          <h3 className="tm-widget-label">XP Summary</h3>
          {progressLoading ? (
            <div className="mt-1.5 flex justify-start"><Spinner size="sm" /></div>
          ) : (
            <>
              <p className="text-3xl font-black text-amber-500 tabular-nums">{totalXp} XP</p>
              <p className="text-xs tm-data-meta">XP updates from task completion, logs, and mission rewards.</p>
            </>
          )}
        </div>

        <div className="flex flex-col items-center justify-center text-center space-y-3 py-4 border border-amber-500/20 rounded-[var(--radius-atomic)] bg-gradient-to-br from-amber-500/10 to-transparent">
          <h3 className="text-lg font-black text-[var(--color-text-primary)]">Monthly standings</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Leaderboard rank is based on XP earned during the selected month.</p>
        </div>
      </div>

      <section className="pb-8 border-b border-[var(--color-bg-border)]">
        <div className="pb-4 border-b border-[var(--color-bg-border)]">
          <h3 className="tm-widget-label flex items-center gap-2">
            <Activity size={14} className="text-emerald-500" /> Daily Missions
          </h3>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {missionsLoading && (
            <div className="px-6 py-8 flex justify-center"><Spinner size="md" /></div>
          )}
          {!missionsLoading && missions.length === 0 && (
            <p className="px-6 py-8 text-sm text-[var(--color-text-muted)]">No missions for today yet.</p>
          )}
          {!missionsLoading && missions.map((mission) => {
            const pct = Math.min(100, Math.round(((mission.currentCount || 0) / mission.targetCount) * 100));
            return (
              <div key={mission._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold tm-data-primary">{mission.title}</p>
                  <p className="text-xs tm-data-meta">{mission.description}</p>
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
      </section>

      <section>
        <div className="pb-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
          <h3 className="tm-widget-label flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> Recent XP Activity
          </h3>
        </div>
        <div>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-bg-border)]">
                <th className="px-6 py-3 text-left tm-widget-label !text-[10px]">Action</th>
                <th className="px-6 py-3 text-left tm-widget-label !text-[10px]">XP</th>
                <th className="px-6 py-3 text-right tm-widget-label !text-[10px]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {historyLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <LoadingText>Loading XP history…</LoadingText>
                  </td>
                </tr>
              )}
              {!historyLoading && logsList.map((log) => (
                <tr key={log._id} className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      {log.message || log.actionLabel}
                      {log.adjusted && (
                        <Badge variant="info" className="text-[8px] py-0" title={
                          log.previousAmount != null
                            ? `Previously ${log.previousAmount} XP`
                            : 'Amount updated during recalculation'
                        }>
                          Adjusted
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-amber-500 font-black tabular-nums">
                    {log.amount > 0 ? `+${log.amount}` : '0'}
                    {log.adjusted && log.previousAmount != null && log.previousAmount !== log.amount && (
                      <span className="block text-[10px] font-bold text-sky-500/90 line-through">
                        was {log.previousAmount}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right tm-data-meta">
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
          <div className="py-4 border-t border-[var(--color-bg-border)] flex items-center justify-between">
            <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider tabular-nums">
              Page {page} of {Math.max(1, Math.ceil(totalLogs / limit))}
            </span>
            <Button size="xs" variant="outline" disabled={page * limit >= totalLogs} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </section>
    </div>
  );
}
