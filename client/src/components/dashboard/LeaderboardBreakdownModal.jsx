import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy } from 'lucide-react';
import { hasLeaderboardRecalcHint } from './LeaderboardRecalcHint';

const formatRelativeTime = (value) => {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatDelta = (n) => (n > 0 ? `+${n}` : String(n));

const RecalcSection = ({ member }) => {
  if (!hasLeaderboardRecalcHint(member)) return null;
  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5">
      <h4 className="text-xs font-black uppercase tracking-wider text-sky-500">Last recalculation</h4>
      <p className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mt-2">
        Was {member.weeklyXpPrior} XP → now {member.weeklyXp} XP ({formatDelta(member.weeklyXpDelta)})
      </p>
      {member.recalcChanges?.length > 0 && (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {member.recalcChanges.map((row) => (
            <li
              key={`${row.action}-${row.previousAmount}-${row.amount}`}
              className="text-xs text-[var(--color-text-muted)] rounded-lg bg-[var(--color-bg-primary)]/60 px-2.5 py-1.5 border border-[var(--color-bg-border)]"
            >
              <span className="font-semibold text-[var(--color-text-primary)]">{row.actionLabel}</span>
              {': '}
              {row.previousAmount} → {row.amount} ({formatDelta(row.delta)})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const LeaderboardBreakdownModal = ({
  member,
  breakdown,
  breakdownLoading,
  onClose,
}) => {
  const formulaLine = useMemo(() => {
    if (!breakdown?.groupedBreakdown?.length) return null;
    return breakdown.groupedBreakdown
      .map((item) => (
        item.timeBased
          ? `${item.count} task completion${item.count === 1 ? '' : 's'} (${item.totalXp} XP)`
          : `${item.count} × ${item.amountPerAction}`
      ))
      .join(' + ');
  }, [breakdown]);

  useEffect(() => {
    if (!member) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey, true);
    };
  }, [member, onClose]);

  if (!member || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-[var(--color-bg-primary)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-breakdown-title"
    >
      <header className="shrink-0 flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-sm font-bold text-[var(--color-text-muted)]">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            member.name?.[0] || '?'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            id="leaderboard-breakdown-title"
            className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-2"
          >
            <Trophy size={14} className="shrink-0" />
            Weekly XP Breakdown
          </p>
          <p className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] truncate">{member.name}</p>
          {!breakdownLoading && breakdown && (
            <p className="text-sm font-black text-amber-500 mt-0.5">{breakdown.totalXp || 0} XP this week</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 rounded-lg border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-primary)] transition-colors"
          aria-label="Close breakdown"
        >
          <X size={20} className="text-[var(--color-text-muted)]" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {breakdownLoading && (
            <p className="text-sm text-[var(--color-text-muted)]">Loading XP calculation…</p>
          )}

          {!breakdownLoading && breakdown && (
            <>
              <RecalcSection member={member} />

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 lg:col-span-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    Total this week
                  </h4>
                  <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-2 tabular-nums">
                    {breakdown.totalXp || 0} XP
                  </p>
                  {formulaLine && (
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-3 break-words leading-relaxed font-mono">
                      {formulaLine} = {breakdown.totalXp || 0}
                    </p>
                  )}
                </section>

                <section className="space-y-3 lg:col-span-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    By action type
                  </h4>
                  <div className="space-y-2">
                    {(breakdown.groupedBreakdown || []).map((item) => (
                      <div
                        key={`${item.action}-${item.amountPerAction}`}
                        className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-3 sm:p-4"
                      >
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.sampleMessage}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {item.timeBased ? (
                            <>
                              {item.count} completion{item.count === 1 ? '' : 's'} ·{' '}
                              {item.ratePerHour} XP/h
                              {item.avgHours != null && ` · ~${item.avgHours}h avg`}
                              {' '}= <span className="font-black text-amber-500">{item.totalXp} XP</span>
                              {' '}
                              <span className="text-[10px]">(~{item.amountPerAction} XP avg)</span>
                            </>
                          ) : (
                            <>
                              {item.count} times × {item.amountPerAction} XP each ={' '}
                              <span className="font-black text-amber-500">{item.totalXp} XP</span>
                            </>
                          )}
                        </p>
                      </div>
                    ))}
                    {(!breakdown.groupedBreakdown || breakdown.groupedBreakdown.length === 0) && (
                      <p className="text-sm text-[var(--color-text-muted)]">No XP actions this week.</p>
                    )}
                  </div>
                </section>

                <section className="space-y-3 lg:col-span-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    Recent actions
                  </h4>
                  {!!breakdown.recentLogs?.length ? (
                    <ul className="rounded-xl border border-[var(--color-bg-border)] divide-y divide-[var(--color-bg-border)] overflow-hidden">
                      {breakdown.recentLogs.map((log) => (
                        <li
                          key={log._id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2.5 bg-[var(--color-bg-secondary)] text-xs sm:text-sm"
                        >
                          <span className="flex-1 min-w-[12rem] text-[var(--color-text-primary)]">
                            {log.message}
                            {log.adjusted && (
                              <span
                                className="ml-1.5 text-[10px] font-bold text-sky-500 uppercase"
                                title={log.previousAmount != null ? `Was ${log.previousAmount} XP` : 'Recalculated'}
                              >
                                adj
                              </span>
                            )}
                          </span>
                          <span className="font-black text-amber-500 tabular-nums whitespace-nowrap">
                            {log.amount > 0 ? `+${log.amount}` : '0'} XP
                          </span>
                          <span className="text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
                            {formatRelativeTime(log.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)]">No recent actions this week.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LeaderboardBreakdownModal;
