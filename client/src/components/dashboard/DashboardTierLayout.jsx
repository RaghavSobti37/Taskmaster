import React, { useMemo, useState, useCallback, useEffect } from 'react';
import DashboardCollapsibleSection from './DashboardCollapsibleSection';
import MyTasksDashboardCard from './MyTasksDashboardCard';
import {
  DASHBOARD_SECTIONS,
  groupElementsBySection,
  resolveDailyActionSlots,
  resolveSectionState,
} from '../../lib/dashboardSections';

const DAILY_COMPACT = new Set(['mark-attendance', 'schedule', 'review-queue']);

export default function DashboardTierLayout({
  elements,
  permissionPreset,
  sectionState: presetSectionState,
  renderWidget,
  workspaces = [],
  tasks = [],
  projects = [],
  tasksLoading,
  onComplete,
  completingTaskId,
}) {
  const groups = useMemo(
    () => groupElementsBySection(elements, permissionPreset),
    [elements, permissionPreset]
  );

  const [sectionCollapsed, setSectionCollapsed] = useState(() =>
    resolveSectionState(presetSectionState)
  );

  useEffect(() => {
    setSectionCollapsed(resolveSectionState(presetSectionState));
  }, [presetSectionState]);

  const setSection = useCallback((sectionId, collapsed) => {
    setSectionCollapsed((prev) => ({ ...prev, [sectionId]: collapsed }));
  }, []);

  const dailySlots = useMemo(
    () => resolveDailyActionSlots(groups['daily-actions'] || []),
    [groups]
  );

  const renderDailySlot = (slot) => {
    if (slot.type === 'my-tasks') {
      return (
        <MyTasksDashboardCard
          key="my-tasks"
          tasks={tasks}
          projects={projects}
          workspaces={workspaces}
          loading={tasksLoading}
          onComplete={onComplete}
          completingTaskId={completingTaskId}
        />
      );
    }
    return (
      <div key={slot.componentId} className="min-h-[160px] h-full">
        {renderWidget(slot.componentId, { compact: DAILY_COMPACT.has(slot.componentId) })}
      </div>
    );
  };

  const renderSectionGrid = (sectionId, className) => {
    const widgets = groups[sectionId] || [];
    if (!widgets.length) return null;

    if (sectionId === 'status-strip') {
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
          {widgets.map((el) => (
            <div key={el.componentId} className="min-h-[120px]">
              {renderWidget(el.componentId, { compact: true, maxItems: 3 })}
            </div>
          ))}
        </div>
      );
    }

    if (sectionId === 'analytics') {
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
          {widgets.map((el) => (
            <div key={el.componentId} className="min-h-[140px]">
              {renderWidget(el.componentId, { compact: true, maxItems: 4 })}
            </div>
          ))}
        </div>
      );
    }

    if (sectionId === 'more') {
      return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
          {widgets.map((el) => (
            <div key={el.componentId} className="min-h-[160px]">
              {renderWidget(el.componentId, { compact: true })}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const teamWidgets = groups['team-context'] || [];
  const sortedTeam = useMemo(
    () => [...teamWidgets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [teamWidgets]
  );

  const renderTeamWidget = (el) => {
    const spanClass =
      el.componentId === 'leaderboard' ? 'lg:col-span-2' : '';
    return (
      <div key={el.componentId} className={`min-h-[200px] ${spanClass}`}>
        {renderWidget(el.componentId, { compact: true, maxItems: el.componentId === 'leaderboard' ? 5 : 4 })}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {(groups['status-strip']?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="Status strip"
          subtitle="System health, last backup, and alerts"
          defaultCollapsed={sectionCollapsed['status-strip']}
          collapsed={sectionCollapsed['status-strip']}
          onCollapsedChange={(v) => setSection('status-strip', v)}
          strip
        >
          {renderSectionGrid('status-strip')}
        </DashboardCollapsibleSection>
      )}

      {dailySlots.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {dailySlots.map((slot) => renderDailySlot(slot))}
        </div>
      )}

      {(sortedTeam.length > 0) && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-0.5">
            TEAM AND WORK CONTEXT
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {sortedTeam.map((el) => renderTeamWidget(el))}
          </div>
        </div>
      )}

      {(groups.analytics?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="Analytics & reporting"
          sectionLabel="ANALYTICS AND REPORTING — secondary tab or lower fold"
          subtitle="CRM, campaigns, department stats, and more"
          defaultCollapsed={sectionCollapsed.analytics}
          collapsed={sectionCollapsed.analytics}
          onCollapsedChange={(v) => setSection('analytics', v)}
        >
          {renderSectionGrid('analytics')}
        </DashboardCollapsibleSection>
      )}

      {(groups.more?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="More widgets"
          subtitle="Notes, pin board, missions, leave requests, reimbursements"
          defaultCollapsed={sectionCollapsed.more}
          collapsed={sectionCollapsed.more}
          onCollapsedChange={(v) => setSection('more', v)}
        >
          {renderSectionGrid('more')}
        </DashboardCollapsibleSection>
      )}
    </div>
  );
}
