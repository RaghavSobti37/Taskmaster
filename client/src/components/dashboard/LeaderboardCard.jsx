import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard } from '../../hooks/useTaskmasterQueries';

const LeaderboardCard = () => {
  const { data = [], isLoading } = useLeaderboard(true);

  return (
    <Card className="p-5 space-y-4 shadow-md">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" /> Weekly Leaderboard
        </h4>
      </div>
      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading leaderboard...</p>}
        {!isLoading && data.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">No XP activity this week yet.</p>
        )}
        {!isLoading && data.map((member) => (
          <div key={member._id} className="flex items-center justify-between rounded-xl p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-black w-6 text-center">#{member.rank}</span>
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center text-xs font-bold">
                {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : (member.name?.[0] || '?')}
              </div>
              <span className="text-xs font-bold truncate">{member.name}</span>
            </div>
            <span className="text-xs font-black text-amber-500">{member.weeklyXp || 0} XP</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LeaderboardCard;
