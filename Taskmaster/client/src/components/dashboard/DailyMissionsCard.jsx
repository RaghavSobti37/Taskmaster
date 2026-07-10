import React from 'react';
import { CheckCircle2, ChevronRight, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardWidgetShell, Badge, DataLoading } from '../ui';
import { useGamificationMissions } from '../../hooks/useTaskmasterQueries';

const MISSION_ROUTES = {
  COMPLETE_TASK: '/todo',
  DAILY_LOG: '/logs',
  ATTENDANCE_DAY: '/attendance',
  NEWSLETTER_ARTICLE: '/emails/newsletter',
};

const MissionSectionHeader = ({ label, action }) => (
  <div className="flex items-center gap-2 pt-1 pb-0.5">
    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)] shrink-0">
      {label}
    </span>
    <div className="flex-1 h-px bg-[var(--color-bg-border)]" aria-hidden />
    {action}
  </div>
);

const MissionRow = ({ mission, onNavigate }) => {
  const current = mission.currentCount || 0;
  const target = mission.targetCount || 1;
  const progress = Math.min(100, Math.round((current / target) * 100));
  const isComplete = mission.completed || current >= target;
  const hasProgress = progress > 0;
  const route = MISSION_ROUTES[mission.actionType];
  const isClickable = Boolean(route);

  const handleClick = () => {
    if (route) onNavigate(route);
  };

  const RowTag = isClickable ? 'button' : 'div';

  return (
    <RowTag
      type={isClickable ? 'button' : undefined}
      onClick={isClickable ? handleClick : undefined}
      className={[
        'group w-full text-left rounded-[var(--radius-atomic)] border px-3 py-2.5 transition-all',
        isComplete
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/35',
        isClickable
          ? 'cursor-pointer hover:border-[var(--color-text-muted)]/30 hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40'
          : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {isComplete ? (
            <CheckCircle2
              size={15}
              className="shrink-0 mt-0.5 text-emerald-500"
              aria-hidden
            />
          ) : (
            <span
              className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-[var(--color-bg-border)] ring-1 ring-[var(--color-text-muted)]/25"
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={[
                'text-xs font-bold leading-snug truncate',
                isComplete
                  ? 'text-[var(--color-text-muted)] line-through decoration-emerald-500/60'
                  : 'text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {mission.title}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-text-secondary)] line-clamp-2">
              {mission.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={isComplete ? 'success' : 'warning'}
            className="!text-[9px] !px-1.5 !py-0.5 font-black tabular-nums"
          >
            +{mission.expReward} XP
          </Badge>
          {isClickable && (
            <ChevronRight
              size={14}
              className="text-[var(--color-text-muted)] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
              aria-hidden
            />
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5 pl-4">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]/60">
          <div
            className={[
              'h-full rounded-full transition-all duration-500',
              isComplete
                ? 'bg-emerald-500'
                : hasProgress
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-[var(--color-text-muted)]/15',
            ].join(' ')}
            style={{ width: `${isComplete ? 100 : progress}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`${mission.title} progress`}
          />
        </div>
        <span
          className={[
            'text-[10px] font-black tabular-nums shrink-0',
            isComplete ? 'text-emerald-500' : 'text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {current}/{target}
        </span>
      </div>
    </RowTag>
  );
};

const DailyMissionsCard = () => {
  const navigate = useNavigate();
  const { data: missions = [], isLoading } = useGamificationMissions(true);

  const dailyMissions = missions.filter((m) => m.cadence !== 'weekly');
  const weeklyMissions = missions.filter((m) => m.cadence === 'weekly');
  const showNewsletterCta = weeklyMissions.some(
    (m) => m.actionType === 'NEWSLETTER_ARTICLE' && !m.completed
  );

  return (
    <DashboardWidgetShell title="Missions" icon={Target} bodyClassName="p-0">
      {isLoading && <DataLoading className="!py-4" />}
      {!isLoading && missions.length === 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] italic px-4 py-4 text-center">
          No missions today
        </p>
      )}
      {!isLoading && missions.length > 0 && (
        <div className="px-3 py-3 space-y-3">
          {dailyMissions.length > 0 && (
            <section className="space-y-2">
              <MissionSectionHeader label="Daily" />
              {dailyMissions.map((mission) => (
                <MissionRow key={mission._id} mission={mission} onNavigate={navigate} />
              ))}
            </section>
          )}

          {weeklyMissions.length > 0 && (
            <section className="space-y-2">
              <MissionSectionHeader
                label="Weekly"
                action={
                  showNewsletterCta ? (
                    <Link
                      to="/emails/newsletter"
                      className="rounded-[var(--radius-atomic)] px-2 py-0.5 text-[10px] font-bold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
                    >
                      Add article
                    </Link>
                  ) : null
                }
              />
              {weeklyMissions.map((mission) => (
                <MissionRow key={mission._id} mission={mission} onNavigate={navigate} />
              ))}
            </section>
          )}
        </div>
      )}
    </DashboardWidgetShell>
  );
};

export default DailyMissionsCard;
