import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { DashboardWidgetShell, LoadingPhrase } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { LeaderboardUpdatedBadge } from './LeaderboardRecalcHint';
import LeaderboardBreakdownModal from './LeaderboardBreakdownModal';
import LeaderboardRow from './LeaderboardRow';

const LeaderboardCard = () => {
  const { user } = useAuth();
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
        {isLoading && <LoadingPhrase className="text-xs text-[var(--color-text-muted)] !text-left" />}
        {!isLoading && entries.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">No XP activity this week yet.</p>
        )}
        <div className="-mx-4">
          {!isLoading &&
            entries.map((member) => (
              <LeaderboardRow
                key={member._id}
                member={member}
                entries={entries}
                currentUserId={user?._id}
                onSelect={setSelectedMember}
              />
            ))}
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
