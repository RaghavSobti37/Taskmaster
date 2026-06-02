import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard } from '../../hooks/useTaskmasterQueries';

const TOP_N = 5;

const RANK_MEDAL = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const LeaderboardRow = ({ member }) => {
  const medal = RANK_MEDAL[member.rank];

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-bg-border)] px-2.5 py-2 bg-[var(--color-bg-secondary)]">
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
      </span>
    </div>
  );
};

const LeaderboardPodium = () => {
  const { data = [], isLoading } = useLeaderboard(true);
  const topFive = useMemo(() => data.slice(0, TOP_N), [data]);

  return (
    <Card className="p-4 shadow-md">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-amber-500 shrink-0" />
        Weekly Leaderboard
      </h4>
      {isLoading && (
        <p className="text-[10px] text-[var(--color-text-muted)]">Loading...</p>
      )}
      {!isLoading && data.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic">No team members yet</p>
      )}
      {!isLoading && topFive.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {topFive.map((member) => (
            <LeaderboardRow key={member._id} member={member} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default LeaderboardPodium;
