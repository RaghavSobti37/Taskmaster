import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { DashboardWidgetShell, DataListRow } from '../ui';
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
      <DataListRow
        onClick={() => onSelect(member)}
        accentColor={showHint ? '#f59e0b' : undefined}
        leading={
          <>
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
          </>
        }
        primary={
          <p className="tm-data-primary text-xs truncate">{member.name}</p>
        }
        trailing={
          <span className="text-[10px] font-bold tabular-nums text-right text-amber-500">
            {member.weeklyXp || 0} XP
            {showHint && member.weeklyXpDelta !== 0 && (
              <span className="ml-1 text-[9px] text-sky-400 font-semibold">
                ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
              </span>
            )}
          </span>
        }
      />
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
      <DashboardWidgetShell
        className="overflow-visible"
        bodyClassName="p-0 flex flex-col"
        title={
          <>
            Weekly Leaderboard
            <LeaderboardUpdatedBadge lastRecalculatedAt={meta?.lastRecalculatedAt} />
          </>
        }
        icon={Trophy}
      >
       
        {isLoading && (
          <p className="text-[10px] tm-data-meta px-4 py-3">Loading...</p>
        )}
        {!isLoading && entries.length === 0 && (
          <p className="text-[10px] tm-data-meta italic px-4 py-3">No team members yet</p>
        )}
        {!isLoading && topFive.length > 0 && (
          <div className="flex flex-col">
            {topFive.map((member) => (
              <LeaderboardRow
                key={member._id}
                member={member}
                onSelect={setSelectedMember}
              />
            ))}
          </div>
        )}
      </DashboardWidgetShell>

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
