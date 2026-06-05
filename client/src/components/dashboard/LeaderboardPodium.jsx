import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { DashboardWidgetShell, LoadingPhrase } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { LeaderboardUpdatedBadge } from './LeaderboardRecalcHint';
import LeaderboardBreakdownModal from './LeaderboardBreakdownModal';
import LeaderboardRow from './LeaderboardRow';

const TOP_N = 5;

const LeaderboardPodium = () => {
  const { user } = useAuth();
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
        {isLoading && <LoadingPhrase className="text-[10px] tm-data-meta px-4 py-3 !text-left" />}
        {!isLoading && entries.length === 0 && (
          <p className="text-[10px] tm-data-meta italic px-4 py-3">No team members yet</p>
        )}
        {!isLoading && topFive.length > 0 && (
          <div className="flex flex-col">
            {topFive.map((member) => (
              <LeaderboardRow
                key={member._id}
                member={member}
                entries={entries}
                currentUserId={user?._id}
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
