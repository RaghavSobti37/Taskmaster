import React from 'react';
import { Target } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, Badge } from '../ui';
import { useGamificationMissions } from '../../hooks/useTaskmasterQueries';

const DailyMissionsCard = () => {
  const { data: missions = [], isLoading } = useGamificationMissions(true);

  return (
    <DashboardWidgetShell title="Daily Missions" icon={Target} bodyClassName="p-0">
      {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] px-4 py-3">Loading...</p>}
      {!isLoading && missions.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic px-4 py-3">No missions today</p>
      )}
      <div className="-mx-4">
        {missions.map((mission) => {
          const progress = Math.min(
            100,
            Math.round(((mission.currentCount || 0) / mission.targetCount) * 100)
          );
          return (
            <DataListRow
              key={mission._id}
              accentColor={mission.completed ? '#10b981' : undefined}
              primary={
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{mission.title}</p>
                    <p className="text-[9px] text-[var(--color-text-muted)] truncate">{mission.description}</p>
                  </div>
                  <Badge variant={mission.completed ? 'success' : 'neutral'} className="shrink-0 text-[9px]">
                    +{mission.expReward} XP
                  </Badge>
                </div>
              }
              secondary={
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
              }
            />
          );
        })}
      </div>
    </DashboardWidgetShell>
  );
};

export default DailyMissionsCard;
