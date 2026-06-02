import React from 'react';
import { Target } from 'lucide-react';
import { Card, Badge } from '../ui';
import { useGamificationMissions } from '../../hooks/useTaskmasterQueries';

const DailyMissionsCard = () => {
  const { data: missions = [], isLoading } = useGamificationMissions(true);

  return (
    <Card className="p-4 space-y-3 shadow-md">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
        <Target size={14} className="text-emerald-500" /> Daily Missions
      </h4>
      {isLoading && <p className="text-[10px] text-[var(--color-text-muted)]">Loading...</p>}
      {!isLoading && missions.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic">No missions today</p>
      )}
      <div className="space-y-2">
        {missions.map((mission) => {
          const progress = Math.min(
            100,
            Math.round(((mission.currentCount || 0) / mission.targetCount) * 100)
          );
          return (
            <div
              key={mission._id}
              className={`p-2.5 rounded-xl border ${
                mission.completed
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{mission.title}</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] truncate">{mission.description}</p>
                </div>
                <Badge variant={mission.completed ? 'success' : 'neutral'} className="shrink-0 text-[9px]">
                  +{mission.expReward} XP
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--color-bg-border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      mission.completed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[9px] font-black tabular-nums text-[var(--color-text-muted)]">
                  {mission.currentCount || 0}/{mission.targetCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default DailyMissionsCard;
