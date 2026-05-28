import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown } from '../../hooks/useTaskmasterQueries';

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

const LeaderboardCard = () => {
  const { data = [], isLoading } = useLeaderboard(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const { data: breakdown, isLoading: breakdownLoading } = useLeaderboardBreakdown(
    selectedMember?._id,
    !!selectedMember?._id
  );

  const formulaLine = useMemo(() => {
    if (!breakdown?.groupedBreakdown?.length) return null;
    return breakdown.groupedBreakdown
      .map((item) => `${item.count} x ${item.amountPerAction}`)
      .join(' + ');
  }, [breakdown]);

  return (
    <>
      <Card className="p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" /> Weekly Leaderboard
          </h4>
        </div>
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading leaderboard...</p>}
          {!isLoading && data.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">No XP activity this week yet.</p>
          )}
          {!isLoading && data.map((member) => (
            <button
              key={member._id}
              type="button"
              onClick={() => setSelectedMember(member)}
              className="w-full text-left flex items-center justify-between rounded-xl p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] hover:border-amber-500/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-black w-6 text-center">#{member.rank}</span>
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center text-xs font-bold">
                  {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : (member.name?.[0] || '?')}
                </div>
                <span className="text-xs font-bold truncate">{member.name}</span>
              </div>
              <span className="text-xs font-black text-amber-500">{member.weeklyXp || 0} XP</span>
            </button>
          ))}
        </div>
      </Card>

      {selectedMember && (
        <div
          className="tm-modal-overlay fixed inset-0 z-[9999] p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="tm-modal-panel max-w-lg bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl p-5 space-y-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Weekly XP Breakdown</h3>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-1">{selectedMember.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Simple calculation for this week</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="text-xs font-bold px-2 py-1 rounded-md border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                Close
              </button>
            </div>

            {breakdownLoading && (
              <p className="text-xs text-[var(--color-text-muted)]">Loading XP calculation...</p>
            )}

            {!breakdownLoading && breakdown && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Total this week</p>
                  <p className="text-lg font-black text-amber-500 mt-1">{breakdown.totalXp || 0} XP</p>
                  {formulaLine && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Formula: {formulaLine} = {breakdown.totalXp || 0}
                    </p>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {(breakdown.groupedBreakdown || []).map((item) => (
                    <div
                      key={`${item.action}-${item.amountPerAction}`}
                      className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-3"
                    >
                      <p className="text-xs font-bold text-[var(--color-text-primary)]">
                        {item.sampleMessage}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {item.count} times x {item.amountPerAction} XP each = {item.totalXp} XP
                      </p>
                    </div>
                  ))}
                  {(!breakdown.groupedBreakdown || breakdown.groupedBreakdown.length === 0) && (
                    <p className="text-xs text-[var(--color-text-muted)]">No XP actions this week.</p>
                  )}
                </div>

                {!!breakdown.recentLogs?.length && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">Recent actions</p>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {breakdown.recentLogs.map((log) => (
                        <div key={log._id} className="text-xs flex items-start justify-between gap-3">
                          <span className="text-[var(--color-text-primary)] truncate">{log.message}</span>
                          <span className="font-black text-amber-500 whitespace-nowrap">+{log.amount} XP</span>
                          <span className="text-[var(--color-text-muted)] whitespace-nowrap">{formatRelativeTime(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LeaderboardCard;
