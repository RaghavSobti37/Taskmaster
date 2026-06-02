import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown } from '../../hooks/useTaskmasterQueries';
import {
  hasLeaderboardRecalcHint,
  LeaderboardRecalcHover,
  LeaderboardUpdatedBadge,
} from './LeaderboardRecalcHint';
import LeaderboardBreakdownModal from './LeaderboardBreakdownModal';

const LeaderboardCard = () => {
  const { data, isLoading } = useLeaderboard(true);
  const entries = data?.entries ?? [];
  const meta = data?.meta;
  const [selectedMember, setSelectedMember] = useState(null);
  const { data: breakdown, isLoading: breakdownLoading } = useLeaderboardBreakdown(
    selectedMember?._id,
    !!selectedMember?._id
  );

  return (
    <>
      <Card className="p-5 space-y-4 shadow-md overflow-visible">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" /> Weekly Leaderboard
            <LeaderboardUpdatedBadge lastRecalculatedAt={meta?.lastRecalculatedAt} />
          </h4>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">
          Click a row for full-screen breakdown · hover score for recalc preview (below)
        </p>
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading leaderboard...</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">No XP activity this week yet.</p>
          )}
          {!isLoading && entries.map((member) => {
            const showHint = hasLeaderboardRecalcHint(member);
            return (
              <div key={member._id} className="relative group focus-within:z-20">
                <button
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className={`w-full text-left flex items-center justify-between rounded-xl p-3 bg-[var(--color-bg-secondary)] border transition-colors hover:border-amber-500/50 ${
                    showHint
                      ? 'border-amber-500/30'
                      : 'border-[var(--color-bg-border)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-black w-6 text-center">#{member.rank}</span>
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center text-xs font-bold">
                      {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : (member.name?.[0] || '?')}
                    </div>
                    <span className="text-xs font-bold truncate">{member.name}</span>
                  </div>
                  <span className="text-xs font-black text-amber-500 shrink-0">
                    {member.weeklyXp || 0} XP
                    {showHint && member.weeklyXpDelta !== 0 && (
                      <span className="ml-1 text-[10px] text-sky-400 font-semibold">
                        ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
                      </span>
                    )}
                  </span>
                </button>
                <LeaderboardRecalcHover member={member} />
              </div>
            );
          })}
        </div>
      </Card>

      <LeaderboardBreakdownModal
        member={selectedMember}
        breakdown={breakdown}
        breakdownLoading={breakdownLoading}
        onClose={() => setSelectedMember(null)}
      />
    </>
  );
};

export default LeaderboardCard;
