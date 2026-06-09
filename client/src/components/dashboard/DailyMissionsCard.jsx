import React from 'react';
import { Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardWidgetShell, DataListRow, Badge, DataLoading } from '../ui';
import { useGamificationMissions } from '../../hooks/useTaskmasterQueries';

const DailyMissionsCard = () => {
  const { data: missions = [], isLoading } = useGamificationMissions(true);

  const dailyMissions = missions.filter((m) => m.cadence !== 'weekly');
  const weeklyMissions = missions.filter((m) => m.cadence === 'weekly');

  const renderMission = (mission) => {
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
  };

  return (
    <DashboardWidgetShell title="Missions" icon={Target} bodyClassName="p-0">
      {isLoading && <DataLoading className="!py-3" />}
      {!isLoading && missions.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic px-4 py-3">No missions today</p>
      )}
      <div className="-mx-4">
        {dailyMissions.map(renderMission)}
        {weeklyMissions.length > 0 && (
          <>
            <div className="px-4 py-2 border-t border-[var(--color-bg-border)] flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Weekly</span>
              {weeklyMissions.some((m) => m.actionType === 'NEWSLETTER_ARTICLE' && !m.completed) && (
                <Link to="/emails/newsletter" className="text-[9px] font-bold text-blue-400 hover:underline">
                  Add article
                </Link>
              )}
            </div>
            {weeklyMissions.map(renderMission)}
          </>
        )}
      </div>
    </DashboardWidgetShell>
  );
};

export default DailyMissionsCard;
