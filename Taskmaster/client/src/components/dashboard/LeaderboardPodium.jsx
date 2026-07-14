import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { DashboardWidgetShell, DataLoading, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { useLeaderboard, useLeaderboardBreakdown, useLeaderboardHistory } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { LeaderboardUpdatedBadge } from './LeaderboardRecalcHint';
import LeaderboardBreakdownModal from './LeaderboardBreakdownModal';
import LeaderboardRow from './LeaderboardRow';

const TOP_N = 5;

const LeaderboardPodium = () => {
  const { user } = useAuth();
  const [selectedMonthStartKey, setSelectedMonthStartKey] = useState(null);
  const { data: historyData } = useLeaderboardHistory(12, true);
  const { data, isLoading, isError, error, refetch } = useLeaderboard(selectedMonthStartKey, true);
  const entries = data?.entries ?? [];
  const meta = data?.meta;
  const topFive = useMemo(() => entries.slice(0, TOP_N), [entries]);
  const lastMonthLabel = meta?.lastMonthStartKey && meta?.lastMonthEndKey
    ? `${meta.lastMonthStartKey} – ${meta.lastMonthEndKey}`
    : null;
  const [selectedMember, setSelectedMember] = useState(null);
  const { data: breakdown, isLoading: breakdownLoading } = useLeaderboardBreakdown(
    selectedMember?._id,
    selectedMonthStartKey,
    !!selectedMember?._id
  );
  const history = historyData?.history || [];
  const monthOptions = history.map((row) => ({
    value: row.monthStartKey,
    label: `${row.monthStartKey} - ${row.monthEndKey}`,
  }));

  return (
    <>
      <DashboardWidgetShell
        className="overflow-visible"
        bodyClassName="p-0 flex flex-col"
        title={
          <div className="w-full flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex items-center gap-2">
              <span className="truncate">Monthly Leaderboard</span>
              <LeaderboardUpdatedBadge lastRecalculatedAt={meta?.lastRecalculatedAt} />
            </div>
            <label className="sr-only" htmlFor="leaderboard-month-select">Month</label>
            <select
              id="leaderboard-month-select"
              value={selectedMonthStartKey || ''}
              onChange={(e) => setSelectedMonthStartKey(e.target.value || null)}
              className="h-8 min-h-0 w-[130px] sm:w-[160px] rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-2 text-[11px] text-[var(--color-text-primary)] shrink-0"
            >
              <option value="">Current month</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        }
        icon={Trophy}
      >
        {isError && (
          <QueryErrorBanner
            className="mx-3 mt-2"
            message={getQueryErrorMessage(error, 'Failed to load leaderboard')}
            onRetry={() => refetch()}
          />
        )}
        {isLoading && <DataLoading className="!py-3" />}
        {!isLoading && !isError && entries.length === 0 && (
          <p className="text-[10px] tm-data-meta italic px-4 py-3">No team members yet</p>
        )}
        {!isLoading && !isError && topFive.length > 0 && (
          <div className="flex flex-col">
            {topFive.map((member) => (
              <LeaderboardRow
                key={member._id}
                member={member}
                entries={entries}
                currentUserId={user?._id}
                lastMonthLabel={lastMonthLabel}
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
