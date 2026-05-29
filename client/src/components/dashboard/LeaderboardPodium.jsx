import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../ui';
import { useLeaderboard } from '../../hooks/useTaskmasterQueries';

const MEDAL_STYLES = {
  1: 'ring-2 ring-amber-400 shadow-amber-400/30',
  2: 'ring-2 ring-slate-300 shadow-slate-300/30',
  3: 'ring-2 ring-orange-600/80 shadow-orange-600/20',
};

const MEDAL_LABELS = { 1: '🥇', 2: '🥈', 3: '🥉' };

const LeaderboardPodium = () => {
  const { data = [], isLoading } = useLeaderboard(true);
  const top3 = data.slice(0, 3);

  return (
    <Card className="p-4 space-y-3 shadow-md">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
        <Trophy size={14} className="text-amber-500" /> Top 3 This Week
      </h4>
      {isLoading && <p className="text-[10px] text-[var(--color-text-muted)]">Loading...</p>}
      {!isLoading && top3.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic">No XP yet</p>
      )}
      <div className="space-y-2">
        {top3.map((member) => (
          <div
            key={member._id}
            className={`flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-bg-secondary)] ${MEDAL_STYLES[member.rank] || ''}`}
          >
            <span className="text-lg w-6 text-center">{MEDAL_LABELS[member.rank] || `#${member.rank}`}</span>
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center text-xs font-bold shrink-0">
              {member.avatar ? (
                <img src={member.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                member.name?.[0] || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{member.name}</p>
              <p className="text-[9px] text-amber-600 font-black">{member.weeklyXp || 0} XP</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LeaderboardPodium;
