import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { DashboardWidgetShell, DataListRow } from '../ui';
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
      <DashboardWidgetShell
        className="overflow-visible"
        bodyClassName="p-4 flex flex-col max-h-[320px] overflow-y-auto"
        title={
          <>
            Weekly Leaderboard
            <LeaderboardUpdatedBadge lastRecalculatedAt={meta?.lastRecalculatedAt} />
          </>
        }
        icon={Trophy}
      >
        
        {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading leaderboard...</p>}
        {!isLoading && entries.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">No XP activity this week yet.</p>
        )}
        <div className="-mx-4">
          {!isLoading && entries.map((member) => {
            const showHint = hasLeaderboardRecalcHint(member);
            return (
              <div key={member._id} className="relative group focus-within:z-20">
                <DataListRow
                  onClick={() => setSelectedMember(member)}
                  accentColor={showHint ? '#f59e0b' : undefined}
                  leading={
                    <>
                    <span className="text-xs font-black w-6 text-center tabular-nums shrink-0">#{member.rank}</span>
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center text-xs font-bold shrink-0">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.name?.[0] || '?'
                      )}
                    </div>
                    </>
                  }
                  primary={
                    <span className="text-xs font-bold truncate tm-data-primary">{member.name}</span>
                  }
                  trailing={
                    <span className="text-xs font-black tabular-nums text-right text-amber-500 shrink-0">
                      {member.weeklyXp || 0} XP
                      {showHint && member.weeklyXpDelta !== 0 && (
                        <span className="ml-1 text-[10px] text-sky-400 font-semibold">
                          ({member.weeklyXpDelta > 0 ? '+' : ''}{member.weeklyXpDelta})
                        </span>
                      )}
                    </span>
                  }
                />
                <LeaderboardRecalcHover member={member} />
              </div>
            );
          })}
        </div>
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

export default LeaderboardCard;
