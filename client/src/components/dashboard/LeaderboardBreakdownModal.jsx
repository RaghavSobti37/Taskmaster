import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy } from 'lucide-react';
import DataListRow from '../ui/DataListRow';
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
    <section className="border-b border-sky-500/30 pb-4">
      <h4 className="text-xs font-black uppercase tracking-wider text-sky-500">Last recalculation</h4>
      <p className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mt-2 tabular-nums">
        Was {member.weeklyXpPrior} XP → now {member.weeklyXp} XP ({formatDelta(member.weeklyXpDelta)})
      </p>
      {member.recalcChanges?.length > 0 && (
        <ul className="mt-3 border-t border-[var(--color-bg-border)]">
          {member.recalcChanges.map((row, index) => (
            <li
              key={`${row.action}-${row.previousAmount}-${row.amount}-${row.delta}-${index}`}
              className="text-xs text-[var(--color-text-muted)] px-0 py-2 border-b border-[var(--color-bg-border)] last:border-b-0"
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
      className="fixed inset-0 z-[10000] flex flex-col bg-[var(--color-bg-primary)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-breakdown-title"
    >
      <header className="shrink-0 flex items-center gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-sm font-bold text-[var(--color-text-muted)]">
          {member.avatar ? (
            <img src={member.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
          onClick={() => onClose?.()}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-primary)] active:bg-[var(--color-bg-primary)] transition-colors touch-manipulation"
          aria-label="Close breakdown"
        >
          <X size={20} className="text-[var(--color-text-muted)] pointer-events-none" />
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
                <section className="border-b border-amber-500/30 pb-4 lg:col-span-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    Total this week
                  </h4>
                  <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-2 tabular-nums tm-data-primary">
                    {breakdown.totalXp || 0} XP
                  </p>
                  {formulaLine && (
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-3 break-words leading-relaxed font-mono">
                      {formulaLine} = {breakdown.totalXp || 0}
                    </p>
                  )}
                </section>

                <section className="lg:col-span-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                    By action type
                  </h4>
                  {(breakdown.groupedBreakdown || []).length > 0 ? (
                    <div className="border-t border-[var(--color-bg-border)]">
                      {(breakdown.groupedBreakdown || []).map((item) => (
                        <DataListRow
                          key={`${item.action}-${item.amountPerAction}`}
                          primary={
                            <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.sampleMessage}</p>
                          }
                          secondary={
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {item.timeBased ? (
                                <>
                                  {item.count} completion{item.count === 1 ? '' : 's'} ·{' '}
                                  {item.ratePerHour} XP/h
                                  {item.avgHours != null && ` · ~${item.avgHours}h avg`}
                                  {' '}= <span className="font-black text-amber-500 tabular-nums">{item.totalXp} XP</span>
                                  {' '}
                                  <span className="text-[10px]">(~{item.amountPerAction} XP avg)</span>
                                </>
                              ) : (
                                <>
                                  {item.count} times × {item.amountPerAction} XP each ={' '}
                                  <span className="font-black text-amber-500 tabular-nums">{item.totalXp} XP</span>
                                </>
                              )}
                            </p>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] py-2">No XP actions this week.</p>
                  )}
                </section>

                <section className="lg:col-span-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                    Recent actions
                  </h4>
                  {breakdown.recentLogs?.length ? (
                    <div className="border-t border-[var(--color-bg-border)]">
                      {breakdown.recentLogs.map((log) => (
                        <DataListRow
                          key={log._id}
                          primary={
                            <span className="text-xs sm:text-sm text-[var(--color-text-primary)]">
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
                          }
                          trailing={
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <span className="font-black text-amber-500 tabular-nums text-xs sm:text-sm whitespace-nowrap">
                                {log.amount > 0 ? `+${log.amount}` : '0'} XP
                              </span>
                              <span className="text-[var(--color-text-muted)] text-[10px] whitespace-nowrap">
                                {formatRelativeTime(log.createdAt)}
                              </span>
                            </div>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)] py-2">No recent actions this week.</p>
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
