import React, { useMemo } from 'react';
import LeaderboardRankBadge from './LeaderboardRankBadge';
import LeaderboardLastWeekRank from './LeaderboardLastWeekRank';
import { hasLeaderboardRecalcHint, LeaderboardRecalcHover } from './LeaderboardRecalcHint';

const PODIUM_BORDER = {
  1: 'tm-leaderboard-podium--gold',
  2: 'tm-leaderboard-podium--silver',
  3: 'tm-leaderboard-podium--bronze',
};

const LeaderboardRow = ({ member, onSelect, entries = [], currentUserId, lastWeekLabel }) => {
  const showHint = hasLeaderboardRecalcHint(member);
  const podiumClass = PODIUM_BORDER[member.rank] || '';
  const xpToNext = useMemo(() => {
    if (!currentUserId || member._id !== currentUserId || member.rank <= 1) return null;
    const above = entries.find((entry) => entry.rank === member.rank - 1);
    if (!above) return null;
    const gap = (above.weeklyXp || 0) - (member.weeklyXp || 0);
    return gap > 0 ? gap : null;
  }, [entries, currentUserId, member._id, member.rank, member.weeklyXp]);

  const rowInner = (
    <>
      <LeaderboardRankBadge rank={member.rank} />
      <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
        {member.avatar ? (
          <img src={member.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          member.name?.[0] || '?'
        )}
      </div>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="tm-data-primary text-xs truncate min-w-0">{member.name}</span>
        <LeaderboardLastWeekRank rank={member.lastWeekRank} weekLabel={lastWeekLabel} />
        <span className="ml-auto shrink-0 text-[10px] font-bold tabular-nums text-amber-500 whitespace-nowrap">
          {member.weeklyXp || 0} XP
          {showHint && member.weeklyXpDelta !== 0 && (
            <span className="ml-1 text-[9px] text-sky-400 font-semibold">
              ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
            </span>
          )}
          {xpToNext != null && (
            <span className="ml-1.5 text-[9px] font-semibold text-[var(--color-text-muted)]">
              +{xpToNext} to next rank
            </span>
          )}
        </span>
      </div>
    </>
  );

  return (
    <div className={`relative group focus-within:z-20 ${podiumClass}`}>
      <button
        type="button"
        onClick={() => onSelect?.(member)}
        className="tm-data-row tm-leaderboard-row w-full text-left flex items-center gap-2 min-w-0 cursor-pointer"
      >
        {rowInner}
      </button>
      <LeaderboardRecalcHover member={member} />
    </div>
  );
};

export default LeaderboardRow;
