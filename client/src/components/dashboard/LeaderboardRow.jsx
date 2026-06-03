import React from 'react';
import LeaderboardRankBadge from './LeaderboardRankBadge';
import { hasLeaderboardRecalcHint, LeaderboardRecalcHover } from './LeaderboardRecalcHint';

const LeaderboardRow = ({ member, onSelect }) => {
  const showHint = hasLeaderboardRecalcHint(member);

  return (
    <div className="relative group focus-within:z-20">
      <button
        type="button"
        onClick={() => onSelect?.(member)}
        className="tm-data-row tm-leaderboard-row w-full text-left flex items-center gap-2 min-w-0 cursor-pointer"
      >
        <LeaderboardRankBadge rank={member.rank} />
        <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            member.name?.[0] || '?'
          )}
        </div>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className="tm-data-primary text-xs truncate min-w-0">{member.name}</span>
          <span className="ml-auto shrink-0 text-[10px] font-bold tabular-nums text-amber-500 whitespace-nowrap">
            {member.weeklyXp || 0} XP
            {showHint && member.weeklyXpDelta !== 0 && (
              <span className="ml-1 text-[9px] text-sky-400 font-semibold">
                ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
              </span>
            )}
          </span>
        </div>
      </button>
      <LeaderboardRecalcHover member={member} />
    </div>
  );
};

export default LeaderboardRow;
