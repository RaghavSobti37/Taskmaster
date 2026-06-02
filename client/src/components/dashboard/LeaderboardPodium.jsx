import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown } from '../../hooks/useTaskmasterQueries';
import {
  hasLeaderboardRecalcHint,
  LeaderboardRecalcHover,
  LeaderboardUpdatedBadge,
} from './LeaderboardRecalcHint';
import LeaderboardBreakdownModal from './LeaderboardBreakdownModal';

const TOP_N = 5;

const RANK_MEDAL = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const LeaderboardRow = ({ member, onSelect }) => {
  const medal = RANK_MEDAL[member.rank];
  const showHint = hasLeaderboardRecalcHint(member);

  return (
    <div className="relative group focus-within:z-20">
      <button
        type="button"
        onClick={() => onSelect(member)}
        className={`w-full text-left flex items-center gap-2.5 rounded-lg border px-2.5 py-2 bg-[var(--color-bg-secondary)] transition-colors hover:border-amber-500/50 ${
          showHint ? 'border-amber-500/30' : 'border-[var(--color-bg-border)]'
        }`}
      >
        <div className="w-6 shrink-0 flex items-center justify-center">
          {medal ? (
            <span className="text-sm leading-none" aria-hidden>
              {medal}
            </span>
          ) : (
            <span className="text-xs font-bold tabular-nums text-[var(--color-text-muted)]">
              {member.rank}
            </span>
          )}
        </div>
        <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            member.name?.[0] || '?'
          )}
        </div>
        <p className="flex-1 min-w-0 text-xs font-semibold truncate text-[var(--color-text-primary)]">
          {member.name}
        </p>
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-amber-500">
          {member.weeklyXp || 0} XP
          {showHint && member.weeklyXpDelta !== 0 && (
            <span className="ml-1 text-[9px] text-sky-400 font-semibold">
              ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
            </span>
          )}
        </span>
      </button>
      <LeaderboardRecalcHover member={member} />
    </div>
  );
};

const LeaderboardPodium = () => {
  const { data, isLoading } = useLeaderboard(true);
  const entries = data?.entries ?? [];
  const meta = data?.meta;
  const topFive = useMemo(() => entries.slice(0, TOP_N), [entries]);
  const [selectedMember, setSelectedMember] = useState(null);
  const { data: breakdown, isLoading: breakdownLoading } = useLeaderboardBreakdown(
    selectedMember?._id,
    !!selectedMember?._id
  );

  return (
    <>
      <Card className="p-4 shadow-md overflow-visible">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2 mb-3">
          <Trophy size={14} className="text-amber-500 shrink-0" />
          Weekly Leaderboard
          <LeaderboardUpdatedBadge lastRecalculatedAt={meta?.lastRecalculatedAt} />
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mb-2 -mt-1">
          Click a row for full-screen breakdown · hover score for recalc preview (below)
        </p>
        {isLoading && (
          <p className="text-[10px] text-[var(--color-text-muted)]">Loading...</p>
        )}
        {!isLoading && entries.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic">No team members yet</p>
        )}
        {!isLoading && topFive.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {topFive.map((member) => (
              <LeaderboardRow
                key={member._id}
                member={member}
                onSelect={setSelectedMember}
              />
            ))}
          </div>
        )}
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

export default LeaderboardPodium;
